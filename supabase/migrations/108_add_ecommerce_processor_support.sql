-- ============================================================================
-- ADD E-COMMERCE PROCESSOR SUPPORT
-- ============================================================================
-- Adds missing columns and functions for e-commerce processor support
-- - is_ecommerce_processor flag (vendor-level vs location-based)
-- - authorizenet_signature_key (for webhooks)
-- - get_ecommerce_processor() function
-- ============================================================================

-- Add is_ecommerce_processor column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_processors' AND column_name = 'is_ecommerce_processor'
  ) THEN
    ALTER TABLE payment_processors
      ADD COLUMN is_ecommerce_processor BOOLEAN NOT NULL DEFAULT FALSE;
    RAISE NOTICE 'Added is_ecommerce_processor column';
  ELSE
    RAISE NOTICE 'is_ecommerce_processor column already exists';
  END IF;
END $$;

-- Add signature_key column for Authorize.Net webhooks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_processors' AND column_name = 'authorizenet_signature_key'
  ) THEN
    ALTER TABLE payment_processors
      ADD COLUMN authorizenet_signature_key TEXT;
    RAISE NOTICE 'Added authorizenet_signature_key column';
  ELSE
    RAISE NOTICE 'authorizenet_signature_key column already exists';
  END IF;
END $$;

-- Add webhook URL column (generic for all processors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_processors' AND column_name = 'webhook_url'
  ) THEN
    ALTER TABLE payment_processors
      ADD COLUMN webhook_url TEXT;
    RAISE NOTICE 'Added webhook_url column';
  ELSE
    RAISE NOTICE 'webhook_url column already exists';
  END IF;
END $$;

-- Only one e-commerce processor per vendor
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_processors_ecommerce_per_vendor
  ON payment_processors (vendor_id)
  WHERE is_ecommerce_processor = TRUE;

-- E-commerce processors must NOT have a location_id (vendor-level only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_processors_ecommerce_location_check'
  ) THEN
    ALTER TABLE payment_processors
      ADD CONSTRAINT payment_processors_ecommerce_location_check
      CHECK (
        (is_ecommerce_processor = FALSE) OR
        (is_ecommerce_processor = TRUE AND location_id IS NULL)
      );
    RAISE NOTICE 'Added e-commerce location constraint';
  ELSE
    RAISE NOTICE 'E-commerce location constraint already exists';
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN payment_processors.is_ecommerce_processor IS
  'TRUE for vendor-level e-commerce gateway (Authorize.Net), FALSE for location-based POS (Dejavoo)';
COMMENT ON COLUMN payment_processors.authorizenet_signature_key IS
  'Authorize.Net Signature Key for webhook validation (optional)';
COMMENT ON COLUMN payment_processors.webhook_url IS
  'Webhook endpoint URL for payment notifications (e-commerce only)';

-- Create function to get e-commerce processor for a vendor
-- Returns the single vendor-level Authorize.Net processor
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
    AND pp.location_id IS NULL  -- Vendor-level only
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_ecommerce_processor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ecommerce_processor(UUID) TO service_role;

-- Comment
COMMENT ON FUNCTION get_ecommerce_processor(UUID) IS
'Retrieves vendor-level e-commerce processor (Authorize.Net) for online orders. Separate from location-based POS processors.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ E-commerce processor support added successfully';
  RAISE NOTICE '';
  RAISE NOTICE 'ARCHITECTURE:';
  RAISE NOTICE '  POS (In-Store):  Location-based, uses get_processor_for_register()';
  RAISE NOTICE '  E-Commerce:      Vendor-level, uses get_ecommerce_processor()';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Create Authorize.Net processor with is_ecommerce_processor=TRUE';
  RAISE NOTICE '  2. Set location_id=NULL for e-commerce processor';
  RAISE NOTICE '  3. Configure authorizenet_api_login_id and authorizenet_transaction_key';
END $$;
