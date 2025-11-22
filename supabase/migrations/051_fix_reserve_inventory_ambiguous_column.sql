-- ============================================================================
-- FIX: Ambiguous column reference in reserve_inventory()
-- ============================================================================
-- Issue: SELECT statement lacks table alias causing "product_id is ambiguous"
-- Fix: Add explicit table alias to eliminate ambiguity
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_inventory(
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
  -- Loop through each item in the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventoryId')::UUID;
    v_product_id := (v_item->>'productId')::UUID;
    v_requested_qty := (v_item->>'quantity')::NUMERIC;

    -- Skip if no inventory tracking for this item
    IF v_inventory_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Lock inventory row and get current quantity (WITH EXPLICIT TABLE ALIAS)
    SELECT i.id, i.product_id, i.location_id, i.quantity
    INTO v_inventory_id, v_product_id, v_location_id, v_current_qty
    FROM inventory i
    WHERE i.id = v_inventory_id
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'Inventory record not found for item %', v_item->>'productName';
    END IF;

    -- Calculate quantity already held by other orders
    SELECT COALESCE(SUM(ih.quantity), 0)
    INTO v_held_qty
    FROM inventory_holds ih
    WHERE ih.inventory_id = v_inventory_id
      AND ih.released_at IS NULL
      AND ih.expires_at > NOW()
      AND ih.order_id != p_order_id; -- Exclude holds from this order (retry case)

    -- Calculate available quantity
    v_available_qty := v_current_qty - v_held_qty;

    -- Check if sufficient inventory available
    IF v_available_qty < v_requested_qty THEN
      RAISE EXCEPTION 'Insufficient inventory for product "%". Available: %, Requested: %',
        v_item->>'productName', v_available_qty, v_requested_qty;
    END IF;

    -- Create or update hold for this order
    INSERT INTO inventory_holds (
      inventory_id,
      order_id,
      product_id,
      location_id,
      quantity,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      v_inventory_id,
      p_order_id,
      v_product_id,
      v_location_id,
      v_requested_qty,
      NOW() + INTERVAL '10 minutes',
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id, inventory_id)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING id INTO v_hold_id;

    -- Return hold details
    RETURN QUERY SELECT
      v_hold_id,
      v_inventory_id,
      v_product_id,
      v_requested_qty,
      v_available_qty;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION reserve_inventory IS
'Reserves inventory for an order before payment. Fixed ambiguous column reference by adding explicit table aliases.';
