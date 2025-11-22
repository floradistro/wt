-- ============================================================================
-- ADD get_processor_for_register FUNCTION
-- ============================================================================
-- This function retrieves the payment processor configuration for a given register
-- Returns processor details including authkey, tpn, environment, etc.
-- Called by process-checkout Edge Function to process card payments
-- ============================================================================

CREATE OR REPLACE FUNCTION get_processor_for_register(p_register_id UUID)
RETURNS TABLE (
  processor_id UUID,
  processor_type TEXT,
  environment TEXT,
  authkey TEXT,
  tpn TEXT,
  register_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id as processor_id,
    pp.processor_type,
    pp.environment,
    pp.authkey,
    pp.tpn,
    pr.id as register_id
  FROM pos_registers pr
  JOIN payment_processors pp ON pp.id = pr.payment_processor_id
  WHERE pr.id = p_register_id
    AND pr.is_active = TRUE
    AND pp.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_processor_for_register(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_processor_for_register(UUID) TO service_role;

-- Comment
COMMENT ON FUNCTION get_processor_for_register(UUID) IS
'Retrieves the payment processor configuration for a given POS register. Returns processor details needed for payment processing.';
