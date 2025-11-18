-- Fix: Drop old delivery_type constraint that's blocking POS sales
-- The create_pos_sale function now uses order_type, but the old constraint is still active

-- Drop the old delivery_type constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_type_check;

-- Verify the fix worked
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'orders'::regclass
AND conname LIKE '%delivery%';
