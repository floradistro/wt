-- ============================================================================
-- ADD IDEMPOTENCY TO ORDERS TABLE
-- ============================================================================
-- Critical fix: Add idempotency_key column to prevent duplicate orders
-- ============================================================================

-- Add idempotency_key column to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Add unique constraint to prevent duplicate orders
ALTER TABLE orders
ADD CONSTRAINT orders_idempotency_key_unique
UNIQUE (idempotency_key);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_idempotency
ON orders(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Comment
COMMENT ON COLUMN orders.idempotency_key IS
'Unique key to prevent duplicate orders. Enables safe retries of checkout operations.';
