-- ============================================================================
-- CASH DROPS & SAFE TRACKING SYSTEM
-- ============================================================================
-- This migration adds:
-- 1. pos_cash_drops table - track cash moved from drawer to safe
-- 2. pos_safe_transactions table - track all safe activity (deposits, withdrawals, counts)
-- 3. Helper functions for cash management
-- ============================================================================

-- ============================================================================
-- 1. POS CASH DROPS TABLE
-- ============================================================================
-- Tracks each time cash is moved from the drawer to the safe during a shift

CREATE TABLE IF NOT EXISTS pos_cash_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  register_id UUID NOT NULL REFERENCES pos_registers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,

  -- Cash drop details
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  notes TEXT,

  -- Drawer state tracking
  drawer_balance_before DECIMAL(10,2),
  drawer_balance_after DECIMAL(10,2),

  -- User tracking
  dropped_by_user_id UUID REFERENCES auth.users(id),
  dropped_by_name TEXT,

  -- Timestamps
  dropped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cash_drops_vendor ON pos_cash_drops(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cash_drops_location ON pos_cash_drops(location_id);
CREATE INDEX IF NOT EXISTS idx_cash_drops_session ON pos_cash_drops(session_id);
CREATE INDEX IF NOT EXISTS idx_cash_drops_dropped_at ON pos_cash_drops(dropped_at DESC);

-- ============================================================================
-- 2. POS SAFE TRANSACTIONS TABLE
-- ============================================================================
-- Tracks all safe activity at each location

CREATE TABLE IF NOT EXISTS pos_safe_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Transaction type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'cash_drop',      -- Cash moved from drawer to safe
    'deposit',        -- Cash deposited to bank
    'withdrawal',     -- Cash withdrawn for change/float
    'count',          -- Manual safe count (reconciliation)
    'adjustment'      -- Manual adjustment (discrepancy correction)
  )),

  -- Amount (positive for deposits/drops, negative for withdrawals)
  amount DECIMAL(10,2) NOT NULL,

  -- Running balance tracking
  balance_before DECIMAL(10,2),
  balance_after DECIMAL(10,2),

  -- Reference to related records
  cash_drop_id UUID REFERENCES pos_cash_drops(id) ON DELETE SET NULL,
  session_id UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,

  -- Details
  notes TEXT,

  -- User tracking
  performed_by_user_id UUID REFERENCES auth.users(id),
  performed_by_name TEXT,

  -- Timestamps
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_safe_transactions_vendor ON pos_safe_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_safe_transactions_location ON pos_safe_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_safe_transactions_type ON pos_safe_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_safe_transactions_performed_at ON pos_safe_transactions(performed_at DESC);

-- ============================================================================
-- 3. POS SAFE BALANCES VIEW
-- ============================================================================
-- Current safe balance per location (calculated from transactions)

CREATE OR REPLACE VIEW pos_safe_balances AS
SELECT
  location_id,
  vendor_id,
  COALESCE(SUM(amount), 0) as current_balance,
  COUNT(*) FILTER (WHERE transaction_type = 'cash_drop') as total_drops,
  COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'cash_drop'), 0) as total_dropped,
  COUNT(*) FILTER (WHERE transaction_type = 'deposit') as total_deposits,
  COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'deposit'), 0) as total_deposited,
  MAX(performed_at) as last_transaction_at
FROM pos_safe_transactions
GROUP BY location_id, vendor_id;

-- ============================================================================
-- 4. RECORD CASH DROP FUNCTION
-- ============================================================================
-- Atomic function to record a cash drop from drawer to safe

CREATE OR REPLACE FUNCTION record_cash_drop(
  p_vendor_id UUID,
  p_location_id UUID,
  p_register_id UUID,
  p_session_id UUID,
  p_amount DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_cash_drop_id UUID;
  v_safe_transaction_id UUID;
  v_drawer_balance_before DECIMAL;
  v_drawer_balance_after DECIMAL;
  v_safe_balance_before DECIMAL;
  v_safe_balance_after DECIMAL;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Amount must be greater than 0'
    );
  END IF;

  -- Get current drawer balance from session
  SELECT
    COALESCE(opening_cash, 0) + COALESCE(total_cash, 0)
  INTO v_drawer_balance_before
  FROM pos_sessions
  WHERE id = p_session_id;

  -- Calculate new drawer balance
  v_drawer_balance_after := v_drawer_balance_before - p_amount;

  -- Get current safe balance
  SELECT COALESCE(SUM(amount), 0)
  INTO v_safe_balance_before
  FROM pos_safe_transactions
  WHERE location_id = p_location_id;

  v_safe_balance_after := v_safe_balance_before + p_amount;

  -- Create cash drop record
  INSERT INTO pos_cash_drops (
    vendor_id,
    location_id,
    register_id,
    session_id,
    amount,
    notes,
    drawer_balance_before,
    drawer_balance_after,
    dropped_by_user_id,
    dropped_by_name
  ) VALUES (
    p_vendor_id,
    p_location_id,
    p_register_id,
    p_session_id,
    p_amount,
    p_notes,
    v_drawer_balance_before,
    v_drawer_balance_after,
    p_user_id,
    p_user_name
  )
  RETURNING id INTO v_cash_drop_id;

  -- Create safe transaction record
  INSERT INTO pos_safe_transactions (
    vendor_id,
    location_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    cash_drop_id,
    session_id,
    notes,
    performed_by_user_id,
    performed_by_name
  ) VALUES (
    p_vendor_id,
    p_location_id,
    'cash_drop',
    p_amount,
    v_safe_balance_before,
    v_safe_balance_after,
    v_cash_drop_id,
    p_session_id,
    p_notes,
    p_user_id,
    p_user_name
  )
  RETURNING id INTO v_safe_transaction_id;

  -- Update session to track total drops
  UPDATE pos_sessions
  SET
    total_cash_drops = COALESCE(total_cash_drops, 0) + p_amount,
    updated_at = NOW()
  WHERE id = p_session_id;

  RETURN json_build_object(
    'success', true,
    'cash_drop_id', v_cash_drop_id,
    'safe_transaction_id', v_safe_transaction_id,
    'drawer_balance_before', v_drawer_balance_before,
    'drawer_balance_after', v_drawer_balance_after,
    'safe_balance_before', v_safe_balance_before,
    'safe_balance_after', v_safe_balance_after
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. RECORD SAFE TRANSACTION FUNCTION
-- ============================================================================
-- Generic function to record safe deposits, withdrawals, counts

CREATE OR REPLACE FUNCTION record_safe_transaction(
  p_vendor_id UUID,
  p_location_id UUID,
  p_transaction_type TEXT,
  p_amount DECIMAL,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_transaction_id UUID;
  v_balance_before DECIMAL;
  v_balance_after DECIMAL;
  v_actual_amount DECIMAL;
BEGIN
  -- Validate transaction type
  IF p_transaction_type NOT IN ('deposit', 'withdrawal', 'count', 'adjustment') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid transaction type'
    );
  END IF;

  -- Get current safe balance
  SELECT COALESCE(SUM(amount), 0)
  INTO v_balance_before
  FROM pos_safe_transactions
  WHERE location_id = p_location_id;

  -- Determine actual amount (deposits go to bank = negative, withdrawals = negative from safe perspective)
  CASE p_transaction_type
    WHEN 'deposit' THEN
      -- Deposit to bank removes money from safe
      v_actual_amount := -ABS(p_amount);
    WHEN 'withdrawal' THEN
      -- Withdrawal from safe for change fund
      v_actual_amount := -ABS(p_amount);
    WHEN 'count' THEN
      -- Count sets the balance, so amount is the difference
      v_actual_amount := p_amount - v_balance_before;
    WHEN 'adjustment' THEN
      -- Adjustment can be positive or negative
      v_actual_amount := p_amount;
  END CASE;

  v_balance_after := v_balance_before + v_actual_amount;

  -- Create transaction record
  INSERT INTO pos_safe_transactions (
    vendor_id,
    location_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    notes,
    performed_by_user_id,
    performed_by_name
  ) VALUES (
    p_vendor_id,
    p_location_id,
    p_transaction_type,
    v_actual_amount,
    v_balance_before,
    v_balance_after,
    p_notes,
    p_user_id,
    p_user_name
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'amount_recorded', v_actual_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. ADD CASH DROPS TRACKING TO POS_SESSIONS
-- ============================================================================
-- Add column to track total cash drops during a session

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pos_sessions' AND column_name = 'total_cash_drops'
  ) THEN
    ALTER TABLE pos_sessions ADD COLUMN total_cash_drops DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 7. GET SAFE BALANCE FUNCTION
-- ============================================================================
-- Quick function to get current safe balance for a location

CREATE OR REPLACE FUNCTION get_safe_balance(p_location_id UUID)
RETURNS DECIMAL AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(amount) FROM pos_safe_transactions WHERE location_id = p_location_id),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 8. GET DRAWER BALANCE FUNCTION
-- ============================================================================
-- Calculate current drawer balance (opening + cash sales - drops)

CREATE OR REPLACE FUNCTION get_drawer_balance(p_session_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  SELECT
    COALESCE(opening_cash, 0) + COALESCE(total_cash, 0) - COALESCE(total_cash_drops, 0)
  INTO v_balance
  FROM pos_sessions
  WHERE id = p_session_id;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE pos_cash_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_safe_transactions ENABLE ROW LEVEL SECURITY;

-- Service role bypass for cash drops
DROP POLICY IF EXISTS "Service role full access to cash drops" ON pos_cash_drops;
CREATE POLICY "Service role full access to cash drops" ON pos_cash_drops
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Location staff can view/create cash drops
DROP POLICY IF EXISTS "Location staff can view cash drops" ON pos_cash_drops;
CREATE POLICY "Location staff can view cash drops" ON pos_cash_drops
  FOR SELECT
  USING (
    location_id IN (
      SELECT location_id FROM user_locations
      WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Location staff can create cash drops" ON pos_cash_drops;
CREATE POLICY "Location staff can create cash drops" ON pos_cash_drops
  FOR INSERT
  WITH CHECK (
    location_id IN (
      SELECT location_id FROM user_locations
      WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Service role bypass for safe transactions
DROP POLICY IF EXISTS "Service role full access to safe transactions" ON pos_safe_transactions;
CREATE POLICY "Service role full access to safe transactions" ON pos_safe_transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Location staff can view/create safe transactions
DROP POLICY IF EXISTS "Location staff can view safe transactions" ON pos_safe_transactions;
CREATE POLICY "Location staff can view safe transactions" ON pos_safe_transactions
  FOR SELECT
  USING (
    location_id IN (
      SELECT location_id FROM user_locations
      WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Location staff can create safe transactions" ON pos_safe_transactions;
CREATE POLICY "Location staff can create safe transactions" ON pos_safe_transactions
  FOR INSERT
  WITH CHECK (
    location_id IN (
      SELECT location_id FROM user_locations
      WHERE user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT ON pos_cash_drops TO authenticated;
GRANT SELECT, INSERT ON pos_safe_transactions TO authenticated;
GRANT SELECT ON pos_safe_balances TO authenticated;

GRANT EXECUTE ON FUNCTION record_cash_drop TO authenticated;
GRANT EXECUTE ON FUNCTION record_cash_drop TO service_role;
GRANT EXECUTE ON FUNCTION record_safe_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION record_safe_transaction TO service_role;
GRANT EXECUTE ON FUNCTION get_safe_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_safe_balance TO service_role;
GRANT EXECUTE ON FUNCTION get_drawer_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_drawer_balance TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE pos_cash_drops IS 'Tracks cash moved from POS drawer to safe during shifts';
COMMENT ON TABLE pos_safe_transactions IS 'Tracks all safe activity including drops, deposits, withdrawals, and counts';
COMMENT ON VIEW pos_safe_balances IS 'Current safe balance per location calculated from transactions';
COMMENT ON FUNCTION record_cash_drop IS 'Atomically records a cash drop from drawer to safe';
COMMENT ON FUNCTION record_safe_transaction IS 'Records safe deposits, withdrawals, counts, and adjustments';
COMMENT ON FUNCTION get_safe_balance IS 'Returns current safe balance for a location';
COMMENT ON FUNCTION get_drawer_balance IS 'Returns current drawer balance for a session (opening + cash - drops)';
