-- Fix create_pos_sale to work without registers table
-- Date: 2025-11-16
-- Uses location_id as register_id since registers table doesn't exist yet

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
  -- Generate order number
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');

  -- Generate transaction number
  v_transaction_number := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('transaction_number_seq')::TEXT, 4, '0');

  -- Create order (using location_id as register_id since registers table doesn't exist)
  INSERT INTO orders (
    order_number,
    location_id,
    register_id,
    session_id,
    cashier_id,
    customer_id,
    customer_name,
    subtotal,
    tax_amount,
    discount_amount,
    loyalty_discount,
    total,
    payment_method,
    amount_paid,
    change_given,
    status
  ) VALUES (
    v_order_number,
    p_location_id,
    p_location_id,  -- Using location_id as register_id
    p_session_id,
    p_user_id,
    p_customer_id,
    p_customer_name,
    p_subtotal,
    p_tax_amount,
    0,
    p_loyalty_discount_amount,
    p_total,
    p_payment_method,
    COALESCE(p_cash_tendered, p_total),
    COALESCE(p_change_given, 0),
    'completed'
  ) RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      product_sku,
      quantity,
      unit_price,
      tier_name,
      discount_amount,
      total_price
    ) VALUES (
      v_order_id,
      (v_item->>'productId')::UUID,
      v_item->>'productName',
      COALESCE(v_item->>'productSku', ''),
      (v_item->>'quantity')::INT,
      (v_item->>'unitPrice')::DECIMAL(10,2),
      v_item->>'tierName',
      COALESCE((v_item->>'discountAmount')::DECIMAL(10,2), 0),
      (v_item->>'lineTotal')::DECIMAL(10,2)
    );

    -- Deduct inventory if product exists
    IF (v_item->>'productId') IS NOT NULL THEN
      UPDATE products
      SET stock_quantity = stock_quantity - (v_item->>'quantity')::INT,
          updated_at = NOW()
      WHERE id = (v_item->>'productId')::UUID
      AND track_inventory = true;
    END IF;
  END LOOP;

  -- Create transaction
  INSERT INTO transactions (
    transaction_number,
    order_id,
    amount,
    payment_method,
    card_type,
    card_last4,
    authorization_code,
    processor_name,
    status
  ) VALUES (
    v_transaction_number,
    v_order_id,
    p_total,
    p_payment_method,
    p_card_type,
    p_card_last4,
    p_authorization_code,
    'manual',
    'approved'
  ) RETURNING id INTO v_transaction_id;

  -- Update session totals
  UPDATE cash_sessions
  SET
    total_sales = total_sales + p_total,
    total_cash = total_cash + CASE WHEN p_payment_method = 'cash' THEN p_total ELSE 0 END,
    total_card = total_card + CASE WHEN p_payment_method IN ('card', 'credit_card', 'debit_card') THEN p_total ELSE 0 END,
    total_transactions = total_transactions + 1
  WHERE id = p_session_id;

  -- Handle loyalty points if customer exists
  IF p_customer_id IS NOT NULL THEN
    v_loyalty_points_earned := FLOOR(p_total);

    DECLARE
      v_balance_before INT;
      v_balance_after INT;
    BEGIN
      SELECT COALESCE(loyalty_points, 0) INTO v_balance_before FROM customers WHERE id = p_customer_id;

      IF p_loyalty_points_redeemed > 0 THEN
        UPDATE customers
        SET loyalty_points = COALESCE(loyalty_points, 0) - p_loyalty_points_redeemed,
            updated_at = NOW()
        WHERE id = p_customer_id;

        INSERT INTO loyalty_transactions (
          customer_id,
          order_id,
          transaction_type,
          points_amount,
          balance_before,
          balance_after,
          description
        ) VALUES (
          p_customer_id,
          v_order_id,
          'redeemed',
          -p_loyalty_points_redeemed,
          v_balance_before,
          v_balance_before - p_loyalty_points_redeemed,
          'Points redeemed for order ' || v_order_number
        );

        v_balance_before := v_balance_before - p_loyalty_points_redeemed;
      END IF;

      IF v_loyalty_points_earned > 0 THEN
        UPDATE customers
        SET loyalty_points = COALESCE(loyalty_points, 0) + v_loyalty_points_earned,
            total_spent = COALESCE(total_spent, 0) + p_total,
            total_orders = COALESCE(total_orders, 0) + 1,
            updated_at = NOW()
        WHERE id = p_customer_id;

        v_balance_after := v_balance_before + v_loyalty_points_earned;

        INSERT INTO loyalty_transactions (
          customer_id,
          order_id,
          transaction_type,
          points_amount,
          balance_before,
          balance_after,
          description
        ) VALUES (
          p_customer_id,
          v_order_id,
          'earned',
          v_loyalty_points_earned,
          v_balance_before,
          v_balance_after,
          'Points earned from order ' || v_order_number
        );
      END IF;
    END;
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

COMMENT ON FUNCTION create_pos_sale IS 'Creates a POS sale without registers table dependency';
