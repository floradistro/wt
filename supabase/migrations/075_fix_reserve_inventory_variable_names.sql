-- ============================================================================
-- FIX RESERVE_INVENTORY - Rename variables to avoid ON CONFLICT ambiguity
-- ============================================================================
-- PostgreSQL can't distinguish between variable names and table columns in
-- ON CONFLICT clause. Solution: Rename ALL variables to have _var suffix
-- ============================================================================

DROP FUNCTION IF EXISTS reserve_inventory(UUID, JSONB);

CREATE FUNCTION reserve_inventory(
  p_order_id UUID,
  p_items JSONB
)
RETURNS TABLE (
  hold_id UUID,
  inventory_id UUID,
  product_id UUID,
  quantity NUMERIC,
  available_quantity NUMERIC
) AS $$
DECLARE
  v_item_var JSONB;
  v_inventory_id_var UUID;
  v_product_id_var UUID;
  v_location_id_var UUID;
  v_requested_qty_var NUMERIC;
  v_current_qty_var NUMERIC;
  v_held_qty_var NUMERIC;
  v_available_qty_var NUMERIC;
  v_hold_id_var UUID;
BEGIN
  FOR v_item_var IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id_var := (v_item_var->>'inventoryId')::UUID;
    v_product_id_var := (v_item_var->>'productId')::UUID;

    -- Use gramsToDeduct (for weight tiers) or quantity (for unit tiers)
    v_requested_qty_var := COALESCE(
      (v_item_var->>'gramsToDeduct')::NUMERIC,
      (v_item_var->>'quantity')::NUMERIC
    );

    -- Skip if no inventory tracking for this item
    IF v_inventory_id_var IS NULL THEN
      CONTINUE;
    END IF;

    -- Lock inventory row and get current quantity
    SELECT i.id, i.product_id, i.location_id, i.quantity
    INTO v_inventory_id_var, v_product_id_var, v_location_id_var, v_current_qty_var
    FROM inventory i
    WHERE i.id = v_inventory_id_var
    FOR UPDATE;

    IF v_inventory_id_var IS NULL THEN
      RAISE EXCEPTION 'Inventory record not found';
    END IF;

    -- Calculate quantity already held by other orders
    SELECT COALESCE(SUM(ih.quantity), 0)
    INTO v_held_qty_var
    FROM inventory_holds ih
    WHERE ih.inventory_id = v_inventory_id_var
      AND ih.released_at IS NULL
      AND ih.order_id != p_order_id;

    -- Calculate available quantity
    v_available_qty_var := v_current_qty_var - v_held_qty_var;

    -- Check if we have enough inventory
    IF v_available_qty_var < v_requested_qty_var THEN
      RAISE EXCEPTION 'Insufficient inventory';
    END IF;

    -- Create or update hold record
    INSERT INTO inventory_holds (
      order_id,
      inventory_id,
      product_id,
      location_id,
      quantity,
      created_at
    )
    VALUES (
      p_order_id,
      v_inventory_id_var,
      v_product_id_var,
      v_location_id_var,
      v_requested_qty_var,
      NOW()
    )
    ON CONFLICT (order_id, inventory_id)
    WHERE released_at IS NULL
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      created_at = EXCLUDED.created_at
    RETURNING id INTO v_hold_id_var;

    -- Return hold info for verification
    RETURN QUERY SELECT
      v_hold_id_var,
      v_inventory_id_var,
      v_product_id_var,
      v_requested_qty_var,
      v_available_qty_var;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO service_role;

COMMENT ON FUNCTION reserve_inventory(UUID, JSONB) IS
'Reserves inventory for an order. Uses gramsToDeduct if provided (actual quantity to deduct from inventory), otherwise uses quantity field. Handles both weight-based tiers (28g, 3.5g) and unit-based tiers (2 units, 3 units).';
