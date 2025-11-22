-- ============================================================================
-- ADD check_idempotent_order FUNCTION
-- ============================================================================
-- This function checks if an order with the given idempotency key already exists
-- Returns order details if found, or null if not found
-- Called by process-checkout Edge Function to prevent duplicate orders
-- ============================================================================

CREATE OR REPLACE FUNCTION check_idempotent_order(p_idempotency_key TEXT)
RETURNS TABLE (
  order_exists BOOLEAN,
  order_id UUID,
  order_status TEXT,
  payment_status TEXT,
  total_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as order_exists,
    o.id as order_id,
    o.status as order_status,
    o.payment_status,
    o.total_amount
  FROM orders o
  WHERE o.idempotency_key = p_idempotency_key
  LIMIT 1;

  -- If no rows found, the function will return an empty result set
  -- which the Edge Function interprets as "no existing order"
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_idempotent_order(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_idempotent_order(TEXT) TO service_role;

-- Comment
COMMENT ON FUNCTION check_idempotent_order(TEXT) IS
'Checks if an order with the given idempotency key already exists. Returns order details if found. Used to prevent duplicate order creation.';
