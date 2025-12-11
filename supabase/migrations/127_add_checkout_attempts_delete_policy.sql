-- ============================================================================
-- Migration: Add DELETE policy for checkout_attempts
--
-- The checkout_attempts table was missing a DELETE policy, which prevented
-- users from deleting orders that have associated checkout_attempts.
-- ============================================================================

-- Users can delete checkout attempts for their vendor
-- This is needed when deleting orders that have associated checkout attempts
CREATE POLICY "Users can delete checkout attempts for their vendor"
  ON checkout_attempts
  FOR DELETE
  USING (
    vendor_id IN (
      SELECT vendor_id
      FROM users
      WHERE auth_user_id = auth.uid()
    )
  );
