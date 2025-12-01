-- ============================================================================
-- FIX: REMOVE DOUBLE LOYALTY POINTS UPDATE
-- ============================================================================
-- BUG: After migration 092 added the trigger, loyalty points are being updated
-- TWICE:
--   1. By the trigger when INSERT into loyalty_transactions
--   2. By the manual UPDATE in update_customer_loyalty_points_atomic()
--
-- The "in case trigger didn't fire" comment was from before the trigger existed.
-- Now that the trigger exists and works, we need to remove the manual UPDATE.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_customer_loyalty_points_atomic(
  p_customer_id UUID,
  p_order_id UUID,
  p_points_earned INTEGER,
  p_points_redeemed INTEGER,
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

  -- NO LONGER NEEDED: The trigger handles updating customers.loyalty_points
  -- The old code here was doing a DOUBLE update:
  --   UPDATE customers SET loyalty_points = loyalty_points + p_points_earned - p_points_redeemed
  -- But the trigger already does this when we INSERT into loyalty_transactions above

  -- Just update the updated_at timestamp
  UPDATE customers
  SET updated_at = NOW()
  WHERE id = p_customer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION update_customer_loyalty_points_atomic IS
'Atomically updates customer loyalty points for an order.
FIXED: Removed manual points update since trigger_update_loyalty_balance now handles it.
The trigger fires on INSERT to loyalty_transactions and updates customers.loyalty_points.';
