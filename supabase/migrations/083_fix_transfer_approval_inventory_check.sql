-- =====================================================
-- FIX: Transfer Approval Inventory Check
-- =====================================================
-- Problem: The inventory availability check in approve_inventory_transfer
-- was incorrectly calculating available quantity, causing false
-- "Insufficient inventory" errors.

CREATE OR REPLACE FUNCTION approve_inventory_transfer(
  p_transfer_id UUID,
  p_approved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_item RECORD;
  v_inventory_id UUID;
  v_total_qty NUMERIC;
  v_held_qty NUMERIC;
  v_available NUMERIC;
  v_source_location UUID;
  v_vendor_id UUID;
  v_status TEXT;
BEGIN
  -- Get transfer details
  SELECT source_location_id, vendor_id, status
  INTO v_source_location, v_vendor_id, v_status
  FROM inventory_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_status != 'draft' THEN
    RAISE EXCEPTION 'Transfer must be draft';
  END IF;

  -- Check each item
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
      RAISE EXCEPTION 'Product not in source location';
    END IF;

    -- Calculate held quantity (sum of all unreleased holds)
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

    -- Create hold for this transfer
    INSERT INTO inventory_holds (
      inventory_id,
      order_id,
      product_id,
      location_id,
      quantity,
      expires_at
    )
    VALUES (
      v_inventory_id,
      p_transfer_id,
      v_item.product_id,
      v_source_location,
      v_item.quantity,
      NOW() + INTERVAL '7 days'
    );
  END LOOP;

  -- Update transfer status
  UPDATE inventory_transfers
  SET status = 'approved',
      approved_by = p_approved_by,
      updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION approve_inventory_transfer(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION approve_inventory_transfer(UUID, UUID) TO authenticated;
