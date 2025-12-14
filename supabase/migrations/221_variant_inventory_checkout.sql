-- ============================================================================
-- MIGRATION 221: VARIANT INVENTORY CHECKOUT INTEGRATION
-- ============================================================================
-- Updates reserve_inventory and finalize_inventory_holds to properly handle
-- variant_inventory table with smart auto-convert from parent stock
-- ============================================================================

-- ============================================================================
-- 1. UPDATE reserve_inventory to check variant_inventory FIRST
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

  -- Variant inventory variables
  v_variant_inventory_id UUID;
  v_variant_qty NUMERIC;
  v_variant_available NUMERIC;
  v_conversion_ratio NUMERIC;
  v_variant_name TEXT;
  v_vendor_id UUID;

  -- Parent inventory (for auto-convert)
  v_parent_inventory_id UUID;
  v_parent_current_qty NUMERIC;
  v_parent_held_qty NUMERIC;
  v_parent_available_qty NUMERIC;
  v_parent_qty_needed NUMERIC;
  v_shortfall NUMERIC;
  v_will_auto_convert BOOLEAN := FALSE;

  -- Hold expiration (15 minutes for checkout)
  v_hold_expires_at TIMESTAMPTZ := NOW() + INTERVAL '15 minutes';
BEGIN
  -- Loop through each item in the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventoryId')::UUID;
    v_product_id := (v_item->>'productId')::UUID;
    v_variant_template_id := (v_item->>'variantTemplateId')::UUID;
    v_location_id := (v_item->>'locationId')::UUID;
    v_will_auto_convert := FALSE;

    -- Use tierQty (preferred) or gramsToDeduct (legacy) or quantity
    v_requested_qty := COALESCE(
      (v_item->>'tierQty')::NUMERIC,
      (v_item->>'gramsToDeduct')::NUMERIC,
      (v_item->>'quantity')::NUMERIC
    );

    -- Skip if no inventory tracking
    IF v_inventory_id IS NULL AND v_variant_template_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Get location_id from inventory if not provided
    IF v_location_id IS NULL AND v_inventory_id IS NOT NULL THEN
      SELECT i.location_id INTO v_location_id FROM inventory i WHERE i.id = v_inventory_id;
    END IF;

    -- ========================================================================
    -- VARIANT INVENTORY HANDLING (NEW: Uses variant_inventory table)
    -- ========================================================================
    IF v_variant_template_id IS NOT NULL THEN
      -- Get variant configuration
      SELECT cvt.conversion_ratio, cvt.variant_name
      INTO v_conversion_ratio, v_variant_name
      FROM category_variant_templates cvt
      WHERE cvt.id = v_variant_template_id;

      IF v_conversion_ratio IS NULL THEN
        RAISE EXCEPTION 'Variant template % not found', v_variant_template_id;
      END IF;

      -- Get vendor_id from product
      SELECT vendor_id INTO v_vendor_id FROM products WHERE id = v_product_id;

      -- CHECK VARIANT_INVENTORY TABLE FIRST
      SELECT vi.id, vi.quantity
      INTO v_variant_inventory_id, v_variant_qty
      FROM variant_inventory vi
      WHERE vi.product_id = v_product_id
        AND vi.variant_template_id = v_variant_template_id
        AND vi.location_id = v_location_id
      FOR UPDATE;

      v_variant_qty := COALESCE(v_variant_qty, 0);
      v_variant_available := v_variant_qty; -- TODO: subtract variant holds if we add them

      -- Get parent inventory for potential auto-convert
      SELECT i.id, i.quantity
      INTO v_parent_inventory_id, v_parent_current_qty
      FROM inventory i
      WHERE i.product_id = v_product_id AND i.location_id = v_location_id
      FOR UPDATE;

      -- Calculate parent available (subtract existing holds)
      SELECT COALESCE(SUM(ih.quantity), 0)
      INTO v_parent_held_qty
      FROM inventory_holds ih
      WHERE ih.inventory_id = v_parent_inventory_id
        AND ih.released_at IS NULL
        AND (ih.expires_at IS NULL OR ih.expires_at > NOW())
        AND ih.order_id != p_order_id;

      v_parent_available_qty := COALESCE(v_parent_current_qty, 0) - v_parent_held_qty;

      -- DECISION: Use variant stock, auto-convert, or fail
      IF v_variant_available >= v_requested_qty THEN
        -- CASE 1: Enough variant stock - use it directly
        -- Create hold on parent inventory (we'll deduct variant at finalize)
        -- Store variant info in metadata for finalize
        v_inventory_id := v_parent_inventory_id;
        v_available_qty := v_variant_available;
        v_will_auto_convert := FALSE;

      ELSIF v_variant_available > 0 THEN
        -- CASE 2: Some variant stock - use it + auto-convert remainder
        v_shortfall := v_requested_qty - v_variant_available;
        v_parent_qty_needed := v_shortfall * v_conversion_ratio;

        IF v_parent_available_qty >= v_parent_qty_needed THEN
          v_inventory_id := v_parent_inventory_id;
          v_requested_qty := v_parent_qty_needed; -- Hold parent for conversion only
          v_available_qty := v_parent_available_qty;
          v_will_auto_convert := TRUE;
        ELSE
          RAISE EXCEPTION 'Insufficient stock for %. Need % units, have % variant + %g parent (need %g parent for conversion)',
            v_variant_name, v_requested_qty, v_variant_available, v_parent_available_qty, v_parent_qty_needed;
        END IF;

      ELSE
        -- CASE 3: No variant stock - full auto-convert from parent
        v_parent_qty_needed := v_requested_qty * v_conversion_ratio;

        IF v_parent_available_qty >= v_parent_qty_needed THEN
          v_inventory_id := v_parent_inventory_id;
          v_requested_qty := v_parent_qty_needed;
          v_available_qty := v_parent_available_qty;
          v_will_auto_convert := TRUE;
        ELSE
          RAISE EXCEPTION 'Insufficient stock for %. Need %g parent for % units (have %g available)',
            v_variant_name, v_parent_qty_needed, v_requested_qty, v_parent_available_qty;
        END IF;
      END IF;

      -- Create hold with variant metadata
      INSERT INTO inventory_holds (
        order_id, inventory_id, product_id, location_id, quantity,
        expires_at, metadata, created_at
      )
      VALUES (
        p_order_id, v_inventory_id, v_product_id, v_location_id, v_requested_qty,
        v_hold_expires_at,
        jsonb_build_object(
          'is_variant_sale', TRUE,
          'variant_template_id', v_variant_template_id,
          'variant_name', v_variant_name,
          'variant_qty_requested', (v_item->>'tierQty')::NUMERIC,
          'variant_qty_from_stock', v_variant_available,
          'will_auto_convert', v_will_auto_convert,
          'conversion_ratio', v_conversion_ratio,
          'parent_qty_to_convert', CASE WHEN v_will_auto_convert THEN v_requested_qty ELSE 0 END
        ),
        NOW()
      )
      ON CONFLICT (order_id, inventory_id)
      WHERE released_at IS NULL
      DO UPDATE SET
        quantity = inventory_holds.quantity + EXCLUDED.quantity,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata,
        created_at = EXCLUDED.created_at
      RETURNING id INTO v_hold_id;

      RETURN QUERY SELECT v_hold_id, v_inventory_id, v_product_id, v_requested_qty, v_available_qty;

    ELSE
      -- ======================================================================
      -- REGULAR PRODUCT (NON-VARIANT) - Standard handling
      -- ======================================================================
      SELECT i.id, i.product_id, i.location_id, i.quantity
      INTO v_inventory_id, v_product_id, v_location_id, v_current_qty
      FROM inventory i
      WHERE i.id = v_inventory_id
      FOR UPDATE;

      IF v_inventory_id IS NULL THEN
        RAISE EXCEPTION 'Inventory record not found';
      END IF;

      -- Calculate held quantity
      SELECT COALESCE(SUM(ih.quantity), 0)
      INTO v_held_qty
      FROM inventory_holds ih
      WHERE ih.inventory_id = v_inventory_id
        AND ih.released_at IS NULL
        AND (ih.expires_at IS NULL OR ih.expires_at > NOW())
        AND ih.order_id != p_order_id;

      v_available_qty := v_current_qty - v_held_qty;

      IF v_available_qty < v_requested_qty THEN
        RAISE EXCEPTION 'Insufficient inventory. Available: %, Requested: %', v_available_qty, v_requested_qty;
      END IF;

      -- Create hold
      INSERT INTO inventory_holds (
        order_id, inventory_id, product_id, location_id, quantity,
        expires_at, metadata, created_at
      )
      VALUES (
        p_order_id, v_inventory_id, v_product_id, v_location_id, v_requested_qty,
        v_hold_expires_at, '{}'::jsonb, NOW()
      )
      ON CONFLICT (order_id, inventory_id)
      WHERE released_at IS NULL
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        expires_at = EXCLUDED.expires_at,
        created_at = EXCLUDED.created_at
      RETURNING id INTO v_hold_id;

      RETURN QUERY SELECT v_hold_id, v_inventory_id, v_product_id, v_requested_qty, v_available_qty;
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. UPDATE finalize_inventory_holds to deduct from variant_inventory
-- ============================================================================
CREATE OR REPLACE FUNCTION finalize_inventory_holds(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_hold RECORD;
  v_variant_template_id UUID;
  v_variant_qty_requested NUMERIC;
  v_variant_qty_from_stock NUMERIC;
  v_will_auto_convert BOOLEAN;
  v_conversion_ratio NUMERIC;
  v_parent_qty_to_convert NUMERIC;
  v_vendor_id UUID;
BEGIN
  -- Process each hold for this order
  FOR v_hold IN
    SELECT ih.*, i.product_id, i.location_id
    FROM inventory_holds ih
    JOIN inventory i ON i.id = ih.inventory_id
    WHERE ih.order_id = p_order_id
      AND ih.released_at IS NULL
      AND (ih.expires_at IS NULL OR ih.expires_at > NOW())
    FOR UPDATE OF ih
  LOOP
    -- Check if this is a variant sale
    IF (v_hold.metadata->>'is_variant_sale')::BOOLEAN = TRUE THEN
      -- Extract variant sale metadata
      v_variant_template_id := (v_hold.metadata->>'variant_template_id')::UUID;
      v_variant_qty_requested := (v_hold.metadata->>'variant_qty_requested')::NUMERIC;
      v_variant_qty_from_stock := COALESCE((v_hold.metadata->>'variant_qty_from_stock')::NUMERIC, 0);
      v_will_auto_convert := COALESCE((v_hold.metadata->>'will_auto_convert')::BOOLEAN, FALSE);
      v_conversion_ratio := COALESCE((v_hold.metadata->>'conversion_ratio')::NUMERIC, 1);
      v_parent_qty_to_convert := COALESCE((v_hold.metadata->>'parent_qty_to_convert')::NUMERIC, 0);

      -- Get vendor_id
      SELECT vendor_id INTO v_vendor_id FROM products WHERE id = v_hold.product_id;

      -- STEP 1: Deduct from variant_inventory (what we have)
      IF v_variant_qty_from_stock > 0 THEN
        UPDATE variant_inventory
        SET quantity = quantity - LEAST(v_variant_qty_from_stock, v_variant_qty_requested),
            updated_at = NOW()
        WHERE product_id = v_hold.product_id
          AND variant_template_id = v_variant_template_id
          AND location_id = v_hold.location_id;

        -- Record variant sale movement
        INSERT INTO stock_movements (
          product_id, location_id, quantity_change, movement_type,
          reference_type, reference_id, notes, performed_by
        ) VALUES (
          v_hold.product_id, v_hold.location_id,
          -LEAST(v_variant_qty_from_stock, v_variant_qty_requested),
          'sale', 'variant_sale', p_order_id,
          format('Variant sale: %s units from variant stock', LEAST(v_variant_qty_from_stock, v_variant_qty_requested)),
          NULL
        );
      END IF;

      -- STEP 2: Auto-convert from parent if needed
      IF v_will_auto_convert AND v_parent_qty_to_convert > 0 THEN
        -- Deduct from parent inventory
        UPDATE inventory
        SET quantity = quantity - v_parent_qty_to_convert,
            updated_at = NOW()
        WHERE id = v_hold.inventory_id;

        -- Calculate how many variant units we got from conversion
        DECLARE
          v_variant_units_converted NUMERIC;
        BEGIN
          v_variant_units_converted := v_variant_qty_requested - v_variant_qty_from_stock;

          -- Record conversion movement
          INSERT INTO stock_movements (
            product_id, location_id, quantity_change, movement_type,
            reference_type, reference_id, notes, performed_by
          ) VALUES (
            v_hold.product_id, v_hold.location_id,
            -v_parent_qty_to_convert,
            'conversion_out', 'auto_convert_for_sale', p_order_id,
            format('Auto-convert for sale: %sg parent -> %s variant units', v_parent_qty_to_convert, v_variant_units_converted),
            NULL
          );
        END;
      END IF;

      -- Mark hold as released (completed)
      UPDATE inventory_holds
      SET released_at = NOW(),
          metadata = v_hold.metadata || jsonb_build_object('finalized', TRUE, 'finalized_at', NOW())
      WHERE id = v_hold.id;

    ELSE
      -- REGULAR PRODUCT: Standard deduction from inventory
      UPDATE inventory
      SET quantity = quantity - v_hold.quantity,
          updated_at = NOW()
      WHERE id = v_hold.inventory_id;

      -- Record sale movement
      INSERT INTO stock_movements (
        product_id, location_id, quantity_change, movement_type,
        reference_type, reference_id, notes, performed_by
      ) VALUES (
        v_hold.product_id, v_hold.location_id,
        -v_hold.quantity,
        'sale', 'order', p_order_id,
        format('Sale: %s units', v_hold.quantity),
        NULL
      );

      -- Mark hold as released
      UPDATE inventory_holds
      SET released_at = NOW()
      WHERE id = v_hold.id;
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. Helper: Get combined variant availability (variant + convertible parent)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_variant_total_available(
  p_product_id UUID,
  p_variant_template_id UUID,
  p_location_id UUID
) RETURNS TABLE (
  variant_available NUMERIC,
  parent_available NUMERIC,
  conversion_ratio NUMERIC,
  total_available NUMERIC,
  can_auto_convert BOOLEAN
) AS $$
DECLARE
  v_variant_qty NUMERIC;
  v_parent_qty NUMERIC;
  v_parent_held NUMERIC;
  v_ratio NUMERIC;
BEGIN
  -- Get conversion ratio
  SELECT cvt.conversion_ratio INTO v_ratio
  FROM category_variant_templates cvt
  WHERE cvt.id = p_variant_template_id;
  v_ratio := COALESCE(v_ratio, 1);

  -- Get variant inventory
  SELECT COALESCE(vi.quantity, 0) INTO v_variant_qty
  FROM variant_inventory vi
  WHERE vi.product_id = p_product_id
    AND vi.variant_template_id = p_variant_template_id
    AND vi.location_id = p_location_id;
  v_variant_qty := COALESCE(v_variant_qty, 0);

  -- Get parent inventory (available = quantity - holds)
  SELECT i.quantity, COALESCE(h.held, 0)
  INTO v_parent_qty, v_parent_held
  FROM inventory i
  LEFT JOIN (
    SELECT inventory_id, SUM(quantity) as held
    FROM inventory_holds
    WHERE released_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
    GROUP BY inventory_id
  ) h ON h.inventory_id = i.id
  WHERE i.product_id = p_product_id AND i.location_id = p_location_id;

  v_parent_qty := COALESCE(v_parent_qty, 0) - COALESCE(v_parent_held, 0);

  RETURN QUERY SELECT
    v_variant_qty,
    v_parent_qty,
    v_ratio,
    v_variant_qty + FLOOR(v_parent_qty / v_ratio),
    v_parent_qty > 0 AND v_ratio > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Grant permissions
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_variant_total_available(UUID, UUID, UUID) TO authenticated;

COMMENT ON FUNCTION reserve_inventory IS
'Reserves inventory for checkout with variant support.
For variants: Checks variant_inventory first, auto-converts from parent if needed.
Stores variant metadata in hold for finalize to process correctly.';

COMMENT ON FUNCTION finalize_inventory_holds IS
'Finalizes holds by deducting inventory.
For variants: Deducts from variant_inventory and/or converts from parent.
For regular: Deducts from inventory table.';

COMMENT ON FUNCTION get_variant_total_available IS
'Returns total available variant units including potential auto-convert from parent.';
