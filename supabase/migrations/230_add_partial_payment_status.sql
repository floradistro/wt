-- Add 'partial' to payment_status enum for multi-card split payments
-- When Card 1 succeeds but Card 2 fails, order is set to 'partial'

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'pending'::text,
    'paid'::text,
    'partial'::text,  -- NEW: Card 1 paid, Card 2 failed
    'failed'::text,
    'refunded'::text,
    'partially_refunded'::text
  ]));

-- Add comment for clarity
COMMENT ON COLUMN orders.payment_status IS
  'Payment status: pending (awaiting), paid (complete), partial (split payment incomplete - e.g. Card 1 paid, Card 2 failed), failed, refunded, partially_refunded';
