-- Create POS sale function for ACTUAL Supabase schema
-- Works with: orders, order_items, payment_transactions, pos_sessions
-- Date: 2025-11-16

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
  v_order_id UUID;
  v_transaction_id UUID;
  v_item JSONB;
  v_loyalty_points_earned INT := 0;
  v_result JSONB;
  v_session pos_sessions%ROWTYPE;
BEGIN
  -- Get session info
  SELECT * INTO v_session FROM pos_sessions WHERE id = p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Generate order number
  v_order_number := 'POS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- Create order using ACTUAL orders schema
  INSERT INTO orders (
    order_number,
    vendor_id,
    customer_id,
    employee_id,
    pickup_location_id,
    subtotal,
    tax_amount,
    discount_amount,
    total_amount,
    payment_method,
    payment_status,
    status,
    fulfillment_status,
    delivery_type,
    order_date,
    created_at,
    updated_at
  ) VALUES (
    v_order_number,
    p_vendor_id,
    p_customer_id,
    p_user_id,
    p_location_id,
    p_subtotal,
    p_tax_amount,
    COALESCE(p_loyalty_discount_amount, 0),
    p_total,
    p_payment_method,
    'paid',
    'completed',
    'fulfilled',
    'pickup',
    NOW(),
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  -- Create order items using ACTUAL order_items schema
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      vendor_id,
      pickup_location_id,
      product_name,
      product_sku,
      quantity,
      unit_price,
      tier_name,
      tier_price,
      line_subtotal,
      line_total,
      tax_amount,
      order_type,
      fulfillment_status,
      created_at
    ) VALUES (
      v_order_id,
      (v_item->>'productId')::UUID,
      p_vendor_id,
      p_location_id,
      v_item->>'productName',
      COALESCE(v_item->>'productSku', ''),
      (v_item->>'quantity')::INT,
      (v_item->>'unitPrice')::DECIMAL(10,2),
      COALESCE(v_item->>'tierName', '1 Unit'),
      (v_item->>'unitPrice')::DECIMAL(10,2),
      (v_item->>'lineTotal')::DECIMAL(10,2),
      (v_item->>'lineTotal')::DECIMAL(10,2),
      0,
      'pickup',
      'fulfilled',
      NOW()
    );

    -- Deduct inventory if product exists
    IF (v_item->>'productId') IS NOT NULL THEN
      UPDATE products
      SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - (v_item->>'quantity')::INT),
          updated_at = NOW()
      WHERE id = (v_item->>'productId')::UUID
      AND track_inventory = true;
    END IF;
  END LOOP;

  -- Create payment transaction using ACTUAL payment_transactions schema
  INSERT INTO payment_transactions (
    vendor_id,
    location_id,
    user_id,
    order_id,
    pos_register_id,
    payment_method,
    transaction_type,
    amount,
    total_amount,
    tip_amount,
    card_type,
    card_last_four,
    authorization_code,
    processor_transaction_id,
    status,
    payment_status,
    processed_at,
    created_at,
    updated_at
  ) VALUES (
    p_vendor_id,
    p_location_id,
    p_user_id,
    v_order_id,
    v_session.register_id,
    p_payment_method,
    'sale',
    p_total,
    p_total,
    0,
    p_card_type,
    p_card_last4,
    p_authorization_code,
    p_payment_transaction_id,
    'approved',
    'paid',
    NOW(),
    NOW(),
    NOW()
  ) RETURNING id INTO v_transaction_id;

  -- Update session totals using ACTUAL pos_sessions schema
  UPDATE pos_sessions
  SET
    total_sales = COALESCE(total_sales, 0) + p_total,
    total_cash = COALESCE(total_cash, 0) + CASE WHEN p_payment_method = 'cash' THEN p_total ELSE 0 END,
    total_card = COALESCE(total_card, 0) + CASE WHEN p_payment_method IN ('card', 'credit_card', 'debit_card') THEN p_total ELSE 0 END,
    total_transactions = COALESCE(total_transactions, 0) + 1,
    walk_in_sales = COALESCE(walk_in_sales, 0) + 1,
    last_transaction_at = NOW(),
    updated_at = NOW()
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
        SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - p_loyalty_points_redeemed),
            updated_at = NOW()
        WHERE id = p_customer_id;

        -- Try to insert loyalty transaction if table exists
        BEGIN
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
        EXCEPTION
          WHEN undefined_table THEN
            NULL; -- Table doesn't exist, skip
        END;

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

        BEGIN
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
        EXCEPTION
          WHEN undefined_table THEN
            NULL;
        END;
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
      'transaction_number', v_transaction_id::TEXT
    ),
    'loyalty', jsonb_build_object(
      'points_earned', v_loyalty_points_earned,
      'points_redeemed', p_loyalty_points_redeemed
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION create_pos_sale IS 'Creates a POS sale using actual Supabase schema (orders, order_items, payment_transactions, pos_sessions)';
