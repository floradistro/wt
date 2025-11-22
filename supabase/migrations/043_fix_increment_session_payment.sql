-- ============================================================================
-- FIX increment_session_payment FUNCTION
-- ============================================================================
-- The previous version had a type error where v_success was declared as BOOLEAN
-- but GET DIAGNOSTICS sets it to an INTEGER (ROW_COUNT)
-- This caused the comparison v_success > 0 to fail
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_session_payment(
  p_session_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  -- Update the appropriate total based on payment method
  IF p_payment_method = 'cash' THEN
    UPDATE pos_sessions
    SET
      total_cash = COALESCE(total_cash, 0) + p_amount,
      total_sales = COALESCE(total_sales, 0) + p_amount,
      total_transactions = COALESCE(total_transactions, 0) + 1,
      last_transaction_at = NOW(),
      updated_at = NOW()
    WHERE id = p_session_id;

  ELSIF p_payment_method IN ('credit', 'debit') THEN
    UPDATE pos_sessions
    SET
      total_card = COALESCE(total_card, 0) + p_amount,
      total_sales = COALESCE(total_sales, 0) + p_amount,
      total_transactions = COALESCE(total_transactions, 0) + 1,
      last_transaction_at = NOW(),
      updated_at = NOW()
    WHERE id = p_session_id;

  ELSE
    -- Other payment methods (EBT, gift cards, etc.)
    UPDATE pos_sessions
    SET
      total_sales = COALESCE(total_sales, 0) + p_amount,
      total_transactions = COALESCE(total_transactions, 0) + 1,
      last_transaction_at = NOW(),
      updated_at = NOW()
    WHERE id = p_session_id;
  END IF;

  -- Check if update was successful
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_session_payment(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_session_payment(UUID, NUMERIC, TEXT) TO service_role;

-- Comment
COMMENT ON FUNCTION increment_session_payment(UUID, NUMERIC, TEXT) IS
'Increments session payment totals. Fixed type error where v_success was BOOLEAN but ROW_COUNT returns INTEGER.';
