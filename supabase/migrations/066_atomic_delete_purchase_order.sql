-- Migration: Atomic delete purchase order
-- Created: 2024-11-24
-- Description: Add atomic function to delete purchase order and all related items in a single transaction

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS delete_purchase_order_atomic(UUID);

-- Create atomic delete function
CREATE OR REPLACE FUNCTION delete_purchase_order_atomic(
  p_po_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete in atomic transaction
  -- Items first (foreign key constraint)
  DELETE FROM purchase_order_items WHERE purchase_order_id = p_po_id;

  -- Then the PO itself
  DELETE FROM purchase_orders WHERE id = p_po_id;

  -- Log the deletion
  RAISE NOTICE 'Deleted purchase order % and all items', p_po_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION delete_purchase_order_atomic(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_purchase_order_atomic IS 'Atomically deletes a purchase order and all its items in a single transaction';
