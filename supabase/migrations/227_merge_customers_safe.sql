-- ============================================================================
-- ATOMIC MERGE CUSTOMERS FUNCTION
-- ============================================================================
-- This function atomically merges two customers with:
-- ✅ Idempotency (already merged customers won't error)
-- ✅ Row-level locking (prevents race conditions)
-- ✅ Atomic operation (all-or-nothing)
-- ✅ SECURITY DEFINER (bypasses RLS that requires app.current_vendor_id)
-- ✅ Proper error handling
-- ✅ Comprehensive data merging (contact info, loyalty points, orders, etc.)
-- ============================================================================

CREATE OR REPLACE FUNCTION merge_customers_safe(
  p_target_id UUID,
  p_source_id UUID,
  p_vendor_id UUID
)
RETURNS TABLE (
  target_id UUID,
  source_id UUID,
  merged_loyalty_points INTEGER,
  orders_transferred INTEGER,
  success BOOLEAN
) AS $$
DECLARE
  v_target RECORD;
  v_source RECORD;
  v_merged_points INTEGER;
  v_orders_count INTEGER := 0;
  v_timestamp BIGINT;
BEGIN
  -- Set search_path for security (prevent schema hijacking)
  SET LOCAL search_path = public;

  -- ========================================================================
  -- STEP 1: VALIDATE INPUTS
  -- ========================================================================
  IF p_target_id = p_source_id THEN
    RAISE EXCEPTION 'Cannot merge customer with itself';
  END IF;

  -- ========================================================================
  -- STEP 2: LOCK BOTH CUSTOMER ROWS (in consistent order to prevent deadlocks)
  -- ========================================================================
  -- Lock in order of UUID to prevent deadlocks when concurrent merges happen
  IF p_target_id < p_source_id THEN
    SELECT * INTO v_target FROM customers WHERE id = p_target_id FOR UPDATE;
    SELECT * INTO v_source FROM customers WHERE id = p_source_id FOR UPDATE;
  ELSE
    SELECT * INTO v_source FROM customers WHERE id = p_source_id FOR UPDATE;
    SELECT * INTO v_target FROM customers WHERE id = p_target_id FOR UPDATE;
  END IF;

  -- Verify target exists and is active
  IF NOT FOUND OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'Target customer % not found', p_target_id;
  END IF;

  IF v_target.vendor_id != p_vendor_id THEN
    RAISE EXCEPTION 'Target customer % does not belong to vendor %', p_target_id, p_vendor_id;
  END IF;

  IF v_target.is_active = false THEN
    RAISE EXCEPTION 'Target customer % is not active', p_target_id;
  END IF;

  -- Verify source exists
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Source customer % not found', p_source_id;
  END IF;

  IF v_source.vendor_id != p_vendor_id THEN
    RAISE EXCEPTION 'Source customer % does not belong to vendor %', p_source_id, p_vendor_id;
  END IF;

  -- ========================================================================
  -- STEP 3: IDEMPOTENCY CHECK - if source already deleted, return success
  -- ========================================================================
  IF v_source.is_active = false THEN
    RETURN QUERY
    SELECT
      p_target_id,
      p_source_id,
      COALESCE(v_target.loyalty_points, 0)::INTEGER,
      0::INTEGER,
      true;
    RETURN;
  END IF;

  -- ========================================================================
  -- STEP 4: MERGE CUSTOMER DATA
  -- ========================================================================
  -- Calculate merged loyalty points
  v_merged_points := COALESCE(v_target.loyalty_points, 0) + COALESCE(v_source.loyalty_points, 0);

  -- Update target with merged data (prefer target data, fill gaps from source)
  UPDATE customers
  SET
    -- Contact info (prefer target, fill from source)
    email = COALESCE(v_target.email, v_source.email),
    phone = COALESCE(v_target.phone, v_source.phone),
    -- Name fields
    first_name = COALESCE(v_target.first_name, v_source.first_name),
    last_name = COALESCE(v_target.last_name, v_source.last_name),
    middle_name = COALESCE(v_target.middle_name, v_source.middle_name),
    display_name = COALESCE(v_target.display_name, v_source.display_name),
    -- Personal info
    date_of_birth = COALESCE(v_target.date_of_birth, v_source.date_of_birth),
    drivers_license_number = COALESCE(v_target.drivers_license_number, v_source.drivers_license_number),
    -- Address fields
    street_address = COALESCE(v_target.street_address, v_source.street_address),
    city = COALESCE(v_target.city, v_source.city),
    state = COALESCE(v_target.state, v_source.state),
    postal_code = COALESCE(v_target.postal_code, v_source.postal_code),
    -- Sum loyalty points
    loyalty_points = v_merged_points,
    -- Sum totals (triggers will recalculate, but this is a good starting point)
    total_spent = COALESCE(v_target.total_spent, 0) + COALESCE(v_source.total_spent, 0),
    total_orders = COALESCE(v_target.total_orders, 0) + COALESCE(v_source.total_orders, 0),
    updated_at = NOW()
  WHERE id = p_target_id;

  -- ========================================================================
  -- STEP 5: TRANSFER ALL ORDERS FROM SOURCE TO TARGET
  -- ========================================================================
  UPDATE orders
  SET customer_id = p_target_id
  WHERE customer_id = p_source_id;

  GET DIAGNOSTICS v_orders_count = ROW_COUNT;

  -- ========================================================================
  -- STEP 6: TRANSFER LOYALTY POINT HISTORY (if table exists)
  -- ========================================================================
  BEGIN
    UPDATE customer_loyalty_history
    SET customer_id = p_target_id
    WHERE customer_id = p_source_id;
  EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist, skip
    NULL;
  END;

  -- ========================================================================
  -- STEP 7: TRANSFER WALLET PASSES (if table exists)
  -- ========================================================================
  BEGIN
    UPDATE customer_wallet_passes
    SET customer_id = p_target_id
    WHERE customer_id = p_source_id;
  EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist, skip
    NULL;
  END;

  -- ========================================================================
  -- STEP 8: SOFT DELETE SOURCE CUSTOMER
  -- ========================================================================
  v_timestamp := EXTRACT(EPOCH FROM NOW())::BIGINT;

  UPDATE customers
  SET
    is_active = false,
    email = CASE
      WHEN email IS NOT NULL
      THEN 'merged.' || p_source_id::TEXT || '.' || v_timestamp::TEXT || '@merged.local'
      ELSE NULL
    END,
    phone = CASE
      WHEN phone IS NOT NULL
      THEN 'merged_' || p_source_id::TEXT || '_' || v_timestamp::TEXT
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = p_source_id;

  -- ========================================================================
  -- STEP 9: RETURN RESULTS
  -- ========================================================================
  RETURN QUERY
  SELECT
    p_target_id,
    p_source_id,
    v_merged_points,
    v_orders_count,
    true;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error details and re-raise
    RAISE EXCEPTION 'Failed to merge customers: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION merge_customers_safe(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION merge_customers_safe(UUID, UUID, UUID) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION merge_customers_safe IS
'Atomically merges two customers into one. Keeps target customer, transfers all data and orders from source, then soft-deletes source. Uses SECURITY DEFINER to bypass RLS. Returns merge status and statistics.';
