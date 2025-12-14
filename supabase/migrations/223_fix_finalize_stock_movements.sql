-- Fix finalize_inventory_holds - add quantity_before/after to stock_movements

DROP FUNCTION IF EXISTS finalize_inventory_holds(uuid);

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
  v_qty_before NUMERIC;
  v_qty_after NUMERIC;
  v_variant_qty_before NUMERIC;
  v_variant_qty_after NUMERIC;
BEGIN
  -- Process each hold for this order
  FOR v_hold IN
    SELECT ih.*, i.product_id, i.location_id, i.quantity as parent_quantity
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
        -- Get current variant quantity before update
        SELECT quantity INTO v_variant_qty_before
        FROM variant_inventory
        WHERE product_id = v_hold.product_id
          AND variant_template_id = v_variant_template_id
          AND location_id = v_hold.location_id;

        v_variant_qty_before := COALESCE(v_variant_qty_before, 0);
        v_variant_qty_after := v_variant_qty_before - LEAST(v_variant_qty_from_stock, v_variant_qty_requested);

        UPDATE variant_inventory
        SET quantity = v_variant_qty_after,
            updated_at = NOW()
        WHERE product_id = v_hold.product_id
          AND variant_template_id = v_variant_template_id
          AND location_id = v_hold.location_id;

        -- Record variant sale movement with quantity_before/after
        INSERT INTO stock_movements (
          product_id, location_id, quantity_change, movement_type,
          reference_type, reference_id, notes, quantity_before, quantity_after, vendor_id
        ) VALUES (
          v_hold.product_id, v_hold.location_id,
          -LEAST(v_variant_qty_from_stock, v_variant_qty_requested),
          'sale', 'variant_sale', p_order_id,
          format('Variant sale: %s units from variant stock', LEAST(v_variant_qty_from_stock, v_variant_qty_requested)),
          v_variant_qty_before, v_variant_qty_after, v_vendor_id
        );
      END IF;

      -- STEP 2: Auto-convert from parent if needed
      IF v_will_auto_convert AND v_parent_qty_to_convert > 0 THEN
        -- Get current parent quantity
        v_qty_before := v_hold.parent_quantity;
        v_qty_after := v_qty_before - v_parent_qty_to_convert;

        -- Deduct from parent inventory
        UPDATE inventory
        SET quantity = v_qty_after,
            updated_at = NOW()
        WHERE id = v_hold.inventory_id;

        -- Record conversion movement
        INSERT INTO stock_movements (
          product_id, location_id, quantity_change, movement_type,
          reference_type, reference_id, notes, quantity_before, quantity_after, vendor_id
        ) VALUES (
          v_hold.product_id, v_hold.location_id,
          -v_parent_qty_to_convert,
          'conversion_out', 'auto_convert_for_sale', p_order_id,
          format('Auto-convert for sale: %sg parent -> variant units', v_parent_qty_to_convert),
          v_qty_before, v_qty_after, v_vendor_id
        );
      END IF;

      -- Mark hold as released (completed)
      UPDATE inventory_holds
      SET released_at = NOW(),
          metadata = v_hold.metadata || jsonb_build_object('finalized', TRUE, 'finalized_at', NOW())
      WHERE id = v_hold.id;

    ELSE
      -- REGULAR PRODUCT: Standard deduction from inventory
      -- Get current quantity
      SELECT quantity INTO v_qty_before FROM inventory WHERE id = v_hold.inventory_id;
      v_qty_after := v_qty_before - v_hold.quantity;

      UPDATE inventory
      SET quantity = v_qty_after,
          updated_at = NOW()
      WHERE id = v_hold.inventory_id;

      -- Get vendor_id for regular products
      SELECT vendor_id INTO v_vendor_id FROM products WHERE id = v_hold.product_id;

      -- Record sale movement
      INSERT INTO stock_movements (
        product_id, location_id, quantity_change, movement_type,
        reference_type, reference_id, notes, quantity_before, quantity_after, vendor_id
      ) VALUES (
        v_hold.product_id, v_hold.location_id,
        -v_hold.quantity,
        'sale', 'order', p_order_id,
        format('Sale: %s units', v_hold.quantity),
        v_qty_before, v_qty_after, v_vendor_id
      );

      -- Mark hold as released
      UPDATE inventory_holds
      SET released_at = NOW()
      WHERE id = v_hold.id;
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO service_role;
