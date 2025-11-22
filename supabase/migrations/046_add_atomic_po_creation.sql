-- ============================================================================
-- ATOMIC PURCHASE ORDER CREATION FUNCTION
-- ============================================================================
-- This function creates purchase orders atomically in a single transaction
-- Features:
-- ✅ Idempotency (retry-safe)
-- ✅ Atomic PO + items creation (no orphaned records)
-- ✅ Automatic PO number generation using sequence
-- ✅ Automatic total calculation
-- ✅ No manual rollback needed
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_purchase_order_atomic(UUID, TEXT, JSONB, UUID, UUID, UUID, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS create_purchase_order_atomic(UUID, TEXT, TEXT, UUID, UUID, UUID, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION create_purchase_order_atomic(
  p_vendor_id UUID,
  p_po_type TEXT,
  p_items TEXT,  -- Changed from JSONB to TEXT for Supabase client compatibility
  p_supplier_id UUID DEFAULT NULL,
  p_wholesale_customer_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_expected_delivery_date TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT 0,
  p_shipping_cost NUMERIC DEFAULT 0,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  po_id UUID,
  po_number TEXT,
  status TEXT,
  subtotal NUMERIC,
  tax_amount NUMERIC,
  shipping_cost NUMERIC,
  total_amount NUMERIC,
  items_created INTEGER
) AS $$
DECLARE
  v_po_id UUID;
  v_po_number TEXT;
  v_subtotal NUMERIC;
  v_total NUMERIC;
  v_item JSONB;
  v_item_count INTEGER := 0;
  v_items_json JSONB;
BEGIN
  v_items_json := p_items::JSONB;

  -- STEP 1: CHECK IDEMPOTENCY
  IF p_idempotency_key IS NOT NULL THEN
    SELECT po.id, po.po_number, po.status, po.subtotal, po.tax_amount, po.shipping_cost, po.total_amount
    INTO v_po_id, v_po_number, status, v_subtotal, tax_amount, shipping_cost, v_total
    FROM purchase_orders po
    WHERE po.idempotency_key = p_idempotency_key;

    IF v_po_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_item_count
      FROM purchase_order_items
      WHERE purchase_order_id = v_po_id;

      RETURN QUERY
      SELECT v_po_id, v_po_number, status, v_subtotal, tax_amount, shipping_cost, v_total, v_item_count;
      RETURN;
    END IF;
  END IF;

  -- CRITICAL FIX: Reset variables after idempotency check
  -- SELECT INTO sets ALL variables to NULL when no row is found
  v_subtotal := 0;
  v_total := 0;

  -- STEP 2: VALIDATE INPUTS
  IF p_po_type NOT IN ('inbound', 'outbound') THEN
    RAISE EXCEPTION 'PO type must be either inbound or outbound';
  END IF;

  IF p_po_type = 'inbound' AND p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier is required for inbound purchase orders';
  END IF;

  IF p_po_type = 'outbound' AND p_wholesale_customer_id IS NULL THEN
    RAISE EXCEPTION 'Wholesale customer is required for outbound purchase orders';
  END IF;

  -- STEP 3: CALCULATE SUBTOTAL AND VALIDATE ITEMS
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_json) LOOP
    IF (v_item->>'product_id') IS NULL THEN
      RAISE EXCEPTION 'Product ID is required for all items';
    END IF;

    IF (v_item->>'quantity')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than 0';
    END IF;

    IF (v_item->>'unit_price')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Item unit price must be 0 or greater';
    END IF;

    v_subtotal := v_subtotal + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    v_item_count := v_item_count + 1;
  END LOOP;

  -- Check item count instead of subtotal (allow $0 items)
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  v_total := v_subtotal + p_tax_amount + p_shipping_cost;

  -- STEP 4: GENERATE PO NUMBER
  v_po_number := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('po_sequence')::TEXT, 4, '0');

  -- STEP 5: CREATE PURCHASE ORDER
  INSERT INTO purchase_orders (
    vendor_id, po_number, po_type, supplier_id, wholesale_customer_id, location_id,
    status, subtotal, tax_amount, shipping_cost, discount, total_amount,
    expected_delivery_date, notes, idempotency_key, created_at, updated_at
  )
  VALUES (
    p_vendor_id, v_po_number, p_po_type, p_supplier_id, p_wholesale_customer_id, p_location_id,
    'draft', v_subtotal, p_tax_amount, p_shipping_cost, 0, v_total,
    p_expected_delivery_date, p_notes, p_idempotency_key, NOW(), NOW()
  )
  RETURNING id INTO v_po_id;

  -- STEP 6: CREATE PURCHASE ORDER ITEMS
  -- Reset counter for actual inserts
  v_item_count := 0;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_json) LOOP
    INSERT INTO purchase_order_items (
      purchase_order_id, product_id, quantity, received_quantity,
      unit_price, subtotal, created_at, updated_at
    )
    VALUES (
      v_po_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::NUMERIC, 0,
      (v_item->>'unit_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC,
      NOW(), NOW()
    );

    v_item_count := v_item_count + 1;
  END LOOP;

  -- RETURN RESULTS
  RETURN QUERY
  SELECT v_po_id, v_po_number, 'draft'::TEXT, v_subtotal, p_tax_amount, p_shipping_cost, v_total, v_item_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_purchase_order_atomic(UUID, TEXT, TEXT, UUID, UUID, UUID, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_purchase_order_atomic(UUID, TEXT, TEXT, UUID, UUID, UUID, TIMESTAMPTZ, TEXT, NUMERIC, NUMERIC, TEXT) TO service_role;

-- Comment
COMMENT ON FUNCTION create_purchase_order_atomic IS
'Atomically creates purchase orders with items in a single transaction. Includes idempotency, validation, and automatic PO number generation. Prevents orphaned records.';
