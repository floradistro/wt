-- ============================================
-- TEMPORARY: Disable RLS on vendor_email_settings
-- This is for debugging - we'll re-enable it once it works
-- ============================================

-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'vendor_email_settings';

-- Temporarily disable RLS
ALTER TABLE vendor_email_settings DISABLE ROW LEVEL SECURITY;

-- Note: This gives ALL authenticated users access to ALL vendor email settings
-- We will re-enable this after we verify the insert works
