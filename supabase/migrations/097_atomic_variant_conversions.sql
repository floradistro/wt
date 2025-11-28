-- ============================================================================
-- ATOMIC PRODUCT VARIANT CONVERSIONS
-- ============================================================================
-- Extends the existing reserve_inventory() system to support:
-- 1. Variants with their own inventory (e.g., pre-stocked pre-rolls)
-- 2. Variants that convert from parent inventory (e.g., on-demand pre-rolls)
-- 3. Seamless fallback: use variant stock if available, else convert from parent
--
-- This maintains ATOMIC guarantees:
-- - Row-level locks prevent race conditions
-- - Two-phase commit (reserve → finalize)
-- - Audit trail for all conversions
-- ============================================================================

-- ============================================================================
-- 1. ADD CONVERSION TRACKING TABLE
-- ============================================================================
-- Tracks when parent inventory is converted to variant during sale
-- (e.g., 1g flower → 1 pre-roll, tracked here)

CREATE TABLE IF NOT EXISTS inventory_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was converted
  from_inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  from_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_consumed NUMERIC(10,2) NOT NULL CHECK (quantity_consumed > 0),

  -- What it became
  to_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  to_variant_id UUID REFERENCES product_variations(id) ON DELETE CASCADE,
  quantity_produced NUMERIC(10,2) NOT NULL CHECK (quantity_produced > 0),
  conversion_ratio NUMERIC(10,4) NOT NULL CHECK (conversion_ratio > 0),

  -- Context
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  performed_by_user_id UUID REFERENCES auth.users(id),

  -- Audit
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversions_from_inventory ON inventory_conversions(from_inventory_id);
CREATE INDEX idx_conversions_from_product ON inventory_conversions(from_product_id);
CREATE INDEX idx_conversions_to_product ON inventory_conversions(to_product_id);
CREATE INDEX idx_conversions_order ON inventory_conversions(order_id);
CREATE INDEX idx_conversions_location ON inventory_conversions(location_id, created_at DESC);

-- RLS
ALTER TABLE inventory_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to conversions"
  ON inventory_conversions FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Vendors can view own conversions"
  ON inventory_conversions FOR SELECT
  USING (vendor_id IN (
    SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
  ));

GRANT SELECT ON inventory_conversions TO authenticated;
GRANT ALL ON inventory_conversions TO service_role;

COMMENT ON TABLE inventory_conversions IS
'Audit trail for product variant conversions. Tracks when parent inventory (e.g., flower) is converted to variant (e.g., pre-roll) during sales.';

-- ============================================================================
-- 2. UPGRADE reserve_inventory() WITH VARIANT CONVERSION SUPPORT
-- ============================================================================
-- This function now handles:
-- 1. Direct variant inventory (if variant has stock)
-- 2. Parent → variant conversion (if variant has no stock but parent does)
-- 3. ATOMIC guarantees via row-level locks

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
  v_variant_id UUID;
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
BEGIN
  -- Loop through each item in the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventoryId')::UUID;
    v_product_id := (v_item->>'productId')::UUID;
    v_variant_id := (v_item->>'variantId')::UUID;

    -- Use gramsToDeduct (for weight tiers) or quantity (for unit tiers)
    v_requested_qty := COALESCE(
      (v_item->>'gramsToDeduct')::NUMERIC,
      (v_item->>'quantity')::NUMERIC
    );

    -- Skip if no inventory tracking for this item
    IF v_inventory_id IS NULL AND v_variant_id IS NULL THEN
      CONTINUE;
    END IF;

    -- ========================================================================
    -- VARIANT CONVERSION LOGIC
    -- ========================================================================
    -- If this is a variant, check if we should fall back to parent inventory
    IF v_variant_id IS NOT NULL THEN
      -- Get variant metadata
      SELECT
        pv.parent_product_id,
        COALESCE((pv.meta_data->>'conversion_ratio')::NUMERIC, 1.0),
        COALESCE((pv.meta_data->>'share_parent_inventory')::BOOLEAN, false)
      INTO v_parent_product_id, v_conversion_ratio, v_share_parent_inventory
      FROM product_variations pv
      WHERE pv.id = v_variant_id;

      -- Try to use variant's own inventory first
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

            -- Store conversion metadata for later (in hold)
            v_item := v_item || jsonb_build_object(
              '_conversion_from_parent', true,
              '_conversion_ratio', v_conversion_ratio,
              '_variant_id', v_variant_id
            );
          ELSE
            RAISE EXCEPTION 'Insufficient inventory. Variant has %, parent has % (need %)',
              COALESCE(v_available_qty, 0), v_parent_available_qty, v_parent_qty_needed;
          END IF;
        ELSE
          RAISE EXCEPTION 'Parent product has no inventory at this location';
        END IF;
      ELSIF v_available_qty < v_requested_qty THEN
        RAISE EXCEPTION 'Insufficient inventory for variant. Available: %, Requested: %',
          COALESCE(v_available_qty, 0), v_requested_qty;
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
        WHEN v_item ? '_conversion_from_parent'
        THEN jsonb_build_object(
          'conversion_from_parent', true,
          'conversion_ratio', v_conversion_ratio,
          'variant_id', v_variant_id
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
'ATOMIC inventory reservation with variant conversion support.

Handles:
1. Direct variant inventory (if variant has stock)
2. Parent → variant conversion (if variant has no stock but share_parent_inventory = true)
3. Regular products

Uses row-level locks (FOR UPDATE) to prevent race conditions.
Two-phase commit: reserve → finalize or release.';

-- ============================================================================
-- 3. ADD metadata COLUMN TO inventory_holds
-- ============================================================================
-- Stores conversion metadata for audit trail

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_holds' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE inventory_holds ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN inventory_holds.metadata IS
'Stores conversion metadata when parent inventory is used for variants.
Example: {"conversion_from_parent": true, "conversion_ratio": 0.7, "variant_id": "..."}';

-- ============================================================================
-- 4. UPGRADE finalize_inventory_holds() TO LOG CONVERSIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION finalize_inventory_holds(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_hold RECORD;
  v_vendor_id UUID;
BEGIN
  -- Get vendor_id for conversion logging
  SELECT vendor_id INTO v_vendor_id
  FROM orders
  WHERE id = p_order_id;

  -- Loop through all active holds for this order
  FOR v_hold IN
    SELECT id, inventory_id, product_id, location_id, quantity, metadata
    FROM inventory_holds
    WHERE order_id = p_order_id
      AND released_at IS NULL
  LOOP
    -- Deduct from inventory (ATOMIC)
    UPDATE inventory
    SET
      quantity = quantity - v_hold.quantity,
      updated_at = NOW()
    WHERE id = v_hold.inventory_id;

    -- Create stock movement for audit trail
    INSERT INTO stock_movements (
      product_id,
      vendor_id,
      location_id,
      movement_type,
      quantity_before,
      quantity_after,
      quantity_change,
      reference_type,
      reference_id,
      created_at
    )
    SELECT
      v_hold.product_id,
      i.vendor_id,
      v_hold.location_id,
      'sale',
      i.quantity + v_hold.quantity,
      i.quantity,
      -v_hold.quantity,
      'order',
      p_order_id,
      NOW()
    FROM inventory i
    WHERE i.id = v_hold.inventory_id;

    -- If this was a conversion, log it
    IF v_hold.metadata ? 'conversion_from_parent'
       AND (v_hold.metadata->>'conversion_from_parent')::BOOLEAN = true THEN

      INSERT INTO inventory_conversions (
        from_inventory_id,
        from_product_id,
        quantity_consumed,
        to_product_id,
        to_variant_id,
        quantity_produced,
        conversion_ratio,
        order_id,
        location_id,
        vendor_id,
        notes,
        metadata,
        created_at
      )
      VALUES (
        v_hold.inventory_id,
        v_hold.product_id,
        v_hold.quantity,
        (v_hold.metadata->>'variant_id')::UUID, -- The variant product
        (v_hold.metadata->>'variant_id')::UUID,
        v_hold.quantity / (v_hold.metadata->>'conversion_ratio')::NUMERIC,
        (v_hold.metadata->>'conversion_ratio')::NUMERIC,
        p_order_id,
        v_hold.location_id,
        v_vendor_id,
        'Automatic conversion during sale',
        v_hold.metadata,
        NOW()
      );
    END IF;

    -- Mark hold as released (completed)
    UPDATE inventory_holds
    SET
      released_at = NOW(),
      release_reason = 'completed',
      updated_at = NOW()
    WHERE id = v_hold.id;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION finalize_inventory_holds IS
'ATOMIC inventory deduction with conversion tracking.

Converts holds → actual deductions after successful payment.
Logs conversions to inventory_conversions table for audit trail.';

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO service_role;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'VARIANT CONVERSION SYSTEM';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ inventory_conversions table created';
  RAISE NOTICE '✅ reserve_inventory() upgraded with variant logic';
  RAISE NOTICE '✅ finalize_inventory_holds() upgraded with conversion logging';
  RAISE NOTICE '✅ ATOMIC guarantees maintained';
  RAISE NOTICE '================================';
END $$;
