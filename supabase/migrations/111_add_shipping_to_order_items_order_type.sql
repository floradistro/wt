/**
 * Add 'shipping' as valid order_type for order_items
 *
 * E-commerce orders use order_type: 'shipping' for both orders and order_items
 * This migration adds 'shipping' to the allowed values if there's a constraint
 */

-- Drop existing constraint if it exists
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_type_check;

-- Add constraint with shipping included
ALTER TABLE order_items ADD CONSTRAINT order_items_order_type_check
  CHECK (order_type IN ('pickup', 'delivery', 'shipping'));

-- Add comment
COMMENT ON COLUMN order_items.order_type IS 'Type of order: pickup (in-store pickup), delivery (local delivery), shipping (e-commerce)';
