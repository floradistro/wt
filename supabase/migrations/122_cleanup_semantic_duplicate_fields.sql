-- Cleanup semantically duplicate custom fields
-- This handles fields that are duplicates by meaning (e.g., "terpenes" vs "terpene_profile")

-- ============================================================================
-- STEP 1: First run this SELECT to see all your category field definitions
-- ============================================================================
-- Run this query in Supabase SQL editor to see what you have:
/*
SELECT
  vpf.id,
  c.name as category_name,
  vpf.field_id,
  vpf.field_definition->>'label' as label,
  vpf.is_active,
  vpf.created_at
FROM vendor_product_fields vpf
JOIN categories c ON c.id = vpf.category_id
ORDER BY c.name, vpf.sort_order, vpf.field_id;
*/

-- ============================================================================
-- STEP 2: Merge duplicate data in products BEFORE deleting field definitions
-- ============================================================================

-- Merge terpene_profile -> terpenes
UPDATE products
SET custom_fields = (
  CASE
    -- If terpenes is empty but terpene_profile has data, use terpene_profile value
    WHEN (custom_fields->>'terpenes' IS NULL OR custom_fields->>'terpenes' = '')
      AND (custom_fields->>'terpene_profile' IS NOT NULL AND custom_fields->>'terpene_profile' != '')
    THEN (custom_fields - 'terpene_profile') || jsonb_build_object('terpenes', custom_fields->>'terpene_profile')
    -- Otherwise just remove terpene_profile
    ELSE custom_fields - 'terpene_profile'
  END
)
WHERE custom_fields ? 'terpene_profile';

-- Merge lineage -> genetics
UPDATE products
SET custom_fields = (
  CASE
    WHEN (custom_fields->>'genetics' IS NULL OR custom_fields->>'genetics' = '')
      AND (custom_fields->>'lineage' IS NOT NULL AND custom_fields->>'lineage' != '')
    THEN (custom_fields - 'lineage') || jsonb_build_object('genetics', custom_fields->>'lineage')
    ELSE custom_fields - 'lineage'
  END
)
WHERE custom_fields ? 'lineage';

-- ============================================================================
-- STEP 3: Delete duplicate field definitions from categories
-- ============================================================================

-- Remove "terpene_profile" field definition (keep "terpenes")
DELETE FROM vendor_product_fields
WHERE field_id = 'terpene_profile';

-- Remove "lineage" field definition (keep "genetics")
DELETE FROM vendor_product_fields
WHERE field_id = 'lineage';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  terpene_profile_count INTEGER;
  lineage_count INTEGER;
BEGIN
  -- Check remaining duplicates in field definitions
  SELECT COUNT(*) INTO terpene_profile_count
  FROM vendor_product_fields WHERE field_id = 'terpene_profile';

  SELECT COUNT(*) INTO lineage_count
  FROM vendor_product_fields WHERE field_id = 'lineage';

  IF terpene_profile_count > 0 OR lineage_count > 0 THEN
    RAISE WARNING 'Some duplicate fields still exist: terpene_profile=%, lineage=%',
      terpene_profile_count, lineage_count;
  ELSE
    RAISE NOTICE '✅ Semantic duplicate fields cleaned up successfully';
    RAISE NOTICE '   - Removed terpene_profile (merged to terpenes)';
    RAISE NOTICE '   - Removed lineage (merged to genetics)';
  END IF;
END $$;
