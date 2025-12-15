-- ============================================================================
-- FIX CASH DROPS USER FOREIGN KEY
-- ============================================================================
-- The dropped_by_user_id and performed_by_user_id columns should reference
-- the users table (not auth.users) since we use users.id throughout the app
-- ============================================================================

-- Drop the old FK constraints
ALTER TABLE pos_cash_drops
  DROP CONSTRAINT IF EXISTS pos_cash_drops_dropped_by_user_id_fkey;

ALTER TABLE pos_safe_transactions
  DROP CONSTRAINT IF EXISTS pos_safe_transactions_performed_by_user_id_fkey;

-- Add new FK constraints referencing users table
ALTER TABLE pos_cash_drops
  ADD CONSTRAINT pos_cash_drops_dropped_by_user_id_fkey
  FOREIGN KEY (dropped_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE pos_safe_transactions
  ADD CONSTRAINT pos_safe_transactions_performed_by_user_id_fkey
  FOREIGN KEY (performed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
