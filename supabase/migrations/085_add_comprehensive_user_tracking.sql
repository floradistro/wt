-- =====================================================
-- ADD COMPREHENSIVE USER TRACKING
-- =====================================================
-- Add proper user tracking (created_by, updated_by, etc.)
-- across all major operational tables
-- =====================================================

-- =====================================================
-- PURCHASE ORDERS
-- =====================================================

-- Add user tracking columns to purchase_orders if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='purchase_orders' AND column_name='created_by_user_id') THEN
    ALTER TABLE purchase_orders ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='purchase_orders' AND column_name='received_by_user_id') THEN
    ALTER TABLE purchase_orders ADD COLUMN received_by_user_id UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='purchase_orders' AND column_name='cancelled_by_user_id') THEN
    ALTER TABLE purchase_orders ADD COLUMN cancelled_by_user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- =====================================================
-- INVENTORY ADJUSTMENTS (Audits)
-- =====================================================

-- Add user tracking to inventory_adjustments if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='inventory_adjustments' AND column_name='created_by_user_id') THEN
    ALTER TABLE inventory_adjustments ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- =====================================================
-- INVENTORY TRANSFERS
-- =====================================================

-- Update inventory_transfers to use proper foreign keys to auth.users
DO $$
BEGIN
  -- Drop old columns if they exist (they're just UUID without foreign keys)
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='inventory_transfers' AND column_name='created_by') THEN
    ALTER TABLE inventory_transfers DROP COLUMN IF EXISTS created_by CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='inventory_transfers' AND column_name='approved_by') THEN
    ALTER TABLE inventory_transfers DROP COLUMN IF EXISTS approved_by CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='inventory_transfers' AND column_name='received_by') THEN
    ALTER TABLE inventory_transfers DROP COLUMN IF EXISTS received_by CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='inventory_transfers' AND column_name='cancelled_by') THEN
    ALTER TABLE inventory_transfers DROP COLUMN IF EXISTS cancelled_by CASCADE;
  END IF;

  -- Add new properly named columns with foreign keys
  ALTER TABLE inventory_transfers ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);
  ALTER TABLE inventory_transfers ADD COLUMN approved_by_user_id UUID REFERENCES auth.users(id);
  ALTER TABLE inventory_transfers ADD COLUMN received_by_user_id UUID REFERENCES auth.users(id);
  ALTER TABLE inventory_transfers ADD COLUMN cancelled_by_user_id UUID REFERENCES auth.users(id);
END $$;

-- =====================================================
-- STOCK MOVEMENTS (audit trail)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stock_movements' AND column_name='created_by_user_id') THEN
    ALTER TABLE stock_movements ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN purchase_orders.created_by_user_id IS 'User who created this purchase order';
COMMENT ON COLUMN purchase_orders.received_by_user_id IS 'User who received this purchase order';
COMMENT ON COLUMN purchase_orders.cancelled_by_user_id IS 'User who cancelled this purchase order';

COMMENT ON COLUMN inventory_adjustments.created_by_user_id IS 'User who created this inventory adjustment/audit';

COMMENT ON COLUMN inventory_transfers.created_by_user_id IS 'User who created this transfer';
COMMENT ON COLUMN inventory_transfers.approved_by_user_id IS 'User who approved this transfer';
COMMENT ON COLUMN inventory_transfers.received_by_user_id IS 'User who received this transfer';
COMMENT ON COLUMN inventory_transfers.cancelled_by_user_id IS 'User who cancelled this transfer';

COMMENT ON COLUMN stock_movements.created_by_user_id IS 'User who initiated this stock movement';
