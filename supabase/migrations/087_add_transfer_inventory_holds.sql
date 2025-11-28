-- =====================================================
-- ADD INVENTORY HOLDS FOR TRANSFERS (Apple Engineering Pattern)
-- =====================================================
-- Implements two-phase commit for inventory transfers:
-- 1. mark_transfer_in_transit: Reserve inventory (create holds)
-- 2. complete_inventory_transfer: Execute transaction (deduct + add + release holds)
-- 3. cancel_inventory_transfer: Rollback (release holds)
-- =====================================================

-- =====================================================
-- Update mark_transfer_in_transit to create holds
-- =====================================================

DROP FUNCTION IF EXISTS mark_transfer_in_transit(UUID, TEXT);

CREATE OR REPLACE FUNCTION mark_transfer_in_transit(
  p_transfer_id UUID,
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_source_location UUID;
  v_vendor_id UUID;
  v_item RECORD;
  v_inventory_id UUID;
  v_total_qty NUMERIC;
  v_held_qty NUMERIC;
  v_available NUMERIC;
BEGIN
  -- Get transfer details
  SELECT status, source_location_id, vendor_id
  INTO v_status, v_source_location, v_vendor_id
  FROM inventory_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  -- Can only mark draft as in_transit
  IF v_status != 'draft' THEN
    RAISE EXCEPTION 'Transfer must be draft to mark in transit. Current status: %', v_status;
  END IF;

  -- Check each item and create holds
  FOR v_item IN
    SELECT product_id, quantity
    FROM inventory_transfer_items
    WHERE transfer_id = p_transfer_id
  LOOP
    -- Get inventory record
    SELECT i.id, i.quantity
    INTO v_inventory_id, v_total_qty
    FROM inventory i
    WHERE i.product_id = v_item.product_id
      AND i.location_id = v_source_location
      AND i.vendor_id = v_vendor_id
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'Product not found in source location';
    END IF;

    -- Calculate held quantity (from POS orders AND other transfers)
    SELECT COALESCE(SUM(h.quantity), 0)
    INTO v_held_qty
    FROM inventory_holds h
    WHERE h.inventory_id = v_inventory_id
      AND h.released_at IS NULL;

    -- Calculate available = total - held
    v_available := COALESCE(v_total_qty, 0) - v_held_qty;

    -- Check if sufficient
    IF v_available < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient inventory for product. Available: %, Requested: %',
        v_available, v_item.quantity;
    END IF;

    -- Create hold for this transfer (expires in 30 days - transfers take longer than orders)
    INSERT INTO inventory_holds (
      inventory_id,
      order_id,  -- Store transfer_id here (generic reference)
      product_id,
      location_id,
      quantity,
      expires_at,
      release_reason -- Mark as 'transfer_hold' to distinguish from POS holds
    )
    VALUES (
      v_inventory_id,
      p_transfer_id,  -- Transfer ID stored in order_id column
      v_item.product_id,
      v_source_location,
      v_item.quantity,
      NOW() + INTERVAL '30 days',
      'transfer_hold' -- Identifier for transfer holds
    );
  END LOOP;

  -- Mark as in_transit
  UPDATE inventory_transfers
  SET status = 'in_transit',
      shipped_at = NOW(),
      tracking_number = p_tracking_number,
      updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_transfer_in_transit(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION mark_transfer_in_transit(UUID, TEXT) TO authenticated;

-- =====================================================
-- Update complete_inventory_transfer to release holds
-- =====================================================

DROP FUNCTION IF EXISTS complete_inventory_transfer(UUID, JSONB, UUID);

CREATE OR REPLACE FUNCTION complete_inventory_transfer(
  p_transfer_id UUID,
  p_received_items JSONB,
  p_received_by_user_id UUID DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, items_processed INTEGER, items_good INTEGER, items_damaged INTEGER) AS $$
DECLARE
  v_item JSONB;
  v_item_id UUID;
  v_received_qty NUMERIC;
  v_condition TEXT;
  v_product_id UUID;
  v_source_location UUID;
  v_dest_location UUID;
  v_vendor_id UUID;
  v_status TEXT;
  v_source_inventory_id UUID;
  v_dest_inventory_id UUID;
  v_source_qty_before NUMERIC;
  v_dest_qty_before NUMERIC;
  v_items_count INTEGER := 0;
  v_items_good INTEGER := 0;
  v_items_damaged INTEGER := 0;
  v_hold RECORD;
BEGIN
  SELECT source_location_id, destination_location_id, vendor_id, status
  INTO v_source_location, v_dest_location, v_vendor_id, v_status
  FROM inventory_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_status NOT IN ('in_transit') THEN
    RAISE EXCEPTION 'Transfer must be in_transit to complete. Current status: %', v_status;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_received_items) LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_received_qty := (v_item->>'received_quantity')::NUMERIC;
    v_condition := v_item->>'condition';

    SELECT product_id INTO v_product_id
    FROM inventory_transfer_items
    WHERE id = v_item_id AND transfer_id = p_transfer_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer item not found'; END IF;

    SELECT id, quantity INTO v_source_inventory_id, v_source_qty_before
    FROM inventory
    WHERE product_id = v_product_id
      AND location_id = v_source_location
      AND vendor_id = v_vendor_id
    FOR UPDATE;

    IF v_source_inventory_id IS NULL THEN RAISE EXCEPTION 'Source inventory not found'; END IF;

    -- Find and release the hold for this item
    SELECT * INTO v_hold FROM inventory_holds
    WHERE order_id = p_transfer_id
      AND product_id = v_product_id
      AND inventory_id = v_source_inventory_id
      AND released_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory hold found for this transfer item. The transfer may not have been properly marked in_transit.';
    END IF;

    -- Verify we still have enough (hold quantity should match)
    IF v_source_qty_before < v_received_qty THEN
      RAISE EXCEPTION 'Insufficient inventory at source. Available: %, Requested: %',
        v_source_qty_before, v_received_qty;
    END IF;

    -- Deduct from source
    UPDATE inventory SET quantity = quantity - v_received_qty, updated_at = NOW()
    WHERE id = v_source_inventory_id;

    -- Release the hold
    UPDATE inventory_holds
    SET released_at = NOW(),
        release_reason = 'transfer_completed',
        updated_at = NOW()
    WHERE id = v_hold.id;

    -- Create stock movement for source
    INSERT INTO stock_movements (
      product_id, vendor_id, location_id, movement_type,
      quantity_before, quantity_after, quantity_change,
      reference_type, reference_id, created_by_user_id
    )
    VALUES (
      v_product_id, v_vendor_id, v_source_location, 'transfer_out',
      v_source_qty_before, v_source_qty_before - v_received_qty, -v_received_qty,
      'inventory_transfer', p_transfer_id, p_received_by_user_id
    );

    -- If condition is good, add to destination
    IF v_condition = 'good' THEN
      SELECT id, quantity INTO v_dest_inventory_id, v_dest_qty_before
      FROM inventory
      WHERE product_id = v_product_id
        AND location_id = v_dest_location
        AND vendor_id = v_vendor_id
      FOR UPDATE;

      IF v_dest_inventory_id IS NULL THEN
        INSERT INTO inventory (product_id, location_id, vendor_id, quantity)
        VALUES (v_product_id, v_dest_location, v_vendor_id, v_received_qty)
        RETURNING id INTO v_dest_inventory_id;
        v_dest_qty_before := 0;
      ELSE
        UPDATE inventory SET quantity = quantity + v_received_qty, updated_at = NOW()
        WHERE id = v_dest_inventory_id;
      END IF;

      INSERT INTO stock_movements (
        product_id, vendor_id, location_id, movement_type,
        quantity_before, quantity_after, quantity_change,
        reference_type, reference_id, created_by_user_id
      )
      VALUES (
        v_product_id, v_vendor_id, v_dest_location, 'transfer_in',
        v_dest_qty_before, v_dest_qty_before + v_received_qty, v_received_qty,
        'inventory_transfer', p_transfer_id, p_received_by_user_id
      );

      v_items_good := v_items_good + 1;
    ELSE
      v_items_damaged := v_items_damaged + 1;
    END IF;

    UPDATE inventory_transfer_items
    SET received_quantity = v_received_qty, condition = v_condition::TEXT, updated_at = NOW()
    WHERE id = v_item_id;

    v_items_count := v_items_count + 1;
  END LOOP;

  UPDATE inventory_transfers
  SET status = 'completed',
      received_at = NOW(),
      received_by_user_id = p_received_by_user_id,
      updated_at = NOW()
  WHERE id = p_transfer_id;

  UPDATE products
  SET stock_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = products.id),
      updated_at = NOW()
  WHERE id IN (SELECT DISTINCT product_id FROM inventory_transfer_items WHERE transfer_id = p_transfer_id);

  RETURN QUERY SELECT TRUE, v_items_count, v_items_good, v_items_damaged;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_inventory_transfer(UUID, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION complete_inventory_transfer(UUID, JSONB, UUID) TO authenticated;

-- =====================================================
-- Update cancel_inventory_transfer to release holds
-- =====================================================

DROP FUNCTION IF EXISTS cancel_inventory_transfer(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION cancel_inventory_transfer(
  p_transfer_id UUID,
  p_cancelled_by_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM inventory_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'Cannot cancel'; END IF;

  -- Release any holds for this transfer
  UPDATE inventory_holds
  SET released_at = NOW(),
      release_reason = 'transfer_cancelled',
      updated_at = NOW()
  WHERE order_id = p_transfer_id
    AND released_at IS NULL;

  UPDATE inventory_transfers
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by_user_id = p_cancelled_by_user_id,
      updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_inventory_transfer(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_inventory_transfer(UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON FUNCTION mark_transfer_in_transit IS
'Apple Engineering Pattern: Phase 1 - Reserve inventory by creating holds. Prevents over-allocation and race conditions.';

COMMENT ON FUNCTION complete_inventory_transfer IS
'Apple Engineering Pattern: Phase 2 - Execute atomic transaction: deduct from source, add to destination, release holds.';

COMMENT ON FUNCTION cancel_inventory_transfer IS
'Apple Engineering Pattern: Rollback - Release holds without moving inventory. Safe cancellation at any point.';
