-- ============================================================================
-- FIX: ADD UPDATE/DELETE RLS POLICIES FOR ORDERS
-- ============================================================================
-- CRITICAL BUG: Users could SELECT orders but not UPDATE them
-- This prevented staff from marking orders as shipped/fulfilled
-- ============================================================================

-- ============================================================================
-- 1. ORDERS TABLE - Add UPDATE and DELETE policies
-- ============================================================================

-- Policy: Users can UPDATE orders for their vendor
CREATE POLICY "Users can update orders for their vendor"
  ON orders
  FOR UPDATE
  USING (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Users can DELETE orders for their vendor (for cancellations)
CREATE POLICY "Users can delete orders for their vendor"
  ON orders
  FOR DELETE
  USING (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. ORDER_LOCATIONS TABLE - Add UPDATE policy
-- ============================================================================

-- Policy: Users can UPDATE order_locations for their vendor's orders
CREATE POLICY "Users can update order_locations for their vendor"
  ON order_locations
  FOR UPDATE
  USING (
    order_id IN (
      SELECT o.id
      FROM orders o
      WHERE o.vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT o.id
      FROM orders o
      WHERE o.vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Policy: Users can INSERT order_locations for their vendor's orders
CREATE POLICY "Users can insert order_locations for their vendor"
  ON order_locations
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT o.id
      FROM orders o
      WHERE o.vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 3. ORDER_ITEMS TABLE - Enable RLS and add policies
-- ============================================================================

-- Enable RLS on order_items (was missing)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT order_items for their vendor's orders
CREATE POLICY "Users can view order_items for their vendor"
  ON order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT o.id
      FROM orders o
      WHERE o.vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Policy: Users can UPDATE order_items for their vendor's orders
CREATE POLICY "Users can update order_items for their vendor"
  ON order_items
  FOR UPDATE
  USING (
    order_id IN (
      SELECT o.id
      FROM orders o
      WHERE o.vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT o.id
      FROM orders o
      WHERE o.vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Policy: Service role can do everything on order_items
CREATE POLICY "Service role full access to order_items"
  ON order_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'ORDERS RLS UPDATE POLICIES FIXED';
  RAISE NOTICE '================================';
  RAISE NOTICE 'orders: Added UPDATE and DELETE policies';
  RAISE NOTICE 'order_locations: Added UPDATE and INSERT policies';
  RAISE NOTICE 'order_items: Enabled RLS, added SELECT/UPDATE policies';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Staff can now mark orders as shipped!';
  RAISE NOTICE '================================';
END $$;
