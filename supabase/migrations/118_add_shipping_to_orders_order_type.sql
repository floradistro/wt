/**
 * Add 'shipping' as valid order_type for orders table
 *
 * E-commerce orders use order_type: 'shipping' for shipped orders
 * This migration adds 'shipping' to the allowed values in the orders table constraint
 */

-- Drop existing constraint if it exists
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;

-- Add constraint with shipping included (along with walk_in for POS)
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('walk_in', 'pickup', 'delivery', 'shipping'));

-- Add comment
COMMENT ON COLUMN orders.order_type IS 'Type of order: walk_in (POS in-store), pickup (online→store pickup), delivery (local delivery), shipping (e-commerce shipped)';
