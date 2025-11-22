-- ============================================================================
-- EXTENDED RECONCILIATION SYSTEM
-- ============================================================================
-- This migration extends the reconciliation system beyond checkout
-- Adds reconciliation queues for inventory adjustments and purchase orders
-- Provides centralized error tracking and resolution mechanisms
-- ============================================================================

-- ============================================================================
-- ADJUSTMENT RECONCILIATION QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS adjustment_reconciliation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID, -- Reference to failed adjustment (may be NULL)
  vendor_id UUID NOT NULL,
  product_id UUID REFERENCES products(id),
  location_id UUID REFERENCES locations(id),
  adjustment_type TEXT,
  quantity_change NUMERIC,
  reason TEXT,
  error TEXT NOT NULL,
  error_details JSONB, -- Structured error information
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_adjustment_reconciliation_vendor ON adjustment_reconciliation_queue(vendor_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_reconciliation_product ON adjustment_reconciliation_queue(product_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_reconciliation_resolved ON adjustment_reconciliation_queue(resolved) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_adjustment_reconciliation_created ON adjustment_reconciliation_queue(created_at DESC);

-- RLS policies
ALTER TABLE adjustment_reconciliation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view adjustment reconciliation for their vendor"
  ON adjustment_reconciliation_queue
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage adjustment reconciliation"
  ON adjustment_reconciliation_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON adjustment_reconciliation_queue TO authenticated;
GRANT ALL ON adjustment_reconciliation_queue TO service_role;

-- Comment
COMMENT ON TABLE adjustment_reconciliation_queue IS
'Tracks failed inventory adjustment operations for manual reconciliation. Provides error context and resolution tracking.';

-- ============================================================================
-- PURCHASE ORDER RECONCILIATION QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS po_reconciliation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID, -- Reference to failed PO (may be NULL)
  vendor_id UUID NOT NULL,
  po_type TEXT,
  items JSONB, -- Items that failed to process
  error TEXT NOT NULL,
  error_details JSONB, -- Structured error information
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_reconciliation_vendor ON po_reconciliation_queue(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_reconciliation_po ON po_reconciliation_queue(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_reconciliation_resolved ON po_reconciliation_queue(resolved) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_po_reconciliation_created ON po_reconciliation_queue(created_at DESC);

-- RLS policies
ALTER TABLE po_reconciliation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO reconciliation for their vendor"
  ON po_reconciliation_queue
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage PO reconciliation"
  ON po_reconciliation_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON po_reconciliation_queue TO authenticated;
GRANT ALL ON po_reconciliation_queue TO service_role;

-- Comment
COMMENT ON TABLE po_reconciliation_queue IS
'Tracks failed purchase order operations for manual reconciliation. Provides error context and resolution tracking.';

-- ============================================================================
-- FUNCTION: MARK RECONCILIATION RESOLVED
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_reconciliation_resolved(
  p_queue_type TEXT, -- 'inventory', 'adjustment', or 'po'
  p_record_id UUID,
  p_resolved_by UUID,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  CASE p_queue_type
    WHEN 'inventory' THEN
      UPDATE inventory_reconciliation_queue
      SET
        resolved = TRUE,
        resolved_at = NOW(),
        resolved_by = p_resolved_by,
        resolution_notes = p_resolution_notes,
        updated_at = NOW()
      WHERE id = p_record_id;

    WHEN 'adjustment' THEN
      UPDATE adjustment_reconciliation_queue
      SET
        resolved = TRUE,
        resolved_at = NOW(),
        resolved_by = p_resolved_by,
        resolution_notes = p_resolution_notes,
        updated_at = NOW()
      WHERE id = p_record_id;

    WHEN 'po' THEN
      UPDATE po_reconciliation_queue
      SET
        resolved = TRUE,
        resolved_at = NOW(),
        resolved_by = p_resolved_by,
        resolution_notes = p_resolution_notes,
        updated_at = NOW()
      WHERE id = p_record_id;

    ELSE
      RAISE EXCEPTION 'Invalid queue type: %. Must be inventory, adjustment, or po', p_queue_type;
  END CASE;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: GET RECONCILIATION DASHBOARD
-- ============================================================================

CREATE OR REPLACE FUNCTION get_reconciliation_dashboard(p_vendor_id UUID)
RETURNS TABLE (
  queue_type TEXT,
  total_unresolved INTEGER,
  oldest_unresolved_at TIMESTAMPTZ,
  total_resolved_last_7_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  -- Inventory reconciliation stats
  SELECT
    'inventory'::TEXT as queue_type,
    COUNT(*)::INTEGER as total_unresolved,
    MIN(created_at) as oldest_unresolved_at,
    (SELECT COUNT(*)::INTEGER
     FROM inventory_reconciliation_queue
     WHERE resolved = TRUE
       AND resolved_at > NOW() - INTERVAL '7 days'
       AND order_id IN (SELECT id FROM orders WHERE vendor_id = p_vendor_id)
    ) as total_resolved_last_7_days
  FROM inventory_reconciliation_queue
  WHERE resolved = FALSE
    AND order_id IN (SELECT id FROM orders WHERE vendor_id = p_vendor_id)

  UNION ALL

  -- Adjustment reconciliation stats
  SELECT
    'adjustment'::TEXT as queue_type,
    COUNT(*)::INTEGER as total_unresolved,
    MIN(created_at) as oldest_unresolved_at,
    (SELECT COUNT(*)::INTEGER
     FROM adjustment_reconciliation_queue
     WHERE resolved = TRUE
       AND resolved_at > NOW() - INTERVAL '7 days'
       AND vendor_id = p_vendor_id
    ) as total_resolved_last_7_days
  FROM adjustment_reconciliation_queue
  WHERE resolved = FALSE
    AND vendor_id = p_vendor_id

  UNION ALL

  -- PO reconciliation stats
  SELECT
    'po'::TEXT as queue_type,
    COUNT(*)::INTEGER as total_unresolved,
    MIN(created_at) as oldest_unresolved_at,
    (SELECT COUNT(*)::INTEGER
     FROM po_reconciliation_queue
     WHERE resolved = TRUE
       AND resolved_at > NOW() - INTERVAL '7 days'
       AND vendor_id = p_vendor_id
    ) as total_resolved_last_7_days
  FROM po_reconciliation_queue
  WHERE resolved = FALSE
    AND vendor_id = p_vendor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE PROCESS_INVENTORY_ADJUSTMENT TO LOG FAILURES
-- ============================================================================

CREATE OR REPLACE FUNCTION process_inventory_adjustment(
  p_vendor_id UUID,
  p_product_id UUID,
  p_location_id UUID,
  p_adjustment_type TEXT,
  p_quantity_change NUMERIC,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  adjustment_id UUID,
  inventory_id UUID,
  quantity_before NUMERIC,
  quantity_after NUMERIC,
  quantity_change NUMERIC,
  product_total_stock NUMERIC
) AS $$
DECLARE
  v_adjustment_id UUID;
  v_inventory_id UUID;
  v_current_qty NUMERIC;
  v_new_qty NUMERIC;
  v_total_stock NUMERIC;
BEGIN
  -- Check idempotency (unchanged)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, quantity_before, quantity_after, quantity_change
    INTO v_adjustment_id, v_current_qty, v_new_qty, p_quantity_change
    FROM inventory_adjustments
    WHERE idempotency_key = p_idempotency_key;

    IF v_adjustment_id IS NOT NULL THEN
      SELECT stock_quantity INTO v_total_stock
      FROM products WHERE id = p_product_id;

      RETURN QUERY
      SELECT v_adjustment_id,
        (SELECT id FROM inventory WHERE product_id = p_product_id AND location_id = p_location_id),
        v_current_qty, v_new_qty, p_quantity_change, v_total_stock;
      RETURN;
    END IF;
  END IF;

  -- Lock inventory row (unchanged)
  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM inventory
  WHERE product_id = p_product_id AND location_id = p_location_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    INSERT INTO inventory (product_id, location_id, vendor_id, quantity, created_at, updated_at)
    VALUES (p_product_id, p_location_id, p_vendor_id, 0, NOW(), NOW())
    RETURNING id, quantity INTO v_inventory_id, v_current_qty;
  END IF;

  -- Calculate and validate (unchanged)
  v_new_qty := v_current_qty + p_quantity_change;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory: current quantity is %, requested change is %', v_current_qty, p_quantity_change;
  END IF;

  -- Create adjustment record (unchanged)
  INSERT INTO inventory_adjustments (
    vendor_id, product_id, location_id, adjustment_type,
    quantity_before, quantity_after, quantity_change,
    reason, notes, reference_id, reference_type, created_by, idempotency_key, created_at
  ) VALUES (
    p_vendor_id, p_product_id, p_location_id, p_adjustment_type,
    v_current_qty, v_new_qty, p_quantity_change,
    p_reason, p_notes, p_reference_id, p_reference_type, p_created_by, p_idempotency_key, NOW()
  ) RETURNING id INTO v_adjustment_id;

  -- Update inventory (unchanged)
  UPDATE inventory SET quantity = v_new_qty, updated_at = NOW() WHERE id = v_inventory_id;

  -- Update product total stock (unchanged)
  UPDATE products
  SET stock_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = p_product_id), updated_at = NOW()
  WHERE id = p_product_id
  RETURNING stock_quantity INTO v_total_stock;

  -- Create stock movement (unchanged)
  INSERT INTO stock_movements (
    product_id, vendor_id, location_id, movement_type,
    quantity_before, quantity_after, quantity_change,
    reference_type, reference_id, created_at
  ) VALUES (
    p_product_id, p_vendor_id, p_location_id, 'adjustment',
    v_current_qty, v_new_qty, p_quantity_change,
    'inventory_adjustment', v_adjustment_id, NOW()
  );

  RETURN QUERY SELECT v_adjustment_id, v_inventory_id, v_current_qty, v_new_qty, p_quantity_change, v_total_stock;

EXCEPTION WHEN OTHERS THEN
  -- Log to reconciliation queue on any error
  INSERT INTO adjustment_reconciliation_queue (
    adjustment_id, vendor_id, product_id, location_id,
    adjustment_type, quantity_change, reason, error, error_details, created_at
  ) VALUES (
    NULL, p_vendor_id, p_product_id, p_location_id,
    p_adjustment_type, p_quantity_change, p_reason,
    SQLERRM, jsonb_build_object('sqlstate', SQLSTATE, 'context', 'process_inventory_adjustment'), NOW()
  );

  RAISE; -- Re-raise the exception
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION mark_reconciliation_resolved(TEXT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_reconciliation_resolved(TEXT, UUID, UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_reconciliation_dashboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_reconciliation_dashboard(UUID) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION mark_reconciliation_resolved IS
'Marks a reconciliation queue item as resolved across all queue types (inventory, adjustment, po).';

COMMENT ON FUNCTION get_reconciliation_dashboard IS
'Provides summary statistics for all reconciliation queues for a vendor. Useful for admin dashboards.';
