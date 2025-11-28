-- ============================================================================
-- FIX PAYMENT PROCESSOR FUNCTIONS FOR EXISTING SCHEMA
-- ============================================================================
-- Updates database functions to work with existing prefixed column names:
-- - dejavoo_authkey, dejavoo_tpn (not authkey, tpn)
-- - authorizenet_api_login_id, authorizenet_transaction_key
-- ============================================================================

-- Drop existing function first (can't change return type without dropping)
DROP FUNCTION IF EXISTS get_processor_for_register(UUID);

-- Create get_processor_for_register with correct prefixed column names
CREATE FUNCTION get_processor_for_register(p_register_id UUID)
RETURNS TABLE (
  processor_id UUID,
  processor_type TEXT,
  environment TEXT,
  authkey TEXT,  -- Maps to dejavoo_authkey
  tpn TEXT,      -- Maps to dejavoo_tpn
  api_login_id TEXT,      -- Maps to authorizenet_api_login_id
  transaction_key TEXT,   -- Maps to authorizenet_transaction_key
  signature_key TEXT,     -- Will be added in next migration
  register_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id as processor_id,
    pp.processor_type,
    pp.environment,
    pp.dejavoo_authkey as authkey,
    pp.dejavoo_tpn as tpn,
    pp.authorizenet_api_login_id as api_login_id,
    pp.authorizenet_transaction_key as transaction_key,
    NULL::TEXT as signature_key,  -- Will be populated when column is added
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
'Retrieves payment processor for a POS register. Maps prefixed columns (dejavoo_*, authorizenet_*) to generic names for Edge Function compatibility.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Updated get_processor_for_register to use existing schema';
  RAISE NOTICE '   Maps: dejavoo_authkey → authkey, authorizenet_api_login_id → api_login_id';
END $$;
