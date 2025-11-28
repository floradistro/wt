# Apply Migration 104 - Fix RLS Policies for vendor_product_fields

## Issue
Custom fields still cannot be saved even after adding user tracking columns (migration 103). RLS policy is blocking inserts.

**Error:**
```
new row violates row-level security policy for table "vendor_product_fields"
```

**Error code:** 42501 (insufficient privilege)

## Root Cause
The `vendor_product_fields` table either:
1. Has no RLS policies configured, OR
2. Has incorrect RLS policies that don't account for user tracking fields

## Solution
Apply migration 104 which:
- Enables RLS on the table
- Creates proper policies for SELECT, INSERT, UPDATE, DELETE
- Ensures users can only manage fields for their own vendor
- Validates user tracking fields on INSERT/UPDATE
- Grants service_role full access

## Steps

1. **Go to Supabase Dashboard**
   - Open your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the migration:**
   - Copy the SQL from `supabase/migrations/104_fix_vendor_product_fields_rls.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Success**
   - Should see success messages in the output
   - Try adding a custom field to a category
   - Should save successfully without RLS errors

## What This Migration Does

### RLS Policies Created:

1. **SELECT Policy** - Users can view fields for their vendor
2. **INSERT Policy** - Users can insert fields for their vendor (with user tracking)
3. **UPDATE Policy** - Users can update fields for their vendor (with user tracking)
4. **DELETE Policy** - Users can delete fields for their vendor
5. **Service Role Policy** - Backend has full access

### Security Model:

- Users can only see/manage custom fields for their own vendor
- User tracking fields (`created_by_user_id`, `updated_by_user_id`) are validated
- Service role (backend) can bypass RLS for system operations

## Files Changed

- `supabase/migrations/104_fix_vendor_product_fields_rls.sql` - RLS policy migration (created)
- `APPLY_MIGRATION_104.md` - This documentation (created)

## Priority

🔴 **HIGH** - Custom fields are completely broken without this migration

## Dependencies

- **Requires migration 103** to be applied first (adds user tracking columns)
- If migration 103 is not applied, this migration will still work but inserts may fail due to missing columns
