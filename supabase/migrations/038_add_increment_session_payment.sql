-- ============================================================================
-- ADD MISSING increment_session_payment FUNCTION
-- ============================================================================
-- This function is called by the process-checkout Edge Function to update
-- POS session totals when a payment is processed
-- ============================================================================

-- Drop if exists (just in case)
DROP FUNCTION IF EXISTS increment_session_payment(UUID, DECIMAL, TEXT);

-- Create the function
CREATE OR REPLACE FUNCTION increment_session_payment(
  p_session_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_success BOOLEAN := FALSE;
BEGIN
  -- Update the appropriate total based on payment method
  CASE
    WHEN p_payment_method = 'cash' THEN
      UPDATE pos_sessions
      SET
        total_cash = COALESCE(total_cash, 0) + p_amount,
        total_sales = COALESCE(total_sales, 0) + p_amount,
        total_transactions = COALESCE(total_transactions, 0) + 1,
        last_transaction_at = NOW(),
        updated_at = NOW()
      WHERE id = p_session_id;

    WHEN p_payment_method IN ('credit', 'debit') THEN
      UPDATE pos_sessions
      SET
        total_card = COALESCE(total_card, 0) + p_amount,
        total_sales = COALESCE(total_sales, 0) + p_amount,
        total_transactions = COALESCE(total_transactions, 0) + 1,
        last_transaction_at = NOW(),
        updated_at = NOW()
      WHERE id = p_session_id;

    ELSE
      -- Other payment methods (EBT, gift cards, etc.) - just add to total_sales
      UPDATE pos_sessions
      SET
        total_sales = COALESCE(total_sales, 0) + p_amount,
        total_transactions = COALESCE(total_transactions, 0) + 1,
        last_transaction_at = NOW(),
        updated_at = NOW()
      WHERE id = p_session_id;
  END CASE;

  -- Check if update was successful
  GET DIAGNOSTICS v_success = ROW_COUNT;

  RETURN v_success > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_session_payment(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_session_payment(UUID, DECIMAL, TEXT) TO service_role;

-- Comment
COMMENT ON FUNCTION increment_session_payment(UUID, DECIMAL, TEXT) IS
'Updates POS session totals (cash_total, card_total, other_total, total_sales) when a payment is processed. Called by process-checkout Edge Function.';
