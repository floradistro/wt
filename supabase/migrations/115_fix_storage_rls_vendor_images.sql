-- ============================================================================
-- FIX STORAGE RLS POLICIES FOR vendor-product-images BUCKET
-- ============================================================================
-- Issue: Users cannot upload images due to RLS policy violations
-- Root Cause: The existing policy checks vendor_id from users table, but the
--             storage.foldername function may not be parsing paths correctly
-- Solution: Simplify the policy to allow authenticated users to upload to
--           their vendor folder by checking if the folder name matches their
--           vendor_id from the users table
-- ============================================================================

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Vendors can view own images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload own images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete own images" ON storage.objects;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Policy: Public can read all images (needed for public URLs)
CREATE POLICY "Public read access for images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'vendor-product-images');

-- Policy: Authenticated users can view images in vendor-product-images bucket
CREATE POLICY "Vendors can view own images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vendor-product-images'
);

-- ============================================================================
-- INSERT POLICY: Allow uploads to vendor folder
-- ============================================================================
CREATE POLICY "Vendors can upload own images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-product-images'
  AND (
    -- Extract first folder from path (e.g., "vendor-id/image.jpg" -> "vendor-id")
    -- The name field contains the full path like "cd2e1122-d511-4edb-be5d-98ef274b4baf/image.jpg"
    split_part(name, '/', 1) IN (
      SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
    )
    OR
    -- Also allow if vendor_id is in the path anywhere
    name LIKE (
      SELECT vendor_id::text || '%' FROM users WHERE auth_user_id = auth.uid() LIMIT 1
    )
  )
);

-- ============================================================================
-- UPDATE POLICY
-- ============================================================================
CREATE POLICY "Vendors can update own images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendor-product-images'
  AND split_part(name, '/', 1) IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'vendor-product-images'
  AND split_part(name, '/', 1) IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- DELETE POLICY
-- ============================================================================
CREATE POLICY "Vendors can delete own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendor-product-images'
  AND split_part(name, '/', 1) IN (
    SELECT vendor_id::text FROM users WHERE auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- SERVICE ROLE: Full access for backend operations
-- ============================================================================
CREATE POLICY "Service role full access to vendor images"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'vendor-product-images')
WITH CHECK (bucket_id = 'vendor-product-images');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'STORAGE RLS POLICIES UPDATED';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ Public read access enabled';
  RAISE NOTICE '✅ Vendors can view all images in bucket';
  RAISE NOTICE '✅ Vendors can upload to their folder';
  RAISE NOTICE '✅ Vendors can update their images';
  RAISE NOTICE '✅ Vendors can delete their images';
  RAISE NOTICE '✅ Service role has full access';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Policy uses split_part(name, ''/'', 1) to extract vendor folder';
  RAISE NOTICE 'Example: "cd2e.../image.jpg" -> "cd2e..." matches vendor_id';
  RAISE NOTICE '================================';
END $$;
