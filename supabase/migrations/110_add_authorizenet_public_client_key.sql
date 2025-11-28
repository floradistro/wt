-- ============================================================================
-- ADD AUTHORIZE.NET PUBLIC CLIENT KEY
-- ============================================================================
-- Adds public_client_key column for Authorize.Net Accept.js integration
-- This is the PUBLIC key used for client-side card tokenization (PCI compliance)
-- ============================================================================

-- Add public_client_key column
ALTER TABLE payment_processors
  ADD COLUMN IF NOT EXISTS authorizenet_public_client_key TEXT;

-- Update get_ecommerce_processor function to include public_client_key
CREATE OR REPLACE FUNCTION get_ecommerce_processor(p_vendor_id UUID)
RETURNS TABLE (
  processor_id UUID,
  processor_type TEXT,
  processor_name TEXT,
  environment TEXT,
  api_login_id TEXT,
  transaction_key TEXT,
  signature_key TEXT,
  public_client_key TEXT,
  webhook_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id as processor_id,
    pp.processor_type,
    pp.processor_name,
    pp.environment,
    pp.authorizenet_api_login_id as api_login_id,
    pp.authorizenet_transaction_key as transaction_key,
    pp.authorizenet_signature_key as signature_key,
    pp.authorizenet_public_client_key as public_client_key,
    pp.webhook_url
  FROM payment_processors pp
  WHERE pp.vendor_id = p_vendor_id
    AND pp.is_active = TRUE
    AND pp.is_ecommerce_processor = TRUE
    AND pp.location_id IS NULL
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_ecommerce_processor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ecommerce_processor(UUID) TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added authorizenet_public_client_key column';
  RAISE NOTICE '✅ Updated get_ecommerce_processor function to return public_client_key';
  RAISE NOTICE '   Public Client Key is used by Accept.js for PCI-compliant tokenization';
END $$;
