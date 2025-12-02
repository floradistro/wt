-- Fix duplicate custom fields in vendor_product_fields table
-- This migration:
-- 1. Removes duplicate rows (keeping the most recently updated one)
-- 2. Adds a UNIQUE constraint to prevent future duplicates

-- Step 1: Delete duplicate rows, keeping the most recent one by updated_at
-- First, identify and delete duplicates
WITH duplicates AS (
  SELECT id,
         vendor_id,
         category_id,
         field_id,
         ROW_NUMBER() OVER (
           PARTITION BY vendor_id, category_id, field_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
         ) AS rn
  FROM vendor_product_fields
)
DELETE FROM vendor_product_fields
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Add UNIQUE constraint to prevent future duplicates
-- This constraint ensures only one field_id per vendor per category
ALTER TABLE vendor_product_fields
  ADD CONSTRAINT vendor_product_fields_unique_field
  UNIQUE (vendor_id, category_id, field_id);

-- Step 3: Add index on vendor_id + category_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_vendor_product_fields_vendor_category
  ON vendor_product_fields(vendor_id, category_id);

-- Verification
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT vendor_id, category_id, field_id, COUNT(*)
    FROM vendor_product_fields
    GROUP BY vendor_id, category_id, field_id
    HAVING COUNT(*) > 1
  ) AS dups;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Still have % duplicate field_ids after cleanup', duplicate_count;
  END IF;

  RAISE NOTICE '✅ vendor_product_fields: Duplicates removed and UNIQUE constraint added';
END $$;
