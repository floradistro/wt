-- ============================================================================
-- ATOMIC LOYALTY POINTS SYSTEM
-- ============================================================================
-- This migration adds atomic loyalty points handling to prevent race conditions
-- and ensure consistency with the checkout transaction.
--
-- Flow:
-- 1. Before payment: Validate customer has sufficient points for redemption
-- 2. After successful payment: Atomically update points and record transaction
-- 3. After failed payment: No points changes (automatic rollback)
--
-- Integration with process-checkout Edge Function:
-- - Called in STEP 9.5 (after inventory finalization, before session update)
-- - Uses row-level locking to prevent concurrent point redemptions
-- - Works with existing loyalty_transactions schema
-- ============================================================================

-- ============================================================================
-- DROP OLD FUNCTIONS (if they exist with different signatures)
-- ============================================================================

DROP FUNCTION IF EXISTS update_customer_loyalty_points(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_customer_loyalty_points(UUID, INTEGER, INTEGER, UUID, NUMERIC);

-- ============================================================================
-- FUNCTION: UPDATE CUSTOMER LOYALTY POINTS (Atomic)
-- ============================================================================
-- Works with existing loyalty_transactions schema:
-- - Uses reference_type='order' and reference_id instead of order_id FK
-- - Records both earned and redeemed in separate transactions
-- - Leverages existing update_customer_loyalty_balance trigger

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

  -- Update customer loyalty balance (in case trigger didn't fire)
  UPDATE customers
  SET
    loyalty_points = loyalty_points + p_points_earned - p_points_redeemed,
    updated_at = NOW()
  WHERE id = p_customer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: CALCULATE LOYALTY POINTS TO EARN
-- ============================================================================
-- Helper function that can be called from Edge Function to calculate points
-- consistently with loyalty program rules

CREATE OR REPLACE FUNCTION calculate_loyalty_points_to_earn(
  p_vendor_id UUID,
  p_subtotal NUMERIC
)
RETURNS INTEGER AS $$
DECLARE
  v_loyalty_program RECORD;
  v_points_to_earn INTEGER;
BEGIN
  -- Get active loyalty program for vendor
  SELECT points_per_dollar
  INTO v_loyalty_program
  FROM loyalty_programs
  WHERE vendor_id = p_vendor_id
    AND is_active = TRUE
  LIMIT 1;

  -- No active program = no points
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate points
  v_points_to_earn := FLOOR(p_subtotal * v_loyalty_program.points_per_dollar);

  RETURN COALESCE(v_points_to_earn, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION update_customer_loyalty_points_atomic(UUID, INTEGER, INTEGER, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_loyalty_points_atomic(UUID, INTEGER, INTEGER, UUID, NUMERIC) TO service_role;

GRANT EXECUTE ON FUNCTION calculate_loyalty_points_to_earn(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_loyalty_points_to_earn(UUID, NUMERIC) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION update_customer_loyalty_points_atomic IS
'Atomically updates customer loyalty points after successful payment.
Validates sufficient points for redemption, uses row-level locking to prevent race conditions,
and creates audit trail in loyalty_transactions table. Called from process-checkout Edge Function.
Works with existing loyalty_transactions schema (reference_type/reference_id pattern).';

COMMENT ON FUNCTION calculate_loyalty_points_to_earn IS
'Calculates loyalty points to earn based on vendor loyalty program and purchase subtotal.
Used by process-checkout Edge Function to calculate points server-side.';

-- ============================================================================
-- RECONCILIATION QUEUE (for failed loyalty updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS loyalty_reconciliation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  points_earned INTEGER NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  order_total NUMERIC NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_reconciliation_unresolved
  ON loyalty_reconciliation_queue(resolved, created_at)
  WHERE resolved = FALSE;

-- RLS policies
ALTER TABLE loyalty_reconciliation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage loyalty reconciliation queue"
  ON loyalty_reconciliation_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON loyalty_reconciliation_queue TO authenticated;
GRANT ALL ON loyalty_reconciliation_queue TO service_role;

COMMENT ON TABLE loyalty_reconciliation_queue IS
'Queue for loyalty point updates that failed during checkout. Allows manual or automated reconciliation later.';
