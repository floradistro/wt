-- ============================================================================
-- URGENT FIX: Sales are failing with "column pr.is_active does not exist"
-- ============================================================================
-- COPY THIS ENTIRE FILE AND PASTE INTO SUPABASE SQL EDITOR, THEN CLICK "RUN"
-- https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/sql
-- ============================================================================

DROP FUNCTION IF EXISTS get_processor_for_register(UUID);

CREATE FUNCTION get_processor_for_register(p_register_id UUID)
RETURNS TABLE (
  processor_id UUID,
  processor_type TEXT,
  environment TEXT,
  authkey TEXT,
  tpn TEXT,
  api_login_id TEXT,
  transaction_key TEXT,
  signature_key TEXT,
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
    AND pp.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_processor_for_register(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_processor_for_register(UUID) TO service_role;

-- Verify the fix
SELECT 'SUCCESS: Function fixed! Sales should work now.' as status;
