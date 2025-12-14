-- =====================================================
-- MIGRATION 220: VARIANT INVENTORY SALES
-- =====================================================
-- Adds support for selling from variant inventory with smart auto-convert
-- When variant stock is insufficient, automatically converts parent stock

-- =====================================================
-- 1. SELL FROM VARIANT INVENTORY (with smart auto-convert)
-- =====================================================
CREATE OR REPLACE FUNCTION sell_variant_inventory(
  p_product_id UUID,
  p_variant_template_id UUID,
  p_location_id UUID,
  p_quantity_to_sell NUMERIC,
  p_order_id UUID DEFAULT NULL,
  p_performed_by_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  variant_quantity_sold NUMERIC,
  parent_quantity_converted NUMERIC,
  new_variant_quantity NUMERIC,
  new_parent_quantity NUMERIC,
  auto_converted BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_vendor_id UUID;
  v_current_variant_qty NUMERIC;
  v_current_parent_qty NUMERIC;
  v_conversion_ratio NUMERIC;
  v_shortfall NUMERIC;
  v_parent_needed NUMERIC;
  v_variant_created NUMERIC;
  v_inventory_id UUID;
  v_variant_inventory_id UUID;
BEGIN
  -- Get vendor_id from product
  SELECT vendor_id INTO v_vendor_id
  FROM products
  WHERE id = p_product_id;

  IF v_vendor_id IS NULL THEN
    RETURN QUERY SELECT
      FALSE, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, FALSE,
      'Product not found'::TEXT;
    RETURN;
  END IF;

  -- Get conversion ratio from variant template
  SELECT conversion_ratio INTO v_conversion_ratio
  FROM category_variant_templates
  WHERE id = p_variant_template_id;

  IF v_conversion_ratio IS NULL OR v_conversion_ratio <= 0 THEN
    RETURN QUERY SELECT
      FALSE, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, FALSE,
      'Invalid variant template or conversion ratio'::TEXT;
    RETURN;
  END IF;

  -- Get current variant inventory (or create if doesn't exist)
  SELECT id, quantity INTO v_variant_inventory_id, v_current_variant_qty
  FROM variant_inventory
  WHERE product_id = p_product_id
    AND variant_template_id = p_variant_template_id
    AND location_id = p_location_id;

  IF v_variant_inventory_id IS NULL THEN
    -- Create variant inventory record with 0 stock
    INSERT INTO variant_inventory (product_id, variant_template_id, location_id, vendor_id, quantity)
    VALUES (p_product_id, p_variant_template_id, p_location_id, v_vendor_id, 0)
    RETURNING id, quantity INTO v_variant_inventory_id, v_current_variant_qty;
  END IF;

  v_current_variant_qty := COALESCE(v_current_variant_qty, 0);

  -- Get current parent inventory
  SELECT id, quantity INTO v_inventory_id, v_current_parent_qty
  FROM inventory
  WHERE product_id = p_product_id AND location_id = p_location_id;

  v_current_parent_qty := COALESCE(v_current_parent_qty, 0);

  -- Check if we have enough variant stock
  IF v_current_variant_qty >= p_quantity_to_sell THEN
    -- Simple case: enough variant stock, just deduct
    UPDATE variant_inventory
    SET quantity = quantity - p_quantity_to_sell,
        updated_at = NOW()
    WHERE id = v_variant_inventory_id;

    -- Record the movement
    INSERT INTO stock_movements (
      product_id, location_id, quantity_change, movement_type,
      reference_type, reference_id, notes, performed_by
    ) VALUES (
      p_product_id, p_location_id, -p_quantity_to_sell, 'sale',
      'variant_sale', p_order_id,
      'Variant sale: ' || p_quantity_to_sell || ' units',
      p_performed_by_user_id
    );

    RETURN QUERY SELECT
      TRUE,
      p_quantity_to_sell,
      0::NUMERIC,
      v_current_variant_qty - p_quantity_to_sell,
      v_current_parent_qty,
      FALSE,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Need to auto-convert: calculate shortfall
  v_shortfall := p_quantity_to_sell - v_current_variant_qty;
  v_parent_needed := v_shortfall * v_conversion_ratio;

  -- Check if we have enough parent stock to convert
  IF v_current_parent_qty < v_parent_needed THEN
    RETURN QUERY SELECT
      FALSE, 0::NUMERIC, 0::NUMERIC,
      v_current_variant_qty, v_current_parent_qty, FALSE,
      format('Insufficient stock. Need %s variant units but only have %s. Would need %sg parent stock but only have %sg',
        p_quantity_to_sell, v_current_variant_qty, v_parent_needed, v_current_parent_qty)::TEXT;
    RETURN;
  END IF;

  -- SMART AUTO-CONVERT: Convert parent to variant, then sell

  -- 1. Deduct from parent inventory
  UPDATE inventory
  SET quantity = quantity - v_parent_needed,
      updated_at = NOW()
  WHERE id = v_inventory_id;

  -- 2. Add to variant inventory (the shortfall amount)
  UPDATE variant_inventory
  SET quantity = quantity + v_shortfall,
      updated_at = NOW()
  WHERE id = v_variant_inventory_id;

  -- 3. Now deduct the full sale from variant
  UPDATE variant_inventory
  SET quantity = quantity - p_quantity_to_sell,
      updated_at = NOW()
  WHERE id = v_variant_inventory_id;

  -- Record the auto-conversion
  INSERT INTO stock_movements (
    product_id, location_id, quantity_change, movement_type,
    reference_type, reference_id, notes, performed_by
  ) VALUES (
    p_product_id, p_location_id, -v_parent_needed, 'conversion_out',
    'auto_convert_for_sale', p_order_id,
    format('Auto-convert for sale: %sg parent -> %s variant units', v_parent_needed, v_shortfall),
    p_performed_by_user_id
  );

  -- Record the sale
  INSERT INTO stock_movements (
    product_id, location_id, quantity_change, movement_type,
    reference_type, reference_id, notes, performed_by
  ) VALUES (
    p_product_id, p_location_id, -p_quantity_to_sell, 'sale',
    'variant_sale', p_order_id,
    format('Variant sale: %s units (auto-converted %s)', p_quantity_to_sell, v_shortfall),
    p_performed_by_user_id
  );

  RETURN QUERY SELECT
    TRUE,
    p_quantity_to_sell,
    v_parent_needed,
    0::NUMERIC, -- All variant stock was used
    v_current_parent_qty - v_parent_needed,
    TRUE, -- Auto-converted
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. CHECK VARIANT AVAILABILITY (for cart validation)
-- =====================================================
CREATE OR REPLACE FUNCTION check_variant_availability(
  p_product_id UUID,
  p_variant_template_id UUID,
  p_location_id UUID,
  p_quantity_needed NUMERIC
) RETURNS TABLE (
  can_fulfill BOOLEAN,
  variant_available NUMERIC,
  parent_available NUMERIC,
  would_auto_convert BOOLEAN,
  parent_needed_for_convert NUMERIC,
  conversion_ratio NUMERIC
) AS $$
DECLARE
  v_variant_qty NUMERIC;
  v_parent_qty NUMERIC;
  v_conversion_ratio NUMERIC;
  v_shortfall NUMERIC;
  v_parent_needed NUMERIC;
BEGIN
  -- Get conversion ratio
  SELECT cvt.conversion_ratio INTO v_conversion_ratio
  FROM category_variant_templates cvt
  WHERE cvt.id = p_variant_template_id;

  v_conversion_ratio := COALESCE(v_conversion_ratio, 1);

  -- Get variant inventory
  SELECT COALESCE(vi.quantity, 0) INTO v_variant_qty
  FROM variant_inventory vi
  WHERE vi.product_id = p_product_id
    AND vi.variant_template_id = p_variant_template_id
    AND vi.location_id = p_location_id;

  v_variant_qty := COALESCE(v_variant_qty, 0);

  -- Get parent inventory
  SELECT COALESCE(i.quantity, 0) INTO v_parent_qty
  FROM inventory i
  WHERE i.product_id = p_product_id AND i.location_id = p_location_id;

  v_parent_qty := COALESCE(v_parent_qty, 0);

  -- Check if we can fulfill
  IF v_variant_qty >= p_quantity_needed THEN
    -- Enough variant stock
    RETURN QUERY SELECT
      TRUE, v_variant_qty, v_parent_qty, FALSE, 0::NUMERIC, v_conversion_ratio;
  ELSE
    -- Need to check if auto-convert is possible
    v_shortfall := p_quantity_needed - v_variant_qty;
    v_parent_needed := v_shortfall * v_conversion_ratio;

    IF v_parent_qty >= v_parent_needed THEN
      -- Can fulfill via auto-convert
      RETURN QUERY SELECT
        TRUE, v_variant_qty, v_parent_qty, TRUE, v_parent_needed, v_conversion_ratio;
    ELSE
      -- Cannot fulfill
      RETURN QUERY SELECT
        FALSE, v_variant_qty, v_parent_qty, FALSE, v_parent_needed, v_conversion_ratio;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. RESERVE VARIANT INVENTORY (for checkout holds)
-- =====================================================
CREATE OR REPLACE FUNCTION reserve_variant_inventory(
  p_order_id UUID,
  p_items JSONB -- Array of {product_id, variant_template_id, location_id, quantity}
) RETURNS BOOLEAN AS $$
DECLARE
  v_item JSONB;
  v_result RECORD;
BEGIN
  -- Loop through items and check/reserve each
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Check availability (this will indicate if auto-convert needed)
    SELECT * INTO v_result FROM check_variant_availability(
      (v_item->>'product_id')::UUID,
      (v_item->>'variant_template_id')::UUID,
      (v_item->>'location_id')::UUID,
      (v_item->>'quantity')::NUMERIC
    );

    IF NOT v_result.can_fulfill THEN
      RAISE EXCEPTION 'Insufficient variant inventory for product %', v_item->>'product_id';
    END IF;

    -- Create hold record for variant
    INSERT INTO inventory_holds (
      inventory_id,
      order_id,
      quantity,
      hold_type,
      expires_at,
      metadata
    )
    SELECT
      vi.id,
      p_order_id,
      (v_item->>'quantity')::NUMERIC,
      'checkout',
      NOW() + INTERVAL '30 minutes',
      jsonb_build_object(
        'variant_template_id', v_item->>'variant_template_id',
        'would_auto_convert', v_result.would_auto_convert,
        'parent_needed', v_result.parent_needed_for_convert
      )
    FROM variant_inventory vi
    WHERE vi.product_id = (v_item->>'product_id')::UUID
      AND vi.variant_template_id = (v_item->>'variant_template_id')::UUID
      AND vi.location_id = (v_item->>'location_id')::UUID;

    -- If auto-convert needed, also hold parent inventory
    IF v_result.would_auto_convert AND v_result.parent_needed_for_convert > 0 THEN
      INSERT INTO inventory_holds (
        inventory_id,
        order_id,
        quantity,
        hold_type,
        expires_at,
        metadata
      )
      SELECT
        i.id,
        p_order_id,
        v_result.parent_needed_for_convert,
        'checkout',
        NOW() + INTERVAL '30 minutes',
        jsonb_build_object(
          'for_variant_conversion', TRUE,
          'variant_template_id', v_item->>'variant_template_id'
        )
      FROM inventory i
      WHERE i.product_id = (v_item->>'product_id')::UUID
        AND i.location_id = (v_item->>'location_id')::UUID;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sell_variant_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION check_variant_availability TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_variant_inventory TO authenticated;

-- Add index for faster variant inventory lookups
CREATE INDEX IF NOT EXISTS idx_variant_inventory_lookup
ON variant_inventory(product_id, variant_template_id, location_id);

COMMENT ON FUNCTION sell_variant_inventory IS 'Sell from variant inventory with smart auto-convert when stock is insufficient';
COMMENT ON FUNCTION check_variant_availability IS 'Check if variant sale can be fulfilled (with or without auto-convert)';
COMMENT ON FUNCTION reserve_variant_inventory IS 'Reserve variant inventory for checkout with hold records';
