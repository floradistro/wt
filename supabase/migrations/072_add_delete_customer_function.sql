-- ============================================================================
-- ATOMIC DELETE CUSTOMER FUNCTION
-- ============================================================================
-- This function atomically deletes customers (soft delete) with:
-- ✅ Idempotency (already deleted customers won't error)
-- ✅ Row-level locking (prevents race conditions)
-- ✅ Atomic operation (all-or-nothing)
-- ✅ Email/phone anonymization (frees unique constraints)
-- ✅ SECURITY DEFINER (bypasses RLS on audit tables)
-- ✅ Proper error handling
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_customer_safe(
  p_customer_id UUID,
  p_vendor_id UUID
)
RETURNS TABLE (
  customer_id UUID,
  was_active BOOLEAN,
  success BOOLEAN
) AS $$
DECLARE
  v_timestamp BIGINT;
  v_customer RECORD;
  v_was_active BOOLEAN;
BEGIN
  -- Set search_path for security (prevent schema hijacking)
  SET LOCAL search_path = public;

  -- ========================================================================
  -- STEP 1: LOCK CUSTOMER ROW AND VERIFY
  -- ========================================================================
  -- Get timestamp for unique anonymization
  v_timestamp := EXTRACT(EPOCH FROM NOW())::BIGINT;

  -- Lock customer row and get current state
  SELECT * INTO v_customer
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer % not found', p_customer_id;
  END IF;

  -- Verify vendor ownership
  IF v_customer.vendor_id != p_vendor_id THEN
    RAISE EXCEPTION 'Customer % does not belong to vendor %', p_customer_id, p_vendor_id;
  END IF;

  -- Store original active state
  v_was_active := v_customer.is_active;

  -- ========================================================================
  -- STEP 2: IDEMPOTENCY CHECK
  -- ========================================================================
  -- If already deleted, return success (idempotent)
  IF v_customer.is_active = false THEN
    RETURN QUERY
    SELECT
      p_customer_id,
      v_was_active,
      true;
    RETURN;
  END IF;

  -- ========================================================================
  -- STEP 3: SOFT DELETE WITH ANONYMIZATION
  -- ========================================================================
  -- Atomically update customer record
  UPDATE customers
  SET
    is_active = false,
    email = CASE
      WHEN email IS NOT NULL
      THEN 'deleted.' || p_customer_id::TEXT || '.' || v_timestamp::TEXT || '@deleted.local'
      ELSE NULL
    END,
    phone = CASE
      WHEN phone IS NOT NULL
      THEN 'deleted_' || p_customer_id::TEXT || '_' || v_timestamp::TEXT
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = p_customer_id;

  -- Verify update succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to delete customer %', p_customer_id;
  END IF;

  -- ========================================================================
  -- STEP 4: RETURN RESULTS
  -- ========================================================================
  RETURN QUERY
  SELECT
    p_customer_id,
    v_was_active,
    true;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error details and re-raise
    RAISE EXCEPTION 'Failed to delete customer %: %', p_customer_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION delete_customer_safe(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_customer_safe(UUID, UUID) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION delete_customer_safe IS
'Atomically deletes (soft delete) a customer with idempotency, row-level locking, and email/phone anonymization. Uses SECURITY DEFINER to bypass RLS on audit tables. Returns deletion status.';
