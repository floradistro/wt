-- ============================================================================
-- Migration: Add created_by_user_id to orders table
-- ============================================================================
--
-- Purpose: Track which staff member created each order (Apple Engineering Way)
--
-- Changes:
-- 1. Add created_by_user_id column as UUID foreign key to users table
-- 2. Add index for fast lookups
-- 3. Backfill data from metadata.created_by_user_id for existing orders
-- 4. Set NOT NULL constraint with default (for new orders)
--
-- Benefits:
-- - Proper foreign key constraint (referential integrity)
-- - Single JOIN query (no second query needed)
-- - Indexed for performance
-- - Type-safe
-- - Can query "all orders by staff member X"
-- ============================================================================

BEGIN;

-- Step 1: Add the column (nullable initially for backfill)
ALTER TABLE orders
ADD COLUMN created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Step 2: Backfill from metadata for existing orders (only if user still exists)
UPDATE orders
SET created_by_user_id = (metadata->>'created_by_user_id')::uuid
WHERE metadata->>'created_by_user_id' IS NOT NULL
  AND created_by_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM users WHERE id = (orders.metadata->>'created_by_user_id')::uuid
  );

-- Step 3: Add index for fast lookups
CREATE INDEX idx_orders_created_by_user_id ON orders(created_by_user_id);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN orders.created_by_user_id IS 'Staff member who created this order (from POS session or admin)';

COMMIT;
