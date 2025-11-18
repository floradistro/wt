-- Fix RLS policies for inventory_adjustments to use correct auth column

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view inventory adjustments for their vendor" ON inventory_adjustments;
DROP POLICY IF EXISTS "Users can create inventory adjustments for their vendor" ON inventory_adjustments;
DROP POLICY IF EXISTS "Users can view stock movements for their vendor" ON stock_movements;
DROP POLICY IF EXISTS "System can create stock movements" ON stock_movements;

-- Recreate with correct auth_user_id reference
CREATE POLICY "Users can view inventory adjustments for their vendor"
  ON inventory_adjustments
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory adjustments for their vendor"
  ON inventory_adjustments
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view stock movements for their vendor"
  ON stock_movements
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can create stock movements"
  ON stock_movements
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );
