-- ============================================
-- Fix Email Settings RLS Policies - Use auth_user_id
-- ============================================
-- The users table uses auth_user_id, not id, to link to auth.uid()

-- Allow users to insert email settings for their vendor
DROP POLICY IF EXISTS users_insert_own_email_settings ON vendor_email_settings;
CREATE POLICY users_insert_own_email_settings ON vendor_email_settings
  FOR INSERT
  WITH CHECK (
    vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Allow users to update email settings for their vendor
DROP POLICY IF EXISTS users_update_own_email_settings ON vendor_email_settings;
CREATE POLICY users_update_own_email_settings ON vendor_email_settings
  FOR UPDATE
  USING (
    vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Allow users to select email settings for their vendor
DROP POLICY IF EXISTS users_read_own_email_settings ON vendor_email_settings;
CREATE POLICY users_read_own_email_settings ON vendor_email_settings
  FOR SELECT
  USING (
    vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid())
  );
