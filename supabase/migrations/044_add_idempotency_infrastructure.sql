-- ============================================================================
-- ADD IDEMPOTENCY INFRASTRUCTURE
-- ============================================================================
-- This migration adds idempotency support to critical product operations
-- Following the pattern established in the checkout flow (migration 039)
-- ============================================================================

-- Add idempotency key to inventory_adjustments
ALTER TABLE inventory_adjustments
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Add idempotency key to purchase_orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Create index for faster idempotency lookups
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_idempotency
ON inventory_adjustments(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_idempotency
ON purchase_orders(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Create sequence for purchase order number generation
CREATE SEQUENCE IF NOT EXISTS po_sequence START 1;

-- Grant usage on sequence
GRANT USAGE, SELECT ON SEQUENCE po_sequence TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE po_sequence TO service_role;

-- Comments
COMMENT ON COLUMN inventory_adjustments.idempotency_key IS
'Unique key to prevent duplicate inventory adjustments. Enables safe retries.';

COMMENT ON COLUMN purchase_orders.idempotency_key IS
'Unique key to prevent duplicate purchase order creation. Enables safe retries.';

COMMENT ON SEQUENCE po_sequence IS
'Sequence for generating unique purchase order numbers in format PO-YYYYMMDD-####';
