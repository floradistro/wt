# Apply Migration 103 - Add User Tracking to vendor_product_fields

## Issue
Custom fields cannot be saved because the `vendor_product_fields` table is missing user tracking columns (`created_by_user_id` and `updated_by_user_id`).

**Error:**
```
Could not find the 'created_by_user_id' column of 'vendor_product_fields' in the schema cache
```

## Solution
Run the migration to add these columns.

## Steps

1. **Go to Supabase Dashboard**
   - Open your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run this SQL:**

```sql
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
```

3. **Click "Run"**

4. **Verify**
   - Try adding a custom field to a category
   - Should save successfully without RLS errors

## Files Changed
- `supabase/migrations/103_add_user_tracking_to_vendor_product_fields.sql` - Migration file (created)
- `src/components/categories/EditableCustomFieldsSection.tsx` - Now includes user IDs in insert/update

## Priority
🔴 **HIGH** - Custom fields cannot be saved without this migration
