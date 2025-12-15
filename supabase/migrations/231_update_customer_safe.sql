-- ============================================================================
-- ATOMIC UPDATE CUSTOMER FUNCTION
-- ============================================================================
-- This function atomically updates customers with:
-- ✅ Vendor ownership verification
-- ✅ SECURITY DEFINER (bypasses RLS)
-- ✅ Data normalization (email lowercase, phone normalized)
-- ✅ Only updates active customers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_customer_safe(
  p_customer_id UUID,
  p_vendor_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_loyalty_points INTEGER DEFAULT NULL
)
RETURNS TABLE (
  customer_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_customer RECORD;
  v_normalized_email TEXT;
  v_normalized_phone TEXT;
BEGIN
  -- Set search_path for security (prevent schema hijacking)
  SET LOCAL search_path = public;

  -- ========================================================================
  -- STEP 1: VERIFY CUSTOMER EXISTS AND BELONGS TO VENDOR
  -- ========================================================================
  SELECT * INTO v_customer
  FROM customers
  WHERE id = p_customer_id
    AND vendor_id = p_vendor_id
    AND is_active = true
  FOR UPDATE;  -- Lock row for update

  IF v_customer.id IS NULL THEN
    RETURN QUERY
    SELECT
      p_customer_id,
      false,
      'Customer not found or not owned by vendor'::TEXT;
    RETURN;
  END IF;

  -- ========================================================================
  -- STEP 2: NORMALIZE DATA
  -- ========================================================================
  -- Normalize email (lowercase, trim) - only if provided
  IF p_email IS NOT NULL THEN
    IF p_email = '' THEN
      v_normalized_email := NULL;
    ELSE
      v_normalized_email := LOWER(TRIM(p_email));
    END IF;
  END IF;

  -- Normalize phone (remove all non-digits) - only if provided
  IF p_phone IS NOT NULL THEN
    IF p_phone = '' THEN
      v_normalized_phone := NULL;
    ELSE
      v_normalized_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
      IF v_normalized_phone = '' THEN
        v_normalized_phone := NULL;
      END IF;
    END IF;
  END IF;

  -- ========================================================================
  -- STEP 3: UPDATE CUSTOMER
  -- ========================================================================
  UPDATE customers
  SET
    first_name = COALESCE(NULLIF(TRIM(p_first_name), ''), first_name),
    last_name = COALESCE(NULLIF(TRIM(p_last_name), ''), last_name),
    email = CASE
      WHEN p_email IS NOT NULL THEN v_normalized_email
      ELSE email
    END,
    phone = CASE
      WHEN p_phone IS NOT NULL THEN v_normalized_phone
      ELSE phone
    END,
    loyalty_points = COALESCE(p_loyalty_points, loyalty_points),
    updated_at = NOW()
  WHERE id = p_customer_id
    AND vendor_id = p_vendor_id
    AND is_active = true;

  -- ========================================================================
  -- STEP 4: RETURN SUCCESS
  -- ========================================================================
  RETURN QUERY
  SELECT
    p_customer_id,
    true,
    NULL::TEXT;

EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY
    SELECT
      p_customer_id,
      false,
      'Email or phone already in use by another customer'::TEXT;

  WHEN OTHERS THEN
    RETURN QUERY
    SELECT
      p_customer_id,
      false,
      ('Update failed: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION update_customer_safe(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER
) TO authenticated;

GRANT EXECUTE ON FUNCTION update_customer_safe(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER
) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION update_customer_safe IS
'Atomically updates a customer with vendor ownership verification and data normalization. Uses SECURITY DEFINER to bypass RLS. Returns success status and error message if failed.';
