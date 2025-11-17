-- Fix create_pos_sale to properly calculate and award loyalty points

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
BEGIN
  SELECT * INTO v_session FROM pos_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_order_number := 'POS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  v_reference_id := 'POS-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;

  -- Get loyalty program for this vendor
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

      -- NOTE: Do NOT manually update customer loyalty_points here!
      -- The loyalty_transactions table has a trigger (update_customer_loyalty_balance)
      -- that automatically updates the customer's balance when we INSERT below.
      -- Doing both would DOUBLE-COUNT the points!

      -- Create loyalty transaction record for points redeemed FIRST (if any)
      -- This must happen BEFORE earning, so the balance is correct
      IF v_points_redeemed > 0 THEN
        DECLARE
          v_balance_before_redeemed INT;
        BEGIN
          -- Get current balance
          SELECT COALESCE(loyalty_points, 0) INTO v_balance_before_redeemed
          FROM customers WHERE id = p_customer_id;

          INSERT INTO loyalty_transactions (
            customer_id, transaction_type, points,
            reference_type, reference_id, description,
            balance_before, created_at
          )
          VALUES (
            p_customer_id, 'spent', -v_points_redeemed,  -- Negative for spent
            'order', v_order_id::TEXT, 'Points redeemed for order ' || v_order_number,
            v_balance_before_redeemed,
            NOW()
          );
          -- Note: balance_after is set automatically by the trigger
        EXCEPTION
          WHEN OTHERS THEN
            -- Log error but don't fail transaction
            RAISE WARNING 'Failed to create redeemed loyalty transaction: %', SQLERRM;
        END;
      END IF;

      -- Create loyalty transaction record for points earned
      IF v_points_earned > 0 THEN
        DECLARE
          v_balance_before_earned INT;
        BEGIN
          -- Get current balance (after redemption if any)
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
            NOW()
          );
          -- Note: balance_after is set automatically by the trigger
        EXCEPTION
          WHEN OTHERS THEN
            -- Log error but don't fail transaction
            RAISE WARNING 'Failed to create earned loyalty transaction: %', SQLERRM;
        END;
      END IF;
    END IF;
  END IF;

  INSERT INTO orders (
    order_number, vendor_id, customer_id, employee_id, pickup_location_id,
    subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status,
    status, fulfillment_status, delivery_type, order_date, created_at, updated_at
  )
  VALUES (
    v_order_number, p_vendor_id, p_customer_id, p_user_id, p_location_id,
    p_subtotal, p_tax_amount, COALESCE(p_loyalty_discount_amount, 0), p_total, p_payment_method,
    'paid', 'completed', 'fulfilled', 'pickup', NOW(), NOW(), NOW()
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
      (v_item->>'lineTotal')::DECIMAL(10,2), 0, 'pickup', 'fulfilled', NOW()
    );

    UPDATE products
    SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - (v_item->>'quantity')::INT),
        updated_at = NOW()
    WHERE id = (v_item->>'productId')::UUID
    AND manage_stock = true;
  END LOOP;

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
    jsonb_build_object('amount', p_total), '{}'::jsonb, NOW(), 0, NOW(), NOW()
  )
  RETURNING id INTO v_transaction_id;

  UPDATE pos_sessions SET
    total_sales = COALESCE(total_sales, 0) + p_total,
    total_cash = COALESCE(total_cash, 0) + CASE WHEN p_payment_method = 'cash' THEN p_total ELSE 0 END,
    total_card = COALESCE(total_card, 0) + CASE WHEN p_payment_method IN ('card', 'credit_card', 'debit_card', 'credit') THEN p_total ELSE 0 END,
    total_transactions = COALESCE(total_transactions, 0) + 1,
    walk_in_sales = COALESCE(walk_in_sales, 0) + 1,
    last_transaction_at = NOW(),
    updated_at = NOW()
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
