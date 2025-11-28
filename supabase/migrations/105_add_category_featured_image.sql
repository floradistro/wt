-- ============================================================================
-- ADD FEATURED IMAGE TO CATEGORIES
-- ============================================================================
-- Issue: Categories cannot have images, making them less visual
-- Solution: Add featured_image column to categories table
-- Pattern: Same as products.featured_image
-- ============================================================================

-- Add featured_image column to categories
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS featured_image TEXT;

-- Add index for performance when querying categories with images
CREATE INDEX IF NOT EXISTS idx_categories_featured_image
  ON categories(featured_image)
  WHERE featured_image IS NOT NULL;

-- Add comment
COMMENT ON COLUMN categories.featured_image IS 'URL to category featured image in Supabase storage (vendor-product-images bucket)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'CATEGORY FEATURED IMAGES';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ featured_image column added to categories';
  RAISE NOTICE '✅ Index created for performance';
  RAISE NOTICE '✅ Categories can now have visual images';
  RAISE NOTICE '================================';
END $$;
