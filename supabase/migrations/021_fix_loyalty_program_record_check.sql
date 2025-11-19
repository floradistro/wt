-- Fix: Check FOUND instead of accessing uninitialized record
-- When SELECT INTO doesn't find a row, the RECORD variable is not assigned
-- Accessing .id on unassigned RECORD causes "record is not assigned yet" error

CREATE OR REPLACE FUNCTION create_pos_sale(
  p_session_id UUID,
  p_vendor_id UUID,
  p_location_id UUID,
  p_customer_id UUID,
  p_items JSONB,
  p_subtotal DECIMAL,
  p_tax DECIMAL,
  p_total DECIMAL,
  p_payment_method TEXT,
  p_payment_processor_id UUID,
  p_payment_details JSONB,
  p_loyalty_points_redeemed INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_transaction_id UUID;
  v_item JSONB;
  v_result JSONB;
  v_session pos_sessions%ROWTYPE;
  v_reference_id TEXT;
  v_loyalty_program RECORD;
  v_loyalty_program_found BOOLEAN := false;
  v_points_earned INT := 0;
  v_points_redeemed INT := 0;
  v_now TIMESTAMP := NOW();
BEGIN
  SELECT * INTO v_session FROM pos_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Invalid session ID';
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

    -- Check if loyalty program was found using FOUND keyword (not .id access)
    v_loyalty_program_found := FOUND;

    -- Calculate points earned (subtotal * points_per_dollar)
    IF v_loyalty_program_found THEN
      v_points_earned := FLOOR(p_subtotal * COALESCE(v_loyalty_program.points_per_dollar, 0));
      v_points_redeemed := COALESCE(p_loyalty_points_redeemed, 0);
    END IF;
  END IF;

  -- Create order as walk_in (The Apple Way: instant, auto-completed)
  INSERT INTO orders (
    vendor_id,
    location_id,
    customer_id,
    order_type,
    order_status,
    payment_status,
    order_number,
    subtotal,
    tax,
    total,
    created_by,
    completed_date
  ) VALUES (
    p_vendor_id,
    p_location_id,
    p_customer_id,
    'walk_in',
    'completed',
    'paid',
    v_order_number,
    p_subtotal,
    p_tax,
    p_total,
    v_session.user_id,
    v_now
  )
  RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
    VALUES (
      v_order_id,
      (v_item->>'productId')::UUID,
      (v_item->>'quantity')::INT,
      (v_item->>'price')::DECIMAL,
      (v_item->>'total')::DECIMAL
    );

    -- Decrement inventory
    UPDATE products
    SET stock_quantity = stock_quantity - (v_item->>'quantity')::INT
    WHERE id = (v_item->>'productId')::UUID
    AND manage_stock = true;
  END LOOP;

  -- Create loyalty transactions AFTER order is created (so we have v_order_id)
  IF p_customer_id IS NOT NULL AND v_loyalty_program_found THEN
    -- NOTE: Do NOT manually update customer loyalty_points here!
    -- The loyalty_transactions table has a TRIGGER (update_customer_loyalty_balance)
    -- that automatically updates the customer's balance when we INSERT below.
    -- Doing both would DOUBLE-COUNT the points!

    -- Create loyalty transaction record for points redeemed FIRST (if any)
    IF v_points_redeemed > 0 THEN
      DECLARE
        v_balance_before_redeemed INT;
      BEGIN
        SELECT loyalty_points INTO v_balance_before_redeemed
        FROM customers
        WHERE id = p_customer_id;

        INSERT INTO loyalty_transactions (
          customer_id,
          program_id,
          transaction_type,
          points_change,
          balance_before,
          balance_after,
          order_id,
          description
        ) VALUES (
          p_customer_id,
          v_loyalty_program.id,
          'redemption',
          -v_points_redeemed,
          v_balance_before_redeemed,
          v_balance_before_redeemed - v_points_redeemed,
          v_order_id,
          'Points redeemed for order ' || v_order_number
        );
      END;
    END IF;

    -- Create loyalty transaction record for points earned (if any)
    IF v_points_earned > 0 THEN
      DECLARE
        v_balance_before_earned INT;
      BEGIN
        SELECT loyalty_points INTO v_balance_before_earned
        FROM customers
        WHERE id = p_customer_id;

        INSERT INTO loyalty_transactions (
          customer_id,
          program_id,
          transaction_type,
          points_change,
          balance_before,
          balance_after,
          order_id,
          description
        ) VALUES (
          p_customer_id,
          v_loyalty_program.id,
          'purchase',
          v_points_earned,
          v_balance_before_earned,
          v_balance_before_earned + v_points_earned,
          v_order_id,
          'Points earned from order ' || v_order_number
        );
      END;
    END IF;
  END IF;

  -- Create payment transaction
  INSERT INTO payment_transactions (
    order_id,
    vendor_id,
    location_id,
    payment_method,
    payment_processor_id,
    amount,
    status,
    reference_id,
    payment_details,
    created_by
  ) VALUES (
    v_order_id,
    p_vendor_id,
    p_location_id,
    p_payment_method,
    p_payment_processor_id,
    p_total,
    'completed',
    v_reference_id,
    p_payment_details,
    v_session.user_id
  )
  RETURNING id INTO v_transaction_id;

  -- Update session totals
  UPDATE pos_sessions
  SET
    total_sales = total_sales + p_total,
    total_cash = CASE
      WHEN p_payment_method = 'cash' THEN total_cash + p_total
      ELSE total_cash
    END
  WHERE id = p_session_id;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'order', jsonb_build_object('id', v_order_id, 'order_number', v_order_number),
    'transaction', jsonb_build_object('id', v_transaction_id, 'transaction_number', v_transaction_id::TEXT),
    'loyalty', jsonb_build_object(
      'points_earned', v_points_earned,
      'points_redeemed', v_points_redeemed,
      'program_active', v_loyalty_program_found
    )
  );

  RETURN v_result;
END;
$$;
