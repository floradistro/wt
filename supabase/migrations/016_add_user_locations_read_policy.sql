-- Add read policy for user_locations without causing recursion
-- Date: 2025-11-17

-- Allow authenticated users to read all user_locations
-- The app will filter by vendor_id on the application side
CREATE POLICY "Authenticated users can read user_locations" ON user_locations
  FOR SELECT
  USING (auth.role() = 'authenticated');
