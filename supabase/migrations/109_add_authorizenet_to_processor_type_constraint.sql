-- ============================================================================
-- ADD AUTHORIZENET TO PROCESSOR TYPE CONSTRAINT
-- ============================================================================
-- Updates the check constraint on payment_processors.processor_type to include
-- 'authorizenet' as a valid processor type for e-commerce payment processing
-- ============================================================================

-- Drop existing constraint
ALTER TABLE payment_processors
  DROP CONSTRAINT IF EXISTS payment_processors_processor_type_check;

-- Recreate constraint with authorizenet included
ALTER TABLE payment_processors
  ADD CONSTRAINT payment_processors_processor_type_check
  CHECK (processor_type IN ('pax', 'stripe', 'square', 'clover', 'dejavoo', 'authorizenet'));

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added authorizenet to payment_processors processor_type constraint';
  RAISE NOTICE '   Allowed types: pax, stripe, square, clover, dejavoo, authorizenet';
END $$;
