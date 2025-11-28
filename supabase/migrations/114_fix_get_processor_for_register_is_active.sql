-- ============================================================================
-- FIX: Remove pr.is_active check from get_processor_for_register
-- ============================================================================
-- The pos_registers table doesn't have an is_active column
-- This was causing ALL sales to fail with "column pr.is_active does not exist"
-- ============================================================================

DROP FUNCTION IF EXISTS get_processor_for_register(UUID);

CREATE FUNCTION get_processor_for_register(p_register_id UUID)
RETURNS TABLE (
  processor_id UUID,
  processor_type TEXT,
  environment TEXT,
  authkey TEXT,  -- Maps to dejavoo_authkey
  tpn TEXT,      -- Maps to dejavoo_tpn
  api_login_id TEXT,      -- Maps to authorizenet_api_login_id
  transaction_key TEXT,   -- Maps to authorizenet_transaction_key
  signature_key TEXT,     -- For future use
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
    NULL::TEXT as signature_key,
    pr.id as register_id
  FROM pos_registers pr
  JOIN payment_processors pp ON pp.id = pr.payment_processor_id
  WHERE pr.id = p_register_id
    AND pp.is_active = TRUE  -- Only check processor is_active, not register
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_processor_for_register(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_processor_for_register(UUID) TO service_role;

-- Comment
COMMENT ON FUNCTION get_processor_for_register(UUID) IS
'Retrieves payment processor for a POS register. Maps prefixed columns (dejavoo_*, authorizenet_*) to generic names for Edge Function compatibility. Fixed: removed invalid pr.is_active check.';
