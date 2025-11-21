-- ADD RLS POLICIES FOR ORDERS TABLE
-- This allows users to view orders for their vendor

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT orders for their vendor
CREATE POLICY "Users can view orders for their vendor"
  ON orders
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Service role can do everything (for Edge Functions)
CREATE POLICY "Service role can do everything on orders"
  ON orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
