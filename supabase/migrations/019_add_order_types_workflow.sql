-- Migration 019: Add Order Types Workflow
-- Implements the Apple-style order workflow with clear order types
-- Walk-in (POS) | Pickup (online → store) | Delivery (local) | Shipping (USPS)

-- Step 1: Add order_type column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20);

-- Step 2: Migrate existing data from delivery_type to order_type
UPDATE orders
SET order_type = CASE
  WHEN delivery_type = 'instore' THEN 'walk_in'
  WHEN delivery_type = 'pickup' THEN 'pickup'
  WHEN delivery_type = 'delivery' THEN 'delivery'
  ELSE 'walk_in' -- Default to walk_in for any nulls
END
WHERE order_type IS NULL;

-- Step 3: Make order_type required and add constraint
ALTER TABLE orders ALTER COLUMN order_type SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('walk_in', 'pickup', 'delivery', 'shipping'));

-- Step 4: Auto-complete all existing walk-in orders
UPDATE orders
SET
  status = 'completed',
  completed_at = COALESCE(completed_at, created_at)
WHERE order_type = 'walk_in'
  AND payment_status = 'paid'
  AND status != 'completed'
  AND status != 'cancelled';

-- Step 5: Update status values for pickup/delivery orders
UPDATE orders
SET status = CASE
  WHEN status = 'processing' THEN 'preparing'
  ELSE status
END
WHERE order_type IN ('pickup', 'delivery', 'shipping')
  AND status = 'processing';

-- Step 6: Add shipping-specific fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_line1 VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_line2 VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zip VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(2) DEFAULT 'US';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(20);

-- Step 7: Add tracking fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_carrier VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_service VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postage_paid DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0;

-- Step 8: Add package details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_weight DECIMAL(10,3);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_length DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_width DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS package_height DECIMAL(10,2);

-- Step 9: Add fulfillment tracking fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepared_by_user_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_by_user_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by_user_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_notes TEXT;

-- Step 10: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_desc ON orders(created_at DESC);

-- Step 11: Create order_tracking_events table for shipping orders
CREATE TABLE IF NOT EXISTS order_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  message TEXT,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_order ON order_tracking_events(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_timestamp ON order_tracking_events(timestamp DESC);

-- Step 12: Update status constraint to include new values
-- First, drop the old constraint if it exists
ALTER TABLE orders DROP CONSTRAINT IF NOT EXISTS orders_status_check;

-- Add new constraint with all valid status values
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',      -- New order, needs preparation
    'preparing',    -- Staff is working on it (formerly 'processing')
    'ready',        -- Ready for customer pickup
    'out_for_delivery', -- Driver has it (delivery orders)
    'ready_to_ship',    -- Packed and ready for label (shipping orders)
    'shipped',          -- Package shipped (shipping orders)
    'in_transit',       -- Package in transit (shipping orders)
    'delivered',        -- Package delivered (shipping orders)
    'completed',    -- Order complete (all types)
    'cancelled'     -- Order cancelled
  ));

COMMENT ON COLUMN orders.order_type IS 'Type of order: walk_in (POS), pickup (online→store), delivery (local), shipping (USPS)';
COMMENT ON COLUMN orders.status IS 'Order status - workflow varies by order_type';
COMMENT ON TABLE order_tracking_events IS 'Tracking events for shipping orders from USPS/FedEx webhooks';
