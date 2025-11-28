-- ============================================================================
-- FIX RLS POLICIES FOR vendor_product_fields
-- ============================================================================
-- Issue: Users cannot insert/update custom fields due to RLS policy violations
-- Solution: Add proper RLS policies that allow vendors to manage their own fields
-- ============================================================================

-- Enable RLS (if not already enabled)
ALTER TABLE vendor_product_fields ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view fields for their vendor" ON vendor_product_fields;
DROP POLICY IF EXISTS "Users can insert fields for their vendor" ON vendor_product_fields;
DROP POLICY IF EXISTS "Users can update fields for their vendor" ON vendor_product_fields;
DROP POLICY IF EXISTS "Users can delete fields for their vendor" ON vendor_product_fields;
DROP POLICY IF EXISTS "Service role full access to vendor_product_fields" ON vendor_product_fields;

-- ============================================================================
-- SELECT POLICY: Users can view fields for their vendor
-- ============================================================================
CREATE POLICY "Users can view fields for their vendor"
  ON vendor_product_fields
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- INSERT POLICY: Users can insert fields for their vendor
-- ============================================================================
CREATE POLICY "Users can insert fields for their vendor"
  ON vendor_product_fields
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
    AND created_by_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
    AND updated_by_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE POLICY: Users can update fields for their vendor
-- ============================================================================
CREATE POLICY "Users can update fields for their vendor"
  ON vendor_product_fields
  FOR UPDATE
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
    AND updated_by_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- DELETE POLICY: Users can delete fields for their vendor
-- ============================================================================
CREATE POLICY "Users can delete fields for their vendor"
  ON vendor_product_fields
  FOR DELETE
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- SERVICE ROLE: Full access for backend operations
-- ============================================================================
CREATE POLICY "Service role full access to vendor_product_fields"
  ON vendor_product_fields
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_product_fields TO authenticated;
GRANT ALL ON vendor_product_fields TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'VENDOR PRODUCT FIELDS RLS';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ RLS enabled on vendor_product_fields';
  RAISE NOTICE '✅ SELECT policy: Users can view their vendor fields';
  RAISE NOTICE '✅ INSERT policy: Users can insert with user tracking';
  RAISE NOTICE '✅ UPDATE policy: Users can update with user tracking';
  RAISE NOTICE '✅ DELETE policy: Users can delete their vendor fields';
  RAISE NOTICE '✅ Service role has full access';
  RAISE NOTICE '================================';
END $$;
