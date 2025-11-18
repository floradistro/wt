/**
 * Create function to update customer loyalty points
 * Supports adding or removing points with proper validation
 */

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.update_customer_loyalty_points(UUID, INTEGER);

-- Create function to update loyalty points
CREATE OR REPLACE FUNCTION public.update_customer_loyalty_points(
  p_customer_id UUID,
  p_points_change INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the customer's loyalty points
  UPDATE public.customers
  SET
    loyalty_points = GREATEST(0, loyalty_points + p_points_change),
    updated_at = NOW()
  WHERE id = p_customer_id;

  -- Check if the customer exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found with id: %', p_customer_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_customer_loyalty_points(UUID, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.update_customer_loyalty_points(UUID, INTEGER) IS
  'Updates customer loyalty points by adding the specified change (can be positive or negative). Ensures points never go below zero.';
