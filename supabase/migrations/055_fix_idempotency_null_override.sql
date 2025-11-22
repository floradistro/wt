-- ============================================================================
-- FIX: Idempotency check overwriting variables with NULL
-- ============================================================================
-- Issue: SELECT INTO sets ALL variables to NULL when no row found
-- Fix: Use IF EXISTS pattern instead
-- ============================================================================

CREATE OR REPLACE FUNCTION process_inventory_adjustment(
  p_vendor_id UUID,
  p_product_id UUID,
  p_location_id UUID,
  p_adjustment_type TEXT,
  p_quantity_change NUMERIC,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(
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
  v_existing_adjustment RECORD;
BEGIN
  -- Check idempotency - only query if key provided
  IF p_idempotency_key IS NOT NULL THEN
    SELECT ia.id, ia.quantity_before, ia.quantity_after, ia.quantity_change
    INTO v_existing_adjustment
    FROM inventory_adjustments ia
    WHERE ia.idempotency_key = p_idempotency_key;

    IF v_existing_adjustment.id IS NOT NULL THEN
      -- Return existing adjustment
      SELECT p.stock_quantity INTO v_total_stock
      FROM products p WHERE p.id = p_product_id;

      RETURN QUERY
      SELECT
        v_existing_adjustment.id AS adjustment_id,
        (SELECT i.id FROM inventory i WHERE i.product_id = p_product_id AND i.location_id = p_location_id) AS inventory_id,
        v_existing_adjustment.quantity_before AS quantity_before,
        v_existing_adjustment.quantity_after AS quantity_after,
        v_existing_adjustment.quantity_change AS quantity_change,
        v_total_stock AS product_total_stock;
      RETURN;
    END IF;
  END IF;

  -- Lock inventory row with explicit alias
  SELECT i.id, i.quantity
  INTO v_inventory_id, v_current_qty
  FROM inventory i
  WHERE i.product_id = p_product_id
    AND i.location_id = p_location_id
    AND i.vendor_id = p_vendor_id
  FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    INSERT INTO inventory (product_id, location_id, vendor_id, quantity, created_at, updated_at)
    VALUES (p_product_id, p_location_id, p_vendor_id, 0, NOW(), NOW())
    RETURNING id, quantity INTO v_inventory_id, v_current_qty;
  END IF;

  -- Calculate and validate
  v_new_qty := v_current_qty + p_quantity_change;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory: current quantity is %, requested change is %', v_current_qty, p_quantity_change;
  END IF;

  -- Create adjustment record
  INSERT INTO inventory_adjustments (
    vendor_id, product_id, location_id, adjustment_type,
    quantity_before, quantity_after, quantity_change,
    reason, notes, reference_id, reference_type, created_by, idempotency_key, created_at
  ) VALUES (
    p_vendor_id, p_product_id, p_location_id, p_adjustment_type,
    v_current_qty, v_new_qty, p_quantity_change,
    p_reason, p_notes, p_reference_id, p_reference_type, p_created_by, p_idempotency_key, NOW()
  ) RETURNING id INTO v_adjustment_id;

  -- Update inventory
  UPDATE inventory i
  SET quantity = v_new_qty, updated_at = NOW()
  WHERE i.id = v_inventory_id;

  -- Update product total stock with explicit alias
  UPDATE products p
  SET
    stock_quantity = (SELECT COALESCE(SUM(i.quantity), 0) FROM inventory i WHERE i.product_id = p_product_id),
    updated_at = NOW()
  WHERE p.id = p_product_id
  RETURNING p.stock_quantity INTO v_total_stock;

  -- Create stock movement
  INSERT INTO stock_movements (
    product_id, vendor_id, location_id, movement_type,
    quantity_before, quantity_after, quantity_change,
    reference_type, reference_id, created_at
  ) VALUES (
    p_product_id, p_vendor_id, p_location_id, 'adjustment',
    v_current_qty, v_new_qty, p_quantity_change,
    'inventory_adjustment', v_adjustment_id, NOW()
  );

  -- Return with explicit column aliases
  RETURN QUERY
  SELECT
    v_adjustment_id AS adjustment_id,
    v_inventory_id AS inventory_id,
    v_current_qty AS quantity_before,
    v_new_qty AS quantity_after,
    p_quantity_change AS quantity_change,
    v_total_stock AS product_total_stock;

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

  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_inventory_adjustment IS
'Atomically processes inventory adjustments with idempotency. Fixed NULL override bug by using RECORD type for idempotency check.';
