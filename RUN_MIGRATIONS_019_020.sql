-- ====================================================================
-- WHALETOOLS ORDER TYPE WORKFLOW MIGRATIONS
-- Run this in Supabase Dashboard > SQL Editor
-- ====================================================================

-- Migration 019: Add Order Types Workflow
-- ====================================================================

-- Step 0: Drop old delivery_type constraint (if it exists)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_type_check;

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

-- Step 4: Add completed_at column if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Step 4a: Auto-complete all existing walk-in orders
UPDATE orders
SET
  status = 'completed',
  completed_at = COALESCE(completed_at, completed_date, created_at)
WHERE order_type = 'walk_in'
  AND payment_status = 'paid'
  AND status != 'completed'
  AND status != 'cancelled';

-- Step 5: Update status values for all orders (fix any invalid statuses)
UPDATE orders
SET status = CASE
  WHEN status = 'processing' THEN 'preparing'
  WHEN status NOT IN ('pending', 'preparing', 'ready', 'out_for_delivery', 'ready_to_ship', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled') THEN 'pending'
  ELSE status
END;

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
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

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


-- Migration 020: Update create_pos_sale to create walk_in orders
-- ====================================================================

DROP FUNCTION IF EXISTS create_pos_sale CASCADE;

CREATE OR REPLACE FUNCTION create_pos_sale(
  p_location_id UUID,
  p_vendor_id UUID,
  p_session_id UUID,
  p_user_id UUID,
  p_items JSONB,
  p_subtotal DECIMAL(10,2),
  p_tax_amount DECIMAL(10,2),
  p_total DECIMAL(10,2),
  p_payment_method TEXT,
  p_payment_processor_id UUID DEFAULT NULL,
  p_cash_tendered DECIMAL(10,2) DEFAULT NULL,
  p_change_given DECIMAL(10,2) DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_customer_name TEXT DEFAULT 'Walk-In',
  p_authorization_code TEXT DEFAULT NULL,
  p_payment_transaction_id TEXT DEFAULT NULL,
  p_card_type TEXT DEFAULT NULL,
  p_card_last4 TEXT DEFAULT NULL,
  p_loyalty_points_redeemed INT DEFAULT 0,
  p_loyalty_discount_amount DECIMAL(10,2) DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_number TEXT;
  v_order_id UUID;
  v_transaction_id UUID;
  v_item JSONB;
  v_result JSONB;
  v_session pos_sessions%ROWTYPE;
  v_reference_id TEXT;
  v_loyalty_program RECORD;
  v_points_earned INT := 0;
  v_points_redeemed INT := 0;
  v_now TIMESTAMP := NOW();
BEGIN
  SELECT * INTO v_session FROM pos_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_order_number := 'POS-' || TO_CHAR(v_now, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  v_reference_id := 'POS-' || EXTRACT(EPOCH FROM v_now)::BIGINT::TEXT;

  -- Get loyalty program for this vendor (calculate points but don't create transactions yet)
  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_loyalty_program
    FROM loyalty_programs
    WHERE vendor_id = p_vendor_id
      AND is_active = true
    LIMIT 1;

    -- Calculate points earned (subtotal * points_per_dollar)
    IF v_loyalty_program.id IS NOT NULL THEN
      v_points_earned := FLOOR(p_subtotal * COALESCE(v_loyalty_program.points_per_dollar, 0));
      v_points_redeemed := COALESCE(p_loyalty_points_redeemed, 0);
    END IF;
  END IF;

  -- Create order as walk_in (The Apple Way: instant, auto-completed)
  INSERT INTO orders (
    order_number, vendor_id, customer_id, employee_id, pickup_location_id,
    subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status,
    status, fulfillment_status,
    order_type,           -- NEW: order_type instead of delivery_type
    delivery_type,        -- Keep for backward compatibility during transition
    order_date, created_at, updated_at, completed_at  -- NEW: completed_at
  )
  VALUES (
    v_order_number, p_vendor_id, p_customer_id, p_user_id, p_location_id,
    p_subtotal, p_tax_amount, COALESCE(p_loyalty_discount_amount, 0), p_total, p_payment_method,
    'paid',               -- payment_status = paid
    'completed',          -- status = completed (walk-in orders are instant)
    'fulfilled',          -- fulfillment_status = fulfilled
    'walk_in',            -- NEW: order_type = walk_in (POS sales)
    'instore',            -- Keep old delivery_type for backward compatibility
    v_now, v_now, v_now, v_now  -- completed_at = now (instant completion)
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (
      order_id, product_id, vendor_id, pickup_location_id, product_name,
      product_sku, quantity, unit_price, tier_name, tier_price, line_subtotal, line_total,
      tax_amount, order_type, fulfillment_status, created_at
    )
    VALUES (
      v_order_id, (v_item->>'productId')::UUID, p_vendor_id, p_location_id,
      v_item->>'productName', COALESCE(v_item->>'productSku', ''), (v_item->>'quantity')::INT,
      (v_item->>'unitPrice')::DECIMAL(10,2), COALESCE(v_item->>'tierName', '1 Unit'),
      (v_item->>'unitPrice')::DECIMAL(10,2), (v_item->>'lineTotal')::DECIMAL(10,2),
      (v_item->>'lineTotal')::DECIMAL(10,2), 0, 'pickup', 'fulfilled', v_now
    );

    UPDATE products
    SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - (v_item->>'quantity')::INT),
        updated_at = v_now
    WHERE id = (v_item->>'productId')::UUID
    AND manage_stock = true;
  END LOOP;

  -- Create loyalty transactions AFTER order is created (so we have v_order_id)
  IF p_customer_id IS NOT NULL AND v_loyalty_program.id IS NOT NULL THEN
    -- Create loyalty transaction record for points redeemed FIRST (if any)
    IF v_points_redeemed > 0 THEN
      DECLARE
        v_balance_before_redeemed INT;
      BEGIN
        SELECT COALESCE(loyalty_points, 0) INTO v_balance_before_redeemed
        FROM customers WHERE id = p_customer_id;

        INSERT INTO loyalty_transactions (
          customer_id, transaction_type, points,
          reference_type, reference_id, description,
          balance_before, created_at
        )
        VALUES (
          p_customer_id, 'spent', -v_points_redeemed,
          'order', v_order_id::TEXT, 'Points redeemed for order ' || v_order_number,
          v_balance_before_redeemed,
          v_now
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to create redeemed loyalty transaction: %', SQLERRM;
      END;
    END IF;

    -- Create loyalty transaction record for points earned
    IF v_points_earned > 0 THEN
      DECLARE
        v_balance_before_earned INT;
      BEGIN
        SELECT COALESCE(loyalty_points, 0) INTO v_balance_before_earned
        FROM customers WHERE id = p_customer_id;

        INSERT INTO loyalty_transactions (
          customer_id, transaction_type, points,
          reference_type, reference_id, description,
          balance_before, created_at
        )
        VALUES (
          p_customer_id, 'earned', v_points_earned,
          'order', v_order_id::TEXT, 'Points earned from order ' || v_order_number,
          v_balance_before_earned,
          v_now
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to create earned loyalty transaction: %', SQLERRM;
      END;
    END IF;
  END IF;

  INSERT INTO payment_transactions (
    vendor_id, location_id, payment_processor_id, pos_register_id, order_id, user_id,
    processor_type, transaction_type, payment_method, amount, tip_amount,
    status, processor_reference_id, authorization_code, processor_transaction_id,
    card_type, card_last_four, request_data, response_data, processed_at, retry_count,
    created_at, updated_at
  )
  VALUES (
    p_vendor_id, p_location_id, p_payment_processor_id, v_session.register_id, v_order_id, p_user_id,
    CASE WHEN p_payment_method = 'cash' THEN 'manual' ELSE 'dejavoo' END,
    'sale', p_payment_method, p_total, 0, 'approved', v_reference_id,
    p_authorization_code, p_payment_transaction_id, p_card_type, p_card_last4,
    jsonb_build_object('amount', p_total), '{}'::jsonb, v_now, 0, v_now, v_now
  )
  RETURNING id INTO v_transaction_id;

  UPDATE pos_sessions SET
    total_sales = COALESCE(total_sales, 0) + p_total,
    total_cash = COALESCE(total_cash, 0) + CASE WHEN p_payment_method = 'cash' THEN p_total ELSE 0 END,
    total_card = COALESCE(total_card, 0) + CASE WHEN p_payment_method IN ('card', 'credit_card', 'debit_card', 'credit') THEN p_total ELSE 0 END,
    total_transactions = COALESCE(total_transactions, 0) + 1,
    walk_in_sales = COALESCE(walk_in_sales, 0) + 1,
    last_transaction_at = v_now,
    updated_at = v_now
  WHERE id = p_session_id;

  v_result := jsonb_build_object(
    'success', true,
    'order', jsonb_build_object('id', v_order_id, 'order_number', v_order_number),
    'transaction', jsonb_build_object('id', v_transaction_id, 'transaction_number', v_transaction_id::TEXT),
    'loyalty', jsonb_build_object(
      'points_earned', v_points_earned,
      'points_redeemed', v_points_redeemed,
      'program_active', v_loyalty_program.id IS NOT NULL
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_pos_sale TO anon;
GRANT EXECUTE ON FUNCTION create_pos_sale TO authenticated;
GRANT EXECUTE ON FUNCTION create_pos_sale TO service_role;

COMMENT ON FUNCTION create_pos_sale IS 'Creates a POS sale as order_type=walk_in, auto-completed on payment. The Apple Way: instant, no workflow needed.';

-- ====================================================================
-- DONE! Your order type workflow is ready.
-- ====================================================================
