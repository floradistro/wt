-- =====================================================
-- ATOMIC INVENTORY TRANSFER SYSTEM - SIMPLE VERSION
-- =====================================================

-- Transfer header table
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  source_location_id UUID NOT NULL REFERENCES locations(id),
  destination_location_id UUID NOT NULL REFERENCES locations(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'in_transit', 'completed', 'cancelled')),
  notes TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID,
  approved_by UUID,
  received_by UUID,
  cancelled_by UUID,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT different_locations CHECK (source_location_id != destination_location_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_vendor ON inventory_transfers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_transfers_source ON inventory_transfers(source_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON inventory_transfers(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON inventory_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created ON inventory_transfers(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_idempotency ON inventory_transfers(vendor_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Transfer line items
CREATE TABLE IF NOT EXISTS inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  received_quantity NUMERIC DEFAULT 0 CHECK (received_quantity >= 0),
  condition TEXT CHECK (condition IN ('good', 'damaged', 'expired', 'rejected')),
  condition_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON inventory_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_product ON inventory_transfer_items(product_id);

-- Sequence for transfer numbers
CREATE SEQUENCE IF NOT EXISTS transfer_number_seq START 1000;

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION create_inventory_transfer(
  p_vendor_id UUID,
  p_source_location_id UUID,
  p_destination_location_id UUID,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transfer_id UUID;
  v_transfer_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transfer_id FROM inventory_transfers
    WHERE vendor_id = p_vendor_id AND idempotency_key = p_idempotency_key;
    IF v_transfer_id IS NOT NULL THEN RETURN v_transfer_id; END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_source_location_id) THEN
    RAISE EXCEPTION 'Source location does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_destination_location_id) THEN
    RAISE EXCEPTION 'Destination location does not exist';
  END IF;

  IF p_source_location_id = p_destination_location_id THEN
    RAISE EXCEPTION 'Source and destination must be different';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Transfer must have at least one item';
  END IF;

  v_transfer_number := 'TRF-' || LPAD(nextval('transfer_number_seq')::TEXT, 6, '0');

  INSERT INTO inventory_transfers (vendor_id, transfer_number, source_location_id, destination_location_id, status, notes, created_by, idempotency_key)
  VALUES (p_vendor_id, v_transfer_number, p_source_location_id, p_destination_location_id, 'draft', p_notes, p_created_by, p_idempotency_key)
  RETURNING id INTO v_transfer_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    IF NOT EXISTS (SELECT 1 FROM products WHERE id = v_product_id) THEN
      RAISE EXCEPTION 'Product does not exist';
    END IF;

    IF v_quantity <= 0 OR v_quantity > 1000000 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    INSERT INTO inventory_transfer_items (transfer_id, product_id, quantity)
    VALUES (v_transfer_id, v_product_id, v_quantity);
  END LOOP;

  RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_inventory_transfer(UUID, UUID, UUID, JSONB, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_inventory_transfer(UUID, UUID, UUID, JSONB, TEXT, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION approve_inventory_transfer(
  p_transfer_id UUID,
  p_approved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_item RECORD;
  v_inventory_id UUID;
  v_available NUMERIC;
  v_source_location UUID;
  v_vendor_id UUID;
  v_status TEXT;
BEGIN
  SELECT source_location_id, vendor_id, status INTO v_source_location, v_vendor_id, v_status
  FROM inventory_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_status != 'draft' THEN RAISE EXCEPTION 'Transfer must be draft'; END IF;

  FOR v_item IN SELECT product_id, quantity FROM inventory_transfer_items WHERE transfer_id = p_transfer_id LOOP
    SELECT i.id, i.quantity INTO v_inventory_id, v_available
    FROM inventory i WHERE i.product_id = v_item.product_id AND i.location_id = v_source_location AND i.vendor_id = v_vendor_id FOR UPDATE;

    IF v_inventory_id IS NULL THEN RAISE EXCEPTION 'Product not in source location'; END IF;

    SELECT COALESCE(v_available, 0) - COALESCE(SUM(h.quantity), 0) INTO v_available
    FROM inventory_holds h WHERE h.inventory_id = v_inventory_id AND h.released_at IS NULL;

    IF v_available < v_item.quantity THEN RAISE EXCEPTION 'Insufficient inventory'; END IF;

    INSERT INTO inventory_holds (inventory_id, order_id, product_id, location_id, quantity, expires_at)
    VALUES (v_inventory_id, p_transfer_id, v_item.product_id, v_source_location, v_item.quantity, NOW() + INTERVAL '7 days');
  END LOOP;

  UPDATE inventory_transfers SET status = 'approved', approved_by = p_approved_by, updated_at = NOW() WHERE id = p_transfer_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION approve_inventory_transfer(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION approve_inventory_transfer(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION complete_inventory_transfer(
  p_transfer_id UUID,
  p_received_items JSONB,
  p_received_by UUID DEFAULT NULL
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
  v_hold RECORD;
  v_source_qty_before NUMERIC;
  v_dest_qty_before NUMERIC;
  v_items_count INTEGER := 0;
  v_items_good INTEGER := 0;
  v_items_damaged INTEGER := 0;
BEGIN
  SELECT source_location_id, destination_location_id, vendor_id, status
  INTO v_source_location, v_dest_location, v_vendor_id, v_status
  FROM inventory_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_status NOT IN ('approved', 'in_transit') THEN RAISE EXCEPTION 'Transfer must be approved or in transit'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_received_items) LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_received_qty := (v_item->>'received_quantity')::NUMERIC;
    v_condition := v_item->>'condition';

    SELECT product_id INTO v_product_id FROM inventory_transfer_items WHERE id = v_item_id AND transfer_id = p_transfer_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer item not found'; END IF;

    SELECT id, quantity INTO v_source_inventory_id, v_source_qty_before
    FROM inventory WHERE product_id = v_product_id AND location_id = v_source_location AND vendor_id = v_vendor_id FOR UPDATE;

    IF v_source_inventory_id IS NULL THEN RAISE EXCEPTION 'Source inventory not found'; END IF;

    SELECT * INTO v_hold FROM inventory_holds
    WHERE order_id = p_transfer_id AND product_id = v_product_id AND inventory_id = v_source_inventory_id AND released_at IS NULL FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'No hold found'; END IF;

    UPDATE inventory SET quantity = quantity - v_received_qty, updated_at = NOW() WHERE id = v_source_inventory_id;
    UPDATE inventory_holds SET released_at = NOW(), release_reason = 'transfer_completed' WHERE id = v_hold.id;

    INSERT INTO stock_movements (product_id, vendor_id, location_id, movement_type, quantity_before, quantity_after, quantity_change, reference_type, reference_id)
    VALUES (v_product_id, v_vendor_id, v_source_location, 'transfer_out', v_source_qty_before, v_source_qty_before - v_received_qty, -v_received_qty, 'inventory_transfer', p_transfer_id);

    IF v_condition = 'good' THEN
      SELECT id, quantity INTO v_dest_inventory_id, v_dest_qty_before
      FROM inventory WHERE product_id = v_product_id AND location_id = v_dest_location AND vendor_id = v_vendor_id FOR UPDATE;

      IF v_dest_inventory_id IS NULL THEN
        INSERT INTO inventory (product_id, location_id, vendor_id, quantity)
        VALUES (v_product_id, v_dest_location, v_vendor_id, v_received_qty)
        RETURNING id INTO v_dest_inventory_id;
        v_dest_qty_before := 0;
      ELSE
        UPDATE inventory SET quantity = quantity + v_received_qty, updated_at = NOW() WHERE id = v_dest_inventory_id;
      END IF;

      INSERT INTO stock_movements (product_id, vendor_id, location_id, movement_type, quantity_before, quantity_after, quantity_change, reference_type, reference_id)
      VALUES (v_product_id, v_vendor_id, v_dest_location, 'transfer_in', v_dest_qty_before, v_dest_qty_before + v_received_qty, v_received_qty, 'inventory_transfer', p_transfer_id);

      v_items_good := v_items_good + 1;
    ELSE
      v_items_damaged := v_items_damaged + 1;
    END IF;

    UPDATE inventory_transfer_items SET received_quantity = v_received_qty, condition = v_condition, updated_at = NOW() WHERE id = v_item_id;
    v_items_count := v_items_count + 1;
  END LOOP;

  UPDATE inventory_transfers SET status = 'completed', received_at = NOW(), received_by = p_received_by, updated_at = NOW() WHERE id = p_transfer_id;

  UPDATE products SET stock_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = products.id), updated_at = NOW()
  WHERE id IN (SELECT DISTINCT product_id FROM inventory_transfer_items WHERE transfer_id = p_transfer_id);

  RETURN QUERY SELECT TRUE, v_items_count, v_items_good, v_items_damaged;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_inventory_transfer(UUID, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION complete_inventory_transfer(UUID, JSONB, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION cancel_inventory_transfer(
  p_transfer_id UUID,
  p_cancelled_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM inventory_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'Cannot cancel'; END IF;

  IF v_status IN ('approved', 'in_transit') THEN
    UPDATE inventory_holds SET released_at = NOW(), release_reason = 'transfer_cancelled'
    WHERE order_id = p_transfer_id AND released_at IS NULL;
  END IF;

  UPDATE inventory_transfers SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = p_cancelled_by, updated_at = NOW() WHERE id = p_transfer_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_inventory_transfer(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cancel_inventory_transfer(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION mark_transfer_in_transit(
  p_transfer_id UUID,
  p_tracking_number TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM inventory_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_status != 'approved' THEN RAISE EXCEPTION 'Must be approved'; END IF;

  UPDATE inventory_transfers SET status = 'in_transit', shipped_at = NOW(), tracking_number = p_tracking_number, updated_at = NOW() WHERE id = p_transfer_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_transfer_in_transit(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION mark_transfer_in_transit(UUID, TEXT) TO authenticated;

-- =====================================================
-- RLS POLICIES (Simple - Service Role Only)
-- =====================================================

ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on transfers" ON inventory_transfers;
CREATE POLICY "Service role full access on transfers" ON inventory_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on transfers" ON inventory_transfers;
CREATE POLICY "Authenticated full access on transfers" ON inventory_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on transfer items" ON inventory_transfer_items;
CREATE POLICY "Service role full access on transfer items" ON inventory_transfer_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on transfer items" ON inventory_transfer_items;
CREATE POLICY "Authenticated full access on transfer items" ON inventory_transfer_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON inventory_transfers TO authenticated;
GRANT ALL ON inventory_transfers TO service_role;
GRANT SELECT, INSERT, UPDATE ON inventory_transfer_items TO authenticated;
GRANT ALL ON inventory_transfer_items TO service_role;

-- =====================================================
-- ENABLE REAL-TIME
-- =====================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transfers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transfer_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
