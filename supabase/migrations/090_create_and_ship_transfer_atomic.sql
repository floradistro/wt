-- =====================================================
-- CREATE AND SHIP TRANSFER ATOMICALLY
-- =====================================================
-- Single function that creates transfer and marks in_transit
-- This prevents showing intermediate "draft" state in real-time
-- =====================================================

CREATE OR REPLACE FUNCTION create_and_ship_transfer(
  p_vendor_id UUID,
  p_source_location_id UUID,
  p_destination_location_id UUID,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_created_by_user_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
  v_transfer_number TEXT;
  v_item JSONB;
  v_inventory_id UUID;
  v_total_qty NUMERIC;
  v_held_qty NUMERIC;
  v_available NUMERIC;
BEGIN
  -- Check for duplicate with idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transfer_id
    FROM inventory_transfers
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_transfer_id;
    END IF;
  END IF;

  -- Generate transfer number
  v_transfer_number := 'TRF-' || LPAD(nextval('transfer_number_seq')::TEXT, 6, '0');

  -- Create transfer with in_transit status immediately
  INSERT INTO inventory_transfers (
    vendor_id,
    source_location_id,
    destination_location_id,
    transfer_number,
    status,
    notes,
    tracking_number,
    shipped_at,
    created_by_user_id,
    idempotency_key
  )
  VALUES (
    p_vendor_id,
    p_source_location_id,
    p_destination_location_id,
    v_transfer_number,
    'in_transit', -- Start as in_transit, not draft!
    p_notes,
    p_tracking_number,
    NOW(), -- Shipped immediately
    p_created_by_user_id,
    p_idempotency_key
  )
  RETURNING id INTO v_transfer_id;

  -- Create transfer items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO inventory_transfer_items (
      transfer_id,
      product_id,
      quantity
    )
    VALUES (
      v_transfer_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::NUMERIC
    );
  END LOOP;

  -- Create inventory holds for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Get inventory record
    SELECT i.id, i.quantity
    INTO v_inventory_id, v_total_qty
    FROM inventory i
    WHERE i.product_id = (v_item->>'product_id')::UUID
      AND i.location_id = p_source_location_id
      AND i.vendor_id = p_vendor_id
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'Product not found in source location';
    END IF;

    -- Calculate held quantity
    SELECT COALESCE(SUM(h.quantity), 0)
    INTO v_held_qty
    FROM inventory_holds h
    WHERE h.inventory_id = v_inventory_id
      AND h.released_at IS NULL;

    -- Calculate available = total - held
    v_available := COALESCE(v_total_qty, 0) - v_held_qty;

    -- Check if sufficient
    IF v_available < (v_item->>'quantity')::NUMERIC THEN
      RAISE EXCEPTION 'Insufficient inventory for product. Available: %, Requested: %',
        v_available, (v_item->>'quantity')::NUMERIC;
    END IF;

    -- Create hold
    INSERT INTO inventory_holds (
      inventory_id,
      order_id,
      product_id,
      location_id,
      quantity,
      expires_at,
      release_reason
    )
    VALUES (
      v_inventory_id,
      v_transfer_id,
      (v_item->>'product_id')::UUID,
      p_source_location_id,
      (v_item->>'quantity')::NUMERIC,
      NOW() + INTERVAL '30 days',
      'transfer_hold'
    );
  END LOOP;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_and_ship_transfer(UUID, UUID, UUID, JSONB, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_and_ship_transfer(UUID, UUID, UUID, JSONB, TEXT, TEXT, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION create_and_ship_transfer IS
'Atomically creates transfer and marks it in_transit with holds. Prevents showing intermediate draft state in UI.';
