-- Create RPC function for creating sales (replaces /api/pos/sales/create)
-- Date: 2025-11-16
-- Purpose: Allow direct sale creation from React Native app

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
  v_transaction_number TEXT;
  v_order_id UUID;
  v_transaction_id UUID;
  v_item JSONB;
  v_loyalty_points_earned INT := 0;
  v_result JSONB;
BEGIN
  -- Generate order number (e.g., ORD-20251116-0001)
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');

  -- Generate transaction number (e.g., TXN-20251116-0001)
  v_transaction_number := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('transaction_number_seq')::TEXT, 4, '0');

  -- Create order
  INSERT INTO orders (
    order_number,
    vendor_id,
    location_id,
    session_id,
    customer_id,
    customer_name,
    subtotal,
    tax_amount,
    total,
    status,
    created_by
  ) VALUES (
    v_order_number,
    p_vendor_id,
    p_location_id,
    p_session_id,
    p_customer_id,
    p_customer_name,
    p_subtotal,
    p_tax_amount,
    p_total,
    'completed',
    p_user_id
  ) RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total,
      inventory_id
    ) VALUES (
      v_order_id,
      (v_item->>'productId')::UUID,
      v_item->>'productName',
      (v_item->>'quantity')::INT,
      (v_item->>'unitPrice')::DECIMAL(10,2),
      (v_item->>'lineTotal')::DECIMAL(10,2),
      (v_item->>'inventoryId')::UUID
    );

    -- Deduct inventory
    IF (v_item->>'inventoryId') IS NOT NULL THEN
      UPDATE inventory
      SET quantity = quantity - (v_item->>'quantity')::INT,
          updated_at = NOW()
      WHERE id = (v_item->>'inventoryId')::UUID;
    END IF;
  END LOOP;

  -- Create payment transaction
  INSERT INTO payment_transactions (
    transaction_number,
    order_id,
    session_id,
    amount,
    payment_method,
    cash_tendered,
    change_given,
    authorization_code,
    external_transaction_id,
    card_type,
    card_last4,
    status
  ) VALUES (
    v_transaction_number,
    v_order_id,
    p_session_id,
    p_total,
    p_payment_method,
    p_cash_tendered,
    p_change_given,
    p_authorization_code,
    p_payment_transaction_id,
    p_card_type,
    p_card_last4,
    'completed'
  ) RETURNING id INTO v_transaction_id;

  -- Update session totals
  UPDATE pos_sessions
  SET
    total_sales = total_sales + p_total,
    total_cash = total_cash + CASE WHEN p_payment_method = 'cash' THEN p_total ELSE 0 END,
    total_card = total_card + CASE WHEN p_payment_method IN ('card', 'credit_card', 'debit_card') THEN p_total ELSE 0 END,
    transaction_count = transaction_count + 1,
    updated_at = NOW()
  WHERE id = p_session_id;

  -- Handle loyalty points if customer exists
  IF p_customer_id IS NOT NULL THEN
    -- Calculate points earned (1 point per dollar by default)
    v_loyalty_points_earned := FLOOR(p_total);

    -- Deduct redeemed points
    IF p_loyalty_points_redeemed > 0 THEN
      UPDATE customers
      SET
        loyalty_points = loyalty_points - p_loyalty_points_redeemed,
        updated_at = NOW()
      WHERE id = p_customer_id;
    END IF;

    -- Add earned points
    IF v_loyalty_points_earned > 0 THEN
      UPDATE customers
      SET
        loyalty_points = loyalty_points + v_loyalty_points_earned,
        total_spent = total_spent + p_total,
        total_orders = total_orders + 1,
        updated_at = NOW()
      WHERE id = p_customer_id;
    END IF;

    -- Create loyalty transaction records
    IF p_loyalty_points_redeemed > 0 THEN
      INSERT INTO loyalty_transactions (
        customer_id,
        order_id,
        points_change,
        transaction_type,
        description
      ) VALUES (
        p_customer_id,
        v_order_id,
        -p_loyalty_points_redeemed,
        'redemption',
        'Points redeemed for order ' || v_order_number
      );
    END IF;

    IF v_loyalty_points_earned > 0 THEN
      INSERT INTO loyalty_transactions (
        customer_id,
        order_id,
        points_change,
        transaction_type,
        description
      ) VALUES (
        p_customer_id,
        v_order_id,
        v_loyalty_points_earned,
        'earned',
        'Points earned from order ' || v_order_number
      );
    END IF;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order_id,
      'order_number', v_order_number
    ),
    'transaction', jsonb_build_object(
      'id', v_transaction_id,
      'transaction_number', v_transaction_number
    ),
    'loyalty', jsonb_build_object(
      'points_earned', v_loyalty_points_earned,
      'points_redeemed', p_loyalty_points_redeemed
    )
  );

  RETURN v_result;
END;
$$;

-- Create sequences if they don't exist
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS transaction_number_seq START 1;

COMMENT ON FUNCTION create_pos_sale IS 'Creates a POS sale with order, items, payment, inventory deduction, and loyalty points';
