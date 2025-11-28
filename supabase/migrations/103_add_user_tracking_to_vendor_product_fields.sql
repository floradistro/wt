-- Add user tracking columns to vendor_product_fields table
-- This migration adds created_by_user_id and updated_by_user_id columns
-- to support RLS policies and audit tracking

-- Add columns (if they don't exist)
ALTER TABLE vendor_product_fields
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_product_fields_created_by
  ON vendor_product_fields(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_product_fields_updated_by
  ON vendor_product_fields(updated_by_user_id);

-- Add comment
COMMENT ON COLUMN vendor_product_fields.created_by_user_id IS 'User who created this field';
COMMENT ON COLUMN vendor_product_fields.updated_by_user_id IS 'User who last updated this field';
