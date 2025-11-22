-- ============================================================================
-- FIX LOYALTY POINTS DOUBLE-COUNTING BUG
-- ============================================================================
-- ISSUE: The existing trigger `update_loyalty_balance` on loyalty_transactions
-- automatically updates customer.loyalty_points when rows are inserted.
-- Our atomic function was ALSO manually updating the balance, causing 2x points.
--
-- FIX: Remove the manual UPDATE and let the trigger do its job.
-- The trigger is already tested and works correctly.
-- ============================================================================

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
  -- Validate inputs
  IF p_points_earned < 0 THEN
    RAISE EXCEPTION 'Points earned cannot be negative: %', p_points_earned;
  END IF;

  IF p_points_redeemed < 0 THEN
    RAISE EXCEPTION 'Points redeemed cannot be negative: %', p_points_redeemed;
  END IF;

  -- Lock customer row and get current balance for redemption validation
  IF p_points_redeemed > 0 THEN
    SELECT loyalty_points INTO v_current_points
    FROM customers
    WHERE id = p_customer_id
    FOR UPDATE; -- Row-level lock to prevent race conditions

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found: %', p_customer_id;
    END IF;

    IF v_current_points < p_points_redeemed THEN
      RAISE EXCEPTION 'Insufficient loyalty points. Available: %, Requested: %',
        v_current_points, p_points_redeemed;
    END IF;
  END IF;

  -- Get balance before any transactions
  SELECT loyalty_points INTO v_balance_before
  FROM customers
  WHERE id = p_customer_id;

  -- Record redemption transaction (if any)
  -- The existing trigger `update_loyalty_balance` will automatically update customer.loyalty_points
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
      'Points redeemed at checkout',
      v_balance_before,
      v_balance_before - p_points_redeemed,
      NOW()
    );

    -- Update balance_before for next transaction
    v_balance_before := v_balance_before - p_points_redeemed;
  END IF;

  -- Record earning transaction (if any)
  -- The existing trigger `update_loyalty_balance` will automatically update customer.loyalty_points
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

  -- REMOVED: Manual UPDATE of customer.loyalty_points
  -- The trigger `update_loyalty_balance` handles this automatically
  -- This was causing double-counting bug (2x points added)

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_customer_loyalty_points_atomic IS
'Atomically updates customer loyalty points after successful payment.
Validates sufficient points for redemption, uses row-level locking to prevent race conditions,
and creates audit trail in loyalty_transactions table.
Customer balance is updated automatically by the existing update_loyalty_balance trigger.
FIXED: Removed manual UPDATE that was causing double-counting bug.';
