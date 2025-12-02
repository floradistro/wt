-- ============================================================================
-- FIX: CORRECT LOYALTY FUNCTION - FINAL DEFINITIVE VERSION
-- ============================================================================
-- HISTORY OF BUGS:
-- 1. Migration 061: Created function WITH manual UPDATE
-- 2. Migration 062: Removed manual UPDATE (relies on trigger)
-- 3. Migration 092: Created the trigger
-- 4. Migration 100: RE-ADDED manual UPDATE (bug reintroduced!)
-- 5. Migration 200: Tried to fix but had wrong parameter order
--
-- This migration:
-- 1. Drops ALL versions of the function
-- 2. Recreates with CORRECT parameter order matching process-checkout
-- 3. NO MANUAL UPDATE - trigger handles it
-- 4. Also fixes the trigger to handle NULL values
--
-- Edge function calls:
--   update_customer_loyalty_points_atomic(customerId, pointsEarned, pointsRedeemed, orderId, total)
-- ============================================================================

-- Drop ALL possible overloaded versions of this function
-- Using CASCADE to remove any dependencies
DROP FUNCTION IF EXISTS update_customer_loyalty_points_atomic(UUID, UUID, INTEGER, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS update_customer_loyalty_points_atomic(UUID, INTEGER, INTEGER, UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS update_customer_loyalty_points_atomic(UUID, INTEGER, INTEGER, UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS update_customer_loyalty_points_atomic(UUID, INTEGER, INTEGER, UUID, DOUBLE PRECISION) CASCADE;

-- Also try dropping without specific signature (catches any remaining)
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT oid::regprocedure as func_sig
    FROM pg_proc
    WHERE proname = 'update_customer_loyalty_points_atomic'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_sig || ' CASCADE';
  END LOOP;
END $$;

-- Recreate with CORRECT parameter order (matches edge function call)
CREATE OR REPLACE FUNCTION update_customer_loyalty_points_atomic(
  p_customer_id UUID,
  p_points_earned INTEGER,
  p_points_redeemed INTEGER,
  p_order_id UUID,
  p_order_total NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_points INTEGER;
  v_balance_before INTEGER;
BEGIN
  -- Lock customer row for atomic update
  SELECT COALESCE(loyalty_points, 0) INTO v_current_points
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_id;
  END IF;

  -- Check sufficient points for redemption
  IF p_points_redeemed > 0 AND v_current_points < p_points_redeemed THEN
    RAISE EXCEPTION 'Insufficient points. Has: %, Trying to redeem: %', v_current_points, p_points_redeemed;
  END IF;

  -- Track balance for transaction records
  v_balance_before := v_current_points;

  -- Record redemption transaction (if any)
  -- The trigger will automatically update customers.loyalty_points
  IF p_points_redeemed > 0 THEN
    INSERT INTO loyalty_transactions (
      customer_id,
      points,
      transaction_type,
      reference_type,
      reference_id,
      description,
      balance_before,
      balance_after,
      created_at
    ) VALUES (
      p_customer_id,
      -p_points_redeemed, -- Negative for redemption
      'spent',
      'order',
      p_order_id::TEXT,
      FORMAT('Points redeemed on order'),
      v_balance_before,
      v_balance_before - p_points_redeemed,
      NOW()
    );

    -- Update balance_before for next transaction
    v_balance_before := v_balance_before - p_points_redeemed;
  END IF;

  -- Record earning transaction (if any)
  -- The trigger will automatically update customers.loyalty_points
  IF p_points_earned > 0 THEN
    INSERT INTO loyalty_transactions (
      customer_id,
      points,
      transaction_type,
      reference_type,
      reference_id,
      description,
      balance_before,
      balance_after,
      created_at
    ) VALUES (
      p_customer_id,
      p_points_earned, -- Positive for earning
      'earned',
      'order',
      p_order_id::TEXT,
      FORMAT('Points earned from $%s purchase', p_order_total),
      v_balance_before,
      v_balance_before + p_points_earned,
      NOW()
    );
  END IF;

  -- NO MANUAL UPDATE: The trigger handles updating customers.loyalty_points
  -- This prevents the double-counting bug

  -- Just update the updated_at timestamp
  UPDATE customers
  SET updated_at = NOW()
  WHERE id = p_customer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION update_customer_loyalty_points_atomic(UUID, INTEGER, INTEGER, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_loyalty_points_atomic(UUID, INTEGER, INTEGER, UUID, NUMERIC) TO service_role;

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON FUNCTION update_customer_loyalty_points_atomic IS
'Atomically updates customer loyalty points for an order.
Parameters (in order): customer_id, points_earned, points_redeemed, order_id, order_total
FIXED: Corrected parameter order to match edge function calls.
FIXED: Removed manual points update since trigger_update_loyalty_balance handles it.';

-- ============================================================================
-- FIX TRIGGER TO HANDLE NULL VALUES
-- ============================================================================
-- The trigger must use COALESCE to handle customers with NULL loyalty_points

CREATE OR REPLACE FUNCTION update_customer_loyalty_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer's loyalty_points based on the transaction
  -- Use COALESCE to handle NULL values (treat NULL as 0)
  UPDATE customers
  SET
    loyalty_points = COALESCE(loyalty_points, 0) + NEW.points,
    updated_at = NOW()
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_customer_loyalty_balance IS
'Trigger function that updates customer.loyalty_points when loyalty_transactions are inserted.
Uses COALESCE to handle NULL values. Points can be positive (earning) or negative (redemption).';
