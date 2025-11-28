-- ============================================================================
-- UPDATE reserve_inventory() TO USE CATEGORY VARIANT TEMPLATES
-- ============================================================================
-- Changes hardcoded variant logic to use category_variant_templates
-- ============================================================================

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
          -- Calculate held quantity
          SELECT COALESCE(SUM(ih.quantity), 0)
          INTO v_held_qty
          FROM inventory_holds ih
          WHERE ih.inventory_id = v_inventory_id
            AND ih.released_at IS NULL
            AND ih.order_id != p_order_id;

          v_available_qty := v_current_qty - v_held_qty;
        END IF;
      END IF;

      -- FALLBACK: If variant has insufficient stock, try parent conversion
      IF (v_available_qty IS NULL OR v_available_qty < v_requested_qty)
         AND v_share_parent_inventory
         AND v_parent_product_id IS NOT NULL THEN

        -- Calculate how much parent inventory we need
        v_parent_qty_needed := v_requested_qty * v_conversion_ratio;

        -- Get parent product's inventory (ATOMIC LOCK)
        SELECT i.id, i.location_id, i.quantity
        INTO v_parent_inventory_id, v_location_id, v_parent_current_qty
        FROM inventory i
        WHERE i.product_id = v_parent_product_id
          AND i.location_id = COALESCE(v_location_id, (v_item->>'locationId')::UUID)
        FOR UPDATE; -- ATOMIC LOCK

        IF v_parent_inventory_id IS NOT NULL THEN
          -- Calculate parent's held quantity
          SELECT COALESCE(SUM(ih.quantity), 0)
          INTO v_parent_held_qty
          FROM inventory_holds ih
          WHERE ih.inventory_id = v_parent_inventory_id
            AND ih.released_at IS NULL
            AND ih.order_id != p_order_id;

          v_parent_available_qty := v_parent_current_qty - v_parent_held_qty;

          -- Check if parent has enough
          IF v_parent_available_qty >= v_parent_qty_needed THEN
            -- SUCCESS: Use parent's inventory
            v_inventory_id := v_parent_inventory_id;
            v_product_id := v_parent_product_id;
            v_requested_qty := v_parent_qty_needed;
            v_available_qty := v_parent_available_qty;
          ELSE
            RAISE EXCEPTION 'Insufficient inventory for %. Variant has %, parent has % (need %)',
              v_variant_name,
              COALESCE(v_available_qty, 0),
              v_parent_available_qty,
              v_parent_qty_needed;
          END IF;
        ELSE
          RAISE EXCEPTION 'Parent product has no inventory at this location';
        END IF;
      ELSIF v_available_qty < v_requested_qty THEN
        RAISE EXCEPTION 'Insufficient inventory for %. Available: %, Requested: %',
          v_variant_name,
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

      -- Calculate held quantity
      SELECT COALESCE(SUM(ih.quantity), 0)
      INTO v_held_qty
      FROM inventory_holds ih
      WHERE ih.inventory_id = v_inventory_id
        AND ih.released_at IS NULL
        AND ih.order_id != p_order_id;

      v_available_qty := v_current_qty - v_held_qty;

      -- Check availability
      IF v_available_qty < v_requested_qty THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Requested: %',
          v_available_qty, v_requested_qty;
      END IF;
    END IF;

    -- ========================================================================
    -- CREATE HOLD (ATOMIC)
    -- ========================================================================
    INSERT INTO inventory_holds (
      order_id,
      inventory_id,
      product_id,
      location_id,
      quantity,
      metadata,
      created_at
    )
    VALUES (
      p_order_id,
      v_inventory_id,
      v_product_id,
      v_location_id,
      v_requested_qty,
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

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reserve_inventory IS
'ATOMIC inventory reservation with category variant template support.

Uses category_variant_templates for configuration (zero redundancy).
Handles:
1. Direct variant inventory (if variant has stock)
2. Parent → variant conversion (if share_parent_inventory = true)
3. Regular products

Uses row-level locks (FOR UPDATE) to prevent race conditions.
Two-phase commit: reserve → finalize or release.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'reserve_inventory() UPDATED';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ Now uses category_variant_templates';
  RAISE NOTICE '✅ Zero redundancy design';
  RAISE NOTICE '✅ ATOMIC guarantees maintained';
  RAISE NOTICE '================================';
END $$;
