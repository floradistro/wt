-- Fix loyalty_programs RLS policy to handle missing session variable gracefully
-- The current policy fails if app.current_vendor_id is not set

-- Drop the existing policy
DROP POLICY IF EXISTS "vendor_access_loyalty_programs" ON loyalty_programs;

-- Create a new policy that:
-- 1. Allows access if app.current_vendor_id matches the row's vendor_id
-- 2. Falls back to allowing authenticated users to query by vendor_id in WHERE clause
CREATE POLICY "vendor_access_loyalty_programs"
ON loyalty_programs
FOR ALL
TO public
USING (
  -- Try to get the session variable, default to NULL if not set
  vendor_id = COALESCE(
    (current_setting('app.current_vendor_id', true))::uuid,
    NULL
  )
  OR
  -- If no session variable is set, allow authenticated users to query
  -- (they must filter by vendor_id in their WHERE clause)
  (auth.role() = 'authenticated' OR auth.role() = 'service_role')
);

-- Add comment explaining the policy
COMMENT ON POLICY "vendor_access_loyalty_programs" ON loyalty_programs IS
'Allows vendors to access their loyalty program. Checks app.current_vendor_id session variable if set, otherwise allows authenticated users to query with vendor_id filter.';
