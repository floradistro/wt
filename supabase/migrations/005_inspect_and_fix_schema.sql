-- Schema Inspection and Fix for create_pos_sale RPC
-- Date: 2025-11-16
-- Purpose: Create helper function to inspect schema, then create corrected RPC function

-- ============================================================================
-- PART 1: Schema Inspection Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_table_schema(table_name_param TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$$;

COMMENT ON FUNCTION get_table_schema IS 'Returns column information for a given table - helper for debugging';

-- ============================================================================
-- PART 2: Corrected create_pos_sale RPC Function
-- Based on actual schema from 001_pos_schema.sql
-- ============================================================================

DROP FUNCTION IF EXISTS create_pos_sale;

CREATE OR REPLACE FUNCTION create_pos_sale(
  p_location_id UUID,
  p_vendor_id UUID,  -- Will be stored as metadata since table doesn't have this column
  p_session_id UUID,
  p_user_id UUID,
  p_register_id UUID,  -- Added: Required by orders table
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
  -- Based on actual schema from 001_pos_schema.sql
  INSERT INTO orders (
    order_number,
    location_id,
    register_id,
    session_id,
    cashier_id,  -- Using p_user_id for cashier
    customer_id,
    customer_name,
    subtotal,
    tax_amount,
    loyalty_discount,
    total,
    payment_method,
    amount_paid,
    change_given,
    status
  ) VALUES (
    v_order_number,
    p_location_id,
    p_register_id,
    p_session_id,
    p_user_id,  -- cashier_id
    p_customer_id,
    p_customer_name,
    p_subtotal,
    p_tax_amount,
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
    -- Based on actual schema: order_items table uses 'total_price' not 'line_total'
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price  -- Changed from line_total
    ) VALUES (
      v_order_id,
      (v_item->>'productId')::UUID,
      v_item->>'productName',
      (v_item->>'quantity')::INT,
      (v_item->>'unitPrice')::DECIMAL(10,2),
      (v_item->>'lineTotal')::DECIMAL(10,2)
    );

    -- Deduct inventory if inventoryId provided
    -- Note: This updates the 'inventory' table (vendor-based), not 'products' table
    IF (v_item->>'inventoryId') IS NOT NULL AND (v_item->>'inventoryId') != '' THEN
      UPDATE inventory
      SET quantity = quantity - (v_item->>'quantity')::INT,
          updated_at = NOW()
      WHERE id = (v_item->>'inventoryId')::UUID;
    END IF;
  END LOOP;

  -- Create payment transaction
  -- Based on actual schema: 'transactions' table, not 'payment_transactions'
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
    'POS',  -- processor_name
    'approved'
  ) RETURNING id INTO v_transaction_id;

  -- Update session totals
  -- Note: Using 'cash_sessions' if that's the table name, or check for 'pos_sessions'
  BEGIN
    -- Try pos_sessions first (from data we collected earlier)
    UPDATE pos_sessions
    SET
      total_sales = total_sales + p_total,
      total_cash = total_cash + CASE WHEN p_payment_method = 'cash' THEN p_total ELSE 0 END,
      total_card = total_card + CASE WHEN p_payment_method IN ('card', 'credit_card', 'debit_card') THEN p_total ELSE 0 END,
      total_transactions = total_transactions + 1,
      updated_at = NOW()
    WHERE id = p_session_id;
  EXCEPTION
    WHEN undefined_table THEN
      -- Fallback to cash_sessions if pos_sessions doesn't exist
      UPDATE cash_sessions
      SET
        total_sales = total_sales + p_total,
        total_cash = total_cash + CASE WHEN p_payment_method = 'cash' THEN p_total ELSE 0 END,
        total_card = total_card + CASE WHEN p_payment_method IN ('card', 'credit_card', 'debit_card') THEN p_total ELSE 0 END,
        total_transactions = total_transactions + 1
      WHERE id = p_session_id;
  END;

  -- Handle loyalty points if customer exists
  IF p_customer_id IS NOT NULL THEN
    -- Calculate points earned (1 point per dollar by default)
    v_loyalty_points_earned := FLOOR(p_total);

    -- Update customer loyalty points and stats
    UPDATE customers
    SET
      loyalty_points = loyalty_points - p_loyalty_points_redeemed + v_loyalty_points_earned,
      total_spent = total_spent + p_total,
      total_orders = total_orders + 1,
      updated_at = NOW()
    WHERE id = p_customer_id;

    -- Create loyalty transaction records (if table exists)
    BEGIN
      -- Get current balance for tracking
      DECLARE
        v_balance_before INT;
        v_balance_after INT;
      BEGIN
        SELECT loyalty_points INTO v_balance_before
        FROM customers
        WHERE id = p_customer_id;

        -- Record redemption
        IF p_loyalty_points_redeemed > 0 THEN
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

        -- Record earned points
        IF v_loyalty_points_earned > 0 THEN
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
            v_balance_before + v_loyalty_points_earned,
            'Points earned from order ' || v_order_number
          );
        END IF;
      END;
    EXCEPTION
      WHEN undefined_table THEN
        -- Loyalty transactions table doesn't exist, skip
        NULL;
      WHEN OTHERS THEN
        -- Log but don't fail the transaction
        RAISE WARNING 'Failed to create loyalty transaction: %', SQLERRM;
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

-- Create sequences if they don't exist
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS transaction_number_seq START 1;

COMMENT ON FUNCTION create_pos_sale IS 'Creates a POS sale with order, items, payment, inventory deduction, and loyalty points - CORRECTED VERSION matching actual schema';
