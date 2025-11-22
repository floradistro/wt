-- ============================================================================
-- CLEANUP: Remove Orphaned Loyalty Functions
-- ============================================================================
-- Apple Engineering: Delete unused code that creates confusion
--
-- This migration removes database functions that are no longer used:
-- 1. record_loyalty_transaction_atomic - Orphaned from old implementation
--
-- Current active functions (KEEP):
-- ✅ calculate_loyalty_points_to_earn - Used by edge function
-- ✅ update_customer_loyalty_points_atomic - Used by edge function
-- ✅ adjust_customer_loyalty_points - Used by customer service
-- ✅ update_customer_loyalty_balance - Trigger function
-- ============================================================================

-- Drop orphaned function (if exists)
DROP FUNCTION IF EXISTS record_loyalty_transaction_atomic(UUID, UUID, INTEGER, INTEGER, NUMERIC);

-- Verify we have exactly the functions we need
COMMENT ON FUNCTION calculate_loyalty_points_to_earn IS
'✅ ACTIVE: Called by process-checkout edge function to calculate points server-side';

COMMENT ON FUNCTION update_customer_loyalty_points_atomic IS
'✅ ACTIVE: Called by process-checkout edge function for atomic point updates';

COMMENT ON FUNCTION adjust_customer_loyalty_points IS
'✅ ACTIVE: Called by customer service for manual point adjustments';

COMMENT ON FUNCTION update_customer_loyalty_balance IS
'✅ ACTIVE: Trigger function that updates customer.loyalty_points when loyalty_transactions are inserted';
