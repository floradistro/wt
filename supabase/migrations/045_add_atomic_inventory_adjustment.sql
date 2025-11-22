-- ============================================================================
-- ATOMIC INVENTORY ADJUSTMENT FUNCTION
-- ============================================================================
-- This function performs inventory adjustments atomically in a single transaction
-- Features:
-- ✅ Idempotency (retry-safe)
-- ✅ Row-level locking (prevents race conditions)
-- ✅ Atomic multi-table updates
-- ✅ Automatic product total stock calculation
-- ✅ Stock movement audit trail
-- ✅ Negative inventory prevention
-- ✅ Auto-creates inventory records if missing
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
  -- ========================================================================
  -- STEP 1: CHECK IDEMPOTENCY
  -- ========================================================================
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, quantity_before, quantity_after, quantity_change
    INTO v_adjustment_id, v_current_qty, v_new_qty, p_quantity_change
    FROM inventory_adjustments
    WHERE idempotency_key = p_idempotency_key;

    IF v_adjustment_id IS NOT NULL THEN
      -- Get product total stock
      SELECT stock_quantity INTO v_total_stock
      FROM products
      WHERE id = p_product_id;

      -- Return existing adjustment (idempotent response)
      RETURN QUERY
      SELECT
        v_adjustment_id,
        (SELECT id FROM inventory WHERE product_id = p_product_id AND location_id = p_location_id),
        v_current_qty,
        v_new_qty,
        p_quantity_change,
        v_total_stock;
      RETURN;
    END IF;
  END IF;

  -- ========================================================================
  -- STEP 2: LOCK INVENTORY ROW AND GET CURRENT QUANTITY
  -- ========================================================================
  -- Use SELECT FOR UPDATE to prevent concurrent modifications
  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM inventory
  WHERE product_id = p_product_id
    AND location_id = p_location_id
    AND vendor_id = p_vendor_id
  FOR UPDATE;

  -- Create inventory record if doesn't exist
  IF v_inventory_id IS NULL THEN
    INSERT INTO inventory (
      product_id,
      location_id,
      vendor_id,
      quantity,
      created_at,
      updated_at
    )
    VALUES (
      p_product_id,
      p_location_id,
      p_vendor_id,
      0,
      NOW(),
      NOW()
    )
    RETURNING id, quantity INTO v_inventory_id, v_current_qty;
  END IF;

  -- ========================================================================
  -- STEP 3: CALCULATE NEW QUANTITY AND VALIDATE
  -- ========================================================================
  v_new_qty := v_current_qty + p_quantity_change;

  -- Prevent negative inventory
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory: current quantity is %, requested change is %',
      v_current_qty, p_quantity_change;
  END IF;

  -- ========================================================================
  -- STEP 4: CREATE ADJUSTMENT RECORD
  -- ========================================================================
  INSERT INTO inventory_adjustments (
    vendor_id,
    product_id,
    location_id,
    adjustment_type,
    quantity_before,
    quantity_after,
    quantity_change,
    reason,
    notes,
    reference_id,
    reference_type,
    created_by,
    idempotency_key,
    created_at
  )
  VALUES (
    p_vendor_id,
    p_product_id,
    p_location_id,
    p_adjustment_type,
    v_current_qty,
    v_new_qty,
    p_quantity_change,
    p_reason,
    p_notes,
    p_reference_id,
    p_reference_type,
    p_created_by,
    p_idempotency_key,
    NOW()
  )
  RETURNING id INTO v_adjustment_id;

  -- ========================================================================
  -- STEP 5: UPDATE INVENTORY QUANTITY
  -- ========================================================================
  UPDATE inventory
  SET
    quantity = v_new_qty,
    updated_at = NOW()
  WHERE id = v_inventory_id;

  -- ========================================================================
  -- STEP 6: UPDATE PRODUCT TOTAL STOCK (ATOMIC CALCULATION)
  -- ========================================================================
  -- Calculate total across all locations atomically
  UPDATE products
  SET
    stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM inventory
      WHERE product_id = p_product_id
    ),
    updated_at = NOW()
  WHERE id = p_product_id
  RETURNING stock_quantity INTO v_total_stock;

  -- ========================================================================
  -- STEP 7: CREATE STOCK MOVEMENT FOR AUDIT TRAIL
  -- ========================================================================
  INSERT INTO stock_movements (
    product_id,
    vendor_id,
    location_id,
    movement_type,
    quantity_before,
    quantity_after,
    quantity_change,
    reference_type,
    reference_id,
    created_at
  )
  VALUES (
    p_product_id,
    p_vendor_id,
    p_location_id,
    'adjustment',
    v_current_qty,
    v_new_qty,
    p_quantity_change,
    'inventory_adjustment',
    v_adjustment_id,
    NOW()
  );

  -- ========================================================================
  -- RETURN RESULTS
  -- ========================================================================
  RETURN QUERY
  SELECT
    v_adjustment_id,
    v_inventory_id,
    v_current_qty,
    v_new_qty,
    p_quantity_change,
    v_total_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_inventory_adjustment(
  UUID, UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION process_inventory_adjustment(
  UUID, UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO service_role;

-- Comment
COMMENT ON FUNCTION process_inventory_adjustment IS
'Atomically processes inventory adjustments with idempotency, row-level locking, and automatic stock reconciliation. Prevents race conditions and negative inventory.';
