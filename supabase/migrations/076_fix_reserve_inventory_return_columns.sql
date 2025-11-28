-- ============================================================================
-- FIX RESERVE_INVENTORY - Rename RETURNS TABLE columns to avoid ambiguity
-- ============================================================================
-- The ON CONFLICT clause conflicts with RETURNS TABLE column names
-- Solution: Rename return columns to have different names
-- ============================================================================

DROP FUNCTION IF EXISTS reserve_inventory(UUID, JSONB);

CREATE FUNCTION reserve_inventory(
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
  v_location_id UUID;
  v_requested_qty NUMERIC;
  v_current_qty NUMERIC;
  v_held_qty NUMERIC;
  v_available_qty NUMERIC;
  v_hold_id UUID;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventoryId')::UUID;
    v_product_id := (v_item->>'productId')::UUID;

    -- Use gramsToDeduct (for weight tiers) or quantity (for unit tiers)
    v_requested_qty := COALESCE(
      (v_item->>'gramsToDeduct')::NUMERIC,
      (v_item->>'quantity')::NUMERIC
    );

    -- Skip if no inventory tracking for this item
    IF v_inventory_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Lock inventory row and get current quantity
    SELECT i.id, i.product_id, i.location_id, i.quantity
    INTO v_inventory_id, v_product_id, v_location_id, v_current_qty
    FROM inventory i
    WHERE i.id = v_inventory_id
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'Inventory record not found';
    END IF;

    -- Calculate quantity already held by other orders
    SELECT COALESCE(SUM(ih.quantity), 0)
    INTO v_held_qty
    FROM inventory_holds ih
    WHERE ih.inventory_id = v_inventory_id
      AND ih.released_at IS NULL
      AND ih.order_id != p_order_id;

    -- Calculate available quantity
    v_available_qty := v_current_qty - v_held_qty;

    -- Check if we have enough inventory
    IF v_available_qty < v_requested_qty THEN
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
      v_inventory_id,
      v_product_id,
      v_location_id,
      v_requested_qty,
      NOW()
    )
    ON CONFLICT (order_id, inventory_id)
    WHERE released_at IS NULL
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      created_at = EXCLUDED.created_at
    RETURNING id INTO v_hold_id;

    -- Return hold info for verification
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

GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO service_role;

COMMENT ON FUNCTION reserve_inventory(UUID, JSONB) IS
'Reserves inventory for an order. Uses gramsToDeduct if provided (actual quantity to deduct from inventory), otherwise uses quantity field. Handles both weight-based tiers (28g, 3.5g) and unit-based tiers (2 units, 3 units).';
