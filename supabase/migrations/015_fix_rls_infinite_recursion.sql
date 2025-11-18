-- Fix infinite recursion in RLS policies
-- The policies created were cross-referencing users and vendors tables
-- Date: 2025-11-17

-- ============================================================================
-- Drop problematic recursive policies
-- ============================================================================

-- Drop policies on users table that cause recursion
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Vendor owners can view their employees" ON users;

-- Drop policies on vendors table that cause recursion
DROP POLICY IF EXISTS "Users can read own vendor" ON vendors;

-- Drop policies on user_locations that might cause issues
DROP POLICY IF EXISTS "Users can read own location assignments" ON user_locations;
DROP POLICY IF EXISTS "Users can view own location assignments" ON user_locations;

-- ============================================================================
-- Create simple, non-recursive policies
-- ============================================================================

-- Users table: Allow users to read their own record via auth_user_id
CREATE POLICY "Users select own via auth_user_id" ON users
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Vendors table: Simple authenticated read access
-- (We already have "Authenticated users can read vendors" which is fine)

-- User locations: Service role only for now to avoid recursion
-- The app uses service role for backend operations, so this is safe

-- ============================================================================
-- Grant service role full access (keep existing)
-- ============================================================================

-- These should already exist but let's ensure they're there
DO $$
BEGIN
  -- Service role bypass for users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
    AND policyname = 'users_service_role'
  ) THEN
    CREATE POLICY "users_service_role" ON users
      USING (auth.role() = 'service_role');
  END IF;

  -- Service role bypass for vendors
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vendors'
    AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON vendors
      USING (auth.role() = 'service_role');
  END IF;

  -- Service role bypass for user_locations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_locations'
    AND policyname = 'Service role full access to user locations'
  ) THEN
    CREATE POLICY "Service role full access to user locations" ON user_locations
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- Note: The app should use the service role key for backend operations
-- and rely on application-level auth rather than complex RLS policies
-- ============================================================================
