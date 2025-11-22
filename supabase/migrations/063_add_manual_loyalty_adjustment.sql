-- ============================================================================
-- MANUAL LOYALTY POINTS ADJUSTMENT FUNCTION
-- ============================================================================
-- This function allows manual adjustment of loyalty points from the customer
-- detail screen (e.g., customer service compensations, corrections).
--
-- Different from the atomic checkout function - this is for manual adjustments
-- by staff, not automated checkout calculations.
-- ============================================================================

CREATE OR REPLACE FUNCTION adjust_customer_loyalty_points(
  p_customer_id UUID,
  p_points_change INTEGER,
  p_reason TEXT DEFAULT 'Manual adjustment'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_points INTEGER;
  v_balance_before INTEGER;
  v_balance_after INTEGER;
BEGIN
  -- Validate input
  IF p_points_change = 0 THEN
    RAISE EXCEPTION 'Points change cannot be zero';
  END IF;

  -- Lock customer row and get current balance
  SELECT loyalty_points INTO v_current_points
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE; -- Row-level lock

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_id;
  END IF;

  -- Don't allow negative balance
  IF (v_current_points + p_points_change) < 0 THEN
    RAISE EXCEPTION 'Cannot adjust points below zero. Current: %, Requested change: %',
      v_current_points, p_points_change;
  END IF;

  v_balance_before := v_current_points;
  v_balance_after := v_current_points + p_points_change;

  -- Record adjustment transaction
  -- The existing trigger `update_loyalty_balance` will automatically update customer.loyalty_points
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
    p_points_change,
    'adjusted', -- Use 'adjusted' type for manual changes
    'manual',
    NULL,
    p_reason,
    v_balance_before,
    v_balance_after,
    NOW()
  );

  -- Customer balance is updated automatically by the existing trigger

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION adjust_customer_loyalty_points(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_customer_loyalty_points(UUID, INTEGER, TEXT) TO service_role;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON FUNCTION adjust_customer_loyalty_points IS
'Manually adjust customer loyalty points for customer service purposes.
Used by customer detail screen for manual corrections, compensations, etc.
Creates audit trail in loyalty_transactions with type=adjusted.
Customer balance is updated automatically by existing trigger.';
