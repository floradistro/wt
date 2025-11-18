-- Add DELETE policy for suppliers
-- Allows vendor admins to delete suppliers

CREATE POLICY "Users can delete suppliers for their vendor"
  ON suppliers FOR DELETE
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );
