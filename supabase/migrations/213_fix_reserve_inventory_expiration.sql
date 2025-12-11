-- ============================================================================
-- FIX: Add expires_at to reserve_inventory holds
--
-- Problem: Checkout holds have NULL expires_at, so if release fails they're stuck forever
-- Solution: Set expires_at to 15 minutes (checkout should complete within that time)
-- ============================================================================

-- Update the INSERT in reserve_inventory to include expires_at
-- We need to recreate the function with the fix

CREATE OR REPLACE FUNCTION reserve_inventory(
  p_order_id UUID,
  p_items JSONB
)
RETURNS TABLE (
  returned_hold_id UUID,
  returned_inventory_id UUID,
  returned_product_id UUID,
  returned_quantity NUMERIC,
  returned_available_quantity NUMERIC
) AS $$
DECLARE
  v_item JSONB;
  v_inventory_id UUID;
  v_product_id UUID;
  v_variant_template_id UUID;
  v_location_id UUID;
  v_requested_qty NUMERIC;
  v_current_qty NUMERIC;
  v_held_qty NUMERIC;
  v_available_qty NUMERIC;
  v_hold_id UUID;

  -- Variant conversion variables
  v_parent_product_id UUID;
  v_parent_inventory_id UUID;
  v_parent_current_qty NUMERIC;
  v_parent_held_qty NUMERIC;
  v_parent_available_qty NUMERIC;
  v_conversion_ratio NUMERIC;
  v_share_parent_inventory BOOLEAN;
  v_parent_qty_needed NUMERIC;
  v_variant_name TEXT;

  -- Hold expiration (15 minutes for checkout)
  v_hold_expires_at TIMESTAMPTZ := NOW() + INTERVAL '15 minutes';
BEGIN
  -- Loop through each item in the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventoryId')::UUID;
    v_product_id := (v_item->>'productId')::UUID;
    v_variant_template_id := (v_item->>'variantTemplateId')::UUID;

    -- Use gramsToDeduct (for weight tiers) or quantity (for unit tiers)
    v_requested_qty := COALESCE(
      (v_item->>'gramsToDeduct')::NUMERIC,
      (v_item->>'quantity')::NUMERIC
    );

    -- Skip if no inventory tracking for this item
    IF v_inventory_id IS NULL AND v_variant_template_id IS NULL THEN
      CONTINUE;
    END IF;

    -- ========================================================================
    -- VARIANT CONVERSION LOGIC (Using Templates)
    -- ========================================================================
    IF v_variant_template_id IS NOT NULL THEN
      -- Get variant configuration (template + product overrides)
      SELECT
        pv.conversion_ratio,
        pv.share_parent_inventory,
        cvt.variant_name,
        p.id AS parent_prod_id
      INTO v_conversion_ratio, v_share_parent_inventory, v_variant_name, v_parent_product_id
      FROM v_product_variants pv
      INNER JOIN category_variant_templates cvt ON cvt.id = pv.variant_template_id
      INNER JOIN products p ON p.id = pv.product_id
      WHERE pv.variant_template_id = v_variant_template_id
        AND pv.product_id = v_product_id
        AND pv.is_enabled = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant template % not found or not enabled for product %',
          v_variant_template_id, v_product_id;
      END IF;

      -- Try to use variant's own inventory first (if it exists)
      IF v_inventory_id IS NOT NULL THEN
        SELECT i.id, i.product_id, i.location_id, i.quantity
        INTO v_inventory_id, v_product_id, v_location_id, v_current_qty
        FROM inventory i
        WHERE i.id = v_inventory_id
        FOR UPDATE; -- ATOMIC LOCK

        IF v_inventory_id IS NOT NULL THEN
          -- Calculate held quantity (exclude expired holds)
          SELECT COALESCE(SUM(ih.quantity), 0)
          INTO v_held_qty
          FROM inventory_holds ih
          WHERE ih.inventory_id = v_inventory_id
            AND ih.released_at IS NULL
            AND (ih.expires_at IS NULL OR ih.expires_at > NOW())
            AND ih.order_id != p_order_id;

          v_available_qty := v_current_qty - v_held_qty;
        END IF;
      END IF;

      -- If variant doesn't have enough stock AND shares parent inventory
      IF (v_available_qty IS NULL OR v_available_qty < v_requested_qty) AND v_share_parent_inventory = true THEN
        -- Get parent product's inventory
        SELECT i.id, i.quantity
        INTO v_parent_inventory_id, v_parent_current_qty
        FROM inventory i
        WHERE i.product_id = v_parent_product_id
          AND i.location_id = (
            SELECT location_id FROM inventory WHERE id = v_inventory_id
          )
        FOR UPDATE;

        IF v_parent_inventory_id IS NOT NULL THEN
          -- Calculate parent's held quantity (exclude expired holds)
          SELECT COALESCE(SUM(ih.quantity), 0)
          INTO v_parent_held_qty
          FROM inventory_holds ih
          WHERE ih.inventory_id = v_parent_inventory_id
            AND ih.released_at IS NULL
            AND (ih.expires_at IS NULL OR ih.expires_at > NOW())
            AND ih.order_id != p_order_id;

          v_parent_available_qty := v_parent_current_qty - v_parent_held_qty;

          -- Calculate how much parent inventory we need
          v_parent_qty_needed := v_requested_qty * v_conversion_ratio;

          IF v_parent_available_qty >= v_parent_qty_needed THEN
            -- Use parent inventory instead
            v_inventory_id := v_parent_inventory_id;
            v_requested_qty := v_parent_qty_needed;
            v_available_qty := v_parent_available_qty;
          ELSE
            RAISE EXCEPTION 'Insufficient inventory for variant conversion. Parent available: %, Needed: %',
              v_parent_available_qty, v_parent_qty_needed;
          END IF;
        END IF;
      ELSIF v_available_qty < v_requested_qty THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Requested: %',
          COALESCE(v_available_qty, 0),
          v_requested_qty;
      END IF;

    ELSE
      -- ======================================================================
      -- REGULAR PRODUCT (NON-VARIANT)
      -- ======================================================================
      SELECT i.id, i.product_id, i.location_id, i.quantity
      INTO v_inventory_id, v_product_id, v_location_id, v_current_qty
      FROM inventory i
      WHERE i.id = v_inventory_id
      FOR UPDATE; -- ATOMIC LOCK

      IF v_inventory_id IS NULL THEN
        RAISE EXCEPTION 'Inventory record not found';
      END IF;

      -- Calculate held quantity (exclude expired holds)
      SELECT COALESCE(SUM(ih.quantity), 0)
      INTO v_held_qty
      FROM inventory_holds ih
      WHERE ih.inventory_id = v_inventory_id
        AND ih.released_at IS NULL
        AND (ih.expires_at IS NULL OR ih.expires_at > NOW())
        AND ih.order_id != p_order_id;

      v_available_qty := v_current_qty - v_held_qty;

      -- Check availability
      IF v_available_qty < v_requested_qty THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Requested: %',
          v_available_qty, v_requested_qty;
      END IF;
    END IF;

    -- ========================================================================
    -- CREATE HOLD (ATOMIC) - NOW WITH expires_at!
    -- ========================================================================
    INSERT INTO inventory_holds (
      order_id,
      inventory_id,
      product_id,
      location_id,
      quantity,
      expires_at,  -- ← ADDED: Checkout holds expire after 15 minutes
      metadata,
      created_at
    )
    VALUES (
      p_order_id,
      v_inventory_id,
      v_product_id,
      v_location_id,
      v_requested_qty,
      v_hold_expires_at,  -- ← ADDED: NOW() + 15 minutes
      CASE
        WHEN v_variant_template_id IS NOT NULL AND v_parent_inventory_id IS NOT NULL
        THEN jsonb_build_object(
          'conversion_from_parent', true,
          'conversion_ratio', v_conversion_ratio,
          'variant_template_id', v_variant_template_id,
          'variant_name', v_variant_name
        )
        ELSE '{}'
      END,
      NOW()
    )
    ON CONFLICT (order_id, inventory_id)
    WHERE released_at IS NULL
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      expires_at = EXCLUDED.expires_at,  -- ← ADDED: Update expiration on conflict
      metadata = EXCLUDED.metadata,
      created_at = EXCLUDED.created_at
    RETURNING id INTO v_hold_id;

    -- Return hold info
    RETURN QUERY SELECT
      v_hold_id,
      v_inventory_id,
      v_product_id,
      v_requested_qty,
      v_available_qty;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update inventory_with_holds view to handle NULL expires_at gracefully
-- (treat NULL as "never expires" for backwards compatibility with old holds)
CREATE OR REPLACE VIEW inventory_with_holds AS
SELECT
  i.id,
  i.product_id,
  i.location_id,
  i.vendor_id,
  i.quantity AS total_quantity,
  COALESCE(h.held_quantity, 0) AS held_quantity,
  GREATEST(0, i.quantity - COALESCE(h.held_quantity, 0)) AS available_quantity,
  i.created_at,
  i.updated_at
FROM inventory i
LEFT JOIN (
  SELECT
    inventory_id,
    SUM(quantity) AS held_quantity
  FROM inventory_holds
  WHERE
    released_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())  -- Handle both NULL and future expires_at
  GROUP BY inventory_id
) h ON h.inventory_id = i.id;

COMMENT ON FUNCTION reserve_inventory IS
'Reserves inventory for an order by creating holds.
Holds now expire after 15 minutes if not released, preventing stale holds.
If payment succeeds, call release_inventory_holds with completed.
If payment fails, call release_inventory_holds with payment_failed.
Even if release fails, holds auto-expire and are ignored by inventory_with_holds view.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO service_role;
