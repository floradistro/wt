-- ============================================================================
-- ATOMIC LOYALTY POINTS - VERIFICATION SCRIPT
-- ============================================================================
-- Run this script to verify the atomic loyalty system is working correctly
-- ============================================================================

\echo '============================================================================'
\echo 'ATOMIC LOYALTY POINTS - VERIFICATION SCRIPT'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- 1. CHECK FUNCTIONS EXIST
-- ============================================================================
\echo '1. Checking functions exist...'
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('update_customer_loyalty_points_atomic', 'calculate_loyalty_points_to_earn')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

\echo ''
\echo 'Expected: 2 rows (both functions)'
\echo ''

-- ============================================================================
-- 2. CHECK RECONCILIATION QUEUE TABLE
-- ============================================================================
\echo '2. Checking reconciliation queue table...'
SELECT COUNT(*) as unresolved_items
FROM loyalty_reconciliation_queue
WHERE resolved = false;

\echo ''
\echo 'Expected: 0 (no unresolved items initially)'
\echo ''

-- ============================================================================
-- 3. TEST CALCULATE POINTS FUNCTION
-- ============================================================================
\echo '3. Testing calculate_loyalty_points_to_earn function...'

-- Get a vendor with active loyalty program
DO $$
DECLARE
  v_vendor_id UUID;
  v_points INTEGER;
BEGIN
  -- Get first vendor with active loyalty program
  SELECT vendor_id INTO v_vendor_id
  FROM loyalty_programs
  WHERE is_active = true
  LIMIT 1;

  IF v_vendor_id IS NULL THEN
    RAISE NOTICE 'No active loyalty programs found. Skipping test.';
  ELSE
    -- Test with $100 subtotal
    SELECT calculate_loyalty_points_to_earn(v_vendor_id, 100.00) INTO v_points;
    RAISE NOTICE 'Vendor %: $100 purchase would earn % points', v_vendor_id, v_points;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- 4. TEST ATOMIC UPDATE (READ-ONLY SIMULATION)
-- ============================================================================
\echo '4. Testing atomic update function (simulation only)...'

-- Get a test customer (won't actually modify)
SELECT
  c.id as customer_id,
  c.first_name,
  c.last_name,
  c.loyalty_points as current_balance,
  CASE
    WHEN c.loyalty_points >= 50 THEN 'Can redeem 50 points'
    ELSE 'Cannot redeem 50 points'
  END as test_status
FROM customers c
WHERE c.is_active = true
  AND c.loyalty_points > 0
LIMIT 5;

\echo ''
\echo 'Above customers can be used for testing.'
\echo 'To actually test the function, use:'
\echo '  SELECT update_customer_loyalty_points_atomic(<customer_id>, <points_earned>, <points_redeemed>, <order_id>, <order_total>);'
\echo ''

-- ============================================================================
-- 5. CHECK RECENT LOYALTY TRANSACTIONS
-- ============================================================================
\echo '5. Recent loyalty transactions (last 10)...'
SELECT
  lt.created_at,
  c.first_name || ' ' || c.last_name as customer,
  lt.transaction_type,
  lt.points,
  lt.balance_before,
  lt.balance_after,
  lt.reference_type,
  SUBSTRING(lt.reference_id, 1, 8) as reference_id
FROM loyalty_transactions lt
JOIN customers c ON c.id = lt.customer_id
ORDER BY lt.created_at DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 6. INTEGRITY CHECK
-- ============================================================================
\echo '6. Checking customer balance integrity (should be empty)...'
SELECT
  c.id,
  c.first_name || ' ' || c.last_name as customer,
  c.loyalty_points as current_balance,
  COALESCE(SUM(lt.points), 0) as calculated_balance,
  c.loyalty_points - COALESCE(SUM(lt.points), 0) as discrepancy
FROM customers c
LEFT JOIN loyalty_transactions lt ON lt.customer_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.first_name, c.last_name, c.loyalty_points
HAVING c.loyalty_points != COALESCE(SUM(lt.points), 0)
ORDER BY ABS(c.loyalty_points - COALESCE(SUM(lt.points), 0)) DESC
LIMIT 10;

\echo ''
\echo 'Expected: 0 rows (all balances match transaction history)'
\echo '(Note: May show discrepancies if transactions existed before this system)'
\echo ''

-- ============================================================================
-- 7. SUMMARY
-- ============================================================================
\echo '============================================================================'
\echo 'VERIFICATION COMPLETE'
\echo '============================================================================'
\echo ''
\echo 'Next Steps:'
\echo '1. Test a real checkout with loyalty points in the app'
\echo '2. Monitor edge function logs: supabase functions logs process-checkout --follow'
\echo '3. Check Sentry for any errors'
\echo '4. Run this script again after a few checkouts to verify integrity'
\echo ''
\echo 'For detailed testing instructions, see: ATOMIC_LOYALTY_DEPLOYMENT.md'
\echo ''
