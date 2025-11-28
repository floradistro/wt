-- ============================================================================
-- FIX: CREATE MISSING LOYALTY BALANCE TRIGGER
-- ============================================================================
-- CRITICAL BUG: Migration 062 removed the manual UPDATE expecting trigger
-- `update_loyalty_balance` to handle it, but that trigger was never created!
--
-- Result: Loyalty redemptions create transactions but don't update balance
-- Customer sees points redeemed but balance stays the same
--
-- This migration creates the missing trigger
-- ============================================================================

-- ============================================================================
-- TRIGGER FUNCTION: Update customer loyalty balance
-- ============================================================================
CREATE OR REPLACE FUNCTION update_customer_loyalty_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer's loyalty_points based on the transaction
  UPDATE customers
  SET
    loyalty_points = loyalty_points + NEW.points,
    updated_at = NOW()
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-update customer balance on loyalty transaction insert
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_loyalty_balance ON loyalty_transactions;

CREATE TRIGGER trigger_update_loyalty_balance
  AFTER INSERT ON loyalty_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_loyalty_balance();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION update_customer_loyalty_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION update_customer_loyalty_balance() TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION update_customer_loyalty_balance IS
'✅ ACTIVE: Trigger function that updates customer.loyalty_points when loyalty_transactions are inserted.
CRITICAL: This was referenced in migration 062 but never actually created, causing loyalty redemptions to fail.
Now when a transaction is inserted:
- NEW.points is positive: Balance increases (earning)
- NEW.points is negative: Balance decreases (redemption)';

COMMENT ON TRIGGER trigger_update_loyalty_balance ON loyalty_transactions IS
'Auto-updates customer loyalty balance when transactions are recorded.
This trigger ensures customer.loyalty_points stays in sync with loyalty_transactions table.';
