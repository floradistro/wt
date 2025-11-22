-- ============================================================================
-- ATOMIC CREATE CUSTOMER FUNCTION
-- ============================================================================
-- This function atomically creates customers with:
-- ✅ Idempotency (retry-safe with unique keys)
-- ✅ Duplicate detection (checks existing email/phone)
-- ✅ Atomic operation (all-or-nothing)
-- ✅ Auto-generated unique walk-in emails
-- ✅ Data normalization (email lowercase, phone normalized)
-- ✅ SECURITY DEFINER (bypasses RLS if needed)
-- ✅ Proper error handling
-- ============================================================================

-- First, add idempotency key column to customers table if it doesn't exist
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Create index for faster idempotency lookups
CREATE INDEX IF NOT EXISTS idx_customers_idempotency
ON customers(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Comment
COMMENT ON COLUMN customers.idempotency_key IS
'Unique key to prevent duplicate customer creation. Enables safe retries.';

-- ============================================================================
-- CREATE CUSTOMER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_customer_safe(
  p_vendor_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_middle_name TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_street_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_postal_code TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  customer_id UUID,
  created BOOLEAN,
  duplicate_found BOOLEAN,
  success BOOLEAN
) AS $$
DECLARE
  v_customer_id UUID;
  v_normalized_email TEXT;
  v_normalized_phone TEXT;
  v_existing_customer RECORD;
  v_unique_email TEXT;
  v_timestamp BIGINT;
BEGIN
  -- Set search_path for security (prevent schema hijacking)
  SET LOCAL search_path = public;

  -- ========================================================================
  -- STEP 1: CHECK IDEMPOTENCY
  -- ========================================================================
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_customer_id
    FROM customers
    WHERE idempotency_key = p_idempotency_key
      AND vendor_id = p_vendor_id;

    IF v_customer_id IS NOT NULL THEN
      -- Return existing customer (idempotent response)
      RETURN QUERY
      SELECT
        v_customer_id,
        false,  -- not newly created
        false,  -- not a duplicate (original creation)
        true;   -- success
      RETURN;
    END IF;
  END IF;

  -- ========================================================================
  -- STEP 2: NORMALIZE DATA
  -- ========================================================================
  -- Normalize email (lowercase, trim)
  IF p_email IS NOT NULL AND p_email != '' THEN
    v_normalized_email := LOWER(TRIM(p_email));
  ELSE
    v_normalized_email := NULL;
  END IF;

  -- Normalize phone (remove all non-digits)
  IF p_phone IS NOT NULL AND p_phone != '' THEN
    v_normalized_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
    -- If empty after normalization, set to NULL
    IF v_normalized_phone = '' THEN
      v_normalized_phone := NULL;
    END IF;
  ELSE
    v_normalized_phone := NULL;
  END IF;

  -- ========================================================================
  -- STEP 3: CHECK FOR DUPLICATES
  -- ========================================================================
  -- Check if customer already exists with same email or phone
  -- IMPORTANT: Only check active customers (is_active = true)

  IF v_normalized_email IS NOT NULL THEN
    SELECT * INTO v_existing_customer
    FROM customers
    WHERE vendor_id = p_vendor_id
      AND email = v_normalized_email
      AND is_active = true
    LIMIT 1;

    IF v_existing_customer.id IS NOT NULL THEN
      -- Customer with this email already exists
      RETURN QUERY
      SELECT
        v_existing_customer.id,
        false,  -- not created
        true,   -- duplicate found
        true;   -- success (returning existing customer)
      RETURN;
    END IF;
  END IF;

  IF v_normalized_phone IS NOT NULL THEN
    SELECT * INTO v_existing_customer
    FROM customers
    WHERE vendor_id = p_vendor_id
      AND phone = v_normalized_phone
      AND is_active = true
    LIMIT 1;

    IF v_existing_customer.id IS NOT NULL THEN
      -- Customer with this phone already exists
      RETURN QUERY
      SELECT
        v_existing_customer.id,
        false,  -- not created
        true,   -- duplicate found
        true;   -- success (returning existing customer)
      RETURN;
    END IF;
  END IF;

  -- ========================================================================
  -- STEP 4: GENERATE UNIQUE EMAIL FOR WALK-INS
  -- ========================================================================
  -- If no email provided, generate unique walk-in email
  IF v_normalized_email IS NULL THEN
    v_timestamp := EXTRACT(EPOCH FROM NOW())::BIGINT;
    v_unique_email := LOWER(
      REGEXP_REPLACE(p_first_name, '[^a-zA-Z0-9]', '', 'g') || '.' ||
      REGEXP_REPLACE(p_last_name, '[^a-zA-Z0-9]', '', 'g') || '.' ||
      v_timestamp::TEXT ||
      '@walk-in.local'
    );
  ELSE
    v_unique_email := v_normalized_email;
  END IF;

  -- ========================================================================
  -- STEP 5: CREATE CUSTOMER RECORD
  -- ========================================================================
  INSERT INTO customers (
    vendor_id,
    first_name,
    middle_name,
    last_name,
    email,
    phone,
    date_of_birth,
    street_address,
    city,
    state,
    postal_code,
    loyalty_points,
    total_spent,
    total_orders,
    is_active,
    idempotency_key,
    created_at,
    updated_at
  )
  VALUES (
    p_vendor_id,
    TRIM(p_first_name),
    NULLIF(TRIM(p_middle_name), ''),
    TRIM(p_last_name),
    v_unique_email,
    v_normalized_phone,
    p_date_of_birth,
    NULLIF(TRIM(p_street_address), ''),
    NULLIF(TRIM(p_city), ''),
    NULLIF(TRIM(p_state), ''),
    NULLIF(TRIM(p_postal_code), ''),
    0,  -- loyalty_points
    0,  -- total_spent
    0,  -- total_orders
    true,  -- is_active
    p_idempotency_key,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_customer_id;

  -- Verify creation succeeded
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create customer';
  END IF;

  -- ========================================================================
  -- STEP 6: RETURN RESULTS
  -- ========================================================================
  RETURN QUERY
  SELECT
    v_customer_id,
    true,   -- created
    false,  -- no duplicate
    true;   -- success

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition where another request created the same customer
    -- This can happen if two requests come in at the exact same time

    -- Try to find the existing customer by email or phone
    IF v_normalized_email IS NOT NULL THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE vendor_id = p_vendor_id
        AND email = v_normalized_email
        AND is_active = true
      LIMIT 1;
    END IF;

    IF v_customer_id IS NULL AND v_normalized_phone IS NOT NULL THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE vendor_id = p_vendor_id
        AND phone = v_normalized_phone
        AND is_active = true
      LIMIT 1;
    END IF;

    IF v_customer_id IS NOT NULL THEN
      -- Found existing customer created by concurrent request
      RETURN QUERY
      SELECT
        v_customer_id,
        false,  -- not created by this request
        true,   -- duplicate (race condition)
        true;   -- success (returning existing)
      RETURN;
    ELSE
      -- Could not find existing customer, re-raise error
      RAISE EXCEPTION 'Unique constraint violation but could not find existing customer';
    END IF;

  WHEN OTHERS THEN
    -- Log error details and re-raise
    RAISE EXCEPTION 'Failed to create customer: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_customer_safe(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION create_customer_safe(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION create_customer_safe IS
'Atomically creates a customer with idempotency, duplicate detection, and data normalization. Handles walk-in customers with auto-generated emails. Uses SECURITY DEFINER for consistent behavior. Returns creation status and customer ID.';
