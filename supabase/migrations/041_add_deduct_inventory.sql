-- ============================================================================
-- ADD deduct_inventory FUNCTION
-- ============================================================================
-- This function deducts inventory quantities when an order is completed
-- Also creates stock movement records for audit trail
-- Called by process-checkout Edge Function after successful payment
-- ============================================================================

CREATE OR REPLACE FUNCTION deduct_inventory(
  p_order_id UUID,
  p_items JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_item JSONB;
  v_inventory_id UUID;
  v_quantity INTEGER;
  v_product_id UUID;
  v_current_quantity NUMERIC;
  v_vendor_id UUID;
  v_location_id UUID;
BEGIN
  -- Iterate through items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventoryId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    IF v_inventory_id IS NOT NULL THEN
      -- Get product_id, vendor_id, location_id, and current quantity from inventory
      SELECT product_id, vendor_id, location_id, quantity
      INTO v_product_id, v_vendor_id, v_location_id, v_current_quantity
      FROM inventory
      WHERE id = v_inventory_id;

      IF v_product_id IS NULL THEN
        -- Inventory item not found, log warning but continue
        RAISE WARNING 'Inventory item % not found for order %', v_inventory_id, p_order_id;
        CONTINUE;
      END IF;

      -- Deduct from inventory
      UPDATE inventory
      SET
        quantity = quantity - v_quantity,
        updated_at = NOW()
      WHERE id = v_inventory_id;

      -- Log stock movement (note: inventory_id column doesn't exist in stock_movements)
      INSERT INTO stock_movements (
        product_id,
        vendor_id,
        location_id,
        movement_type,
        quantity_before,
        quantity_after,
        quantity_change,
        reference_type,
        reference_id,
        created_at
      )
      VALUES (
        v_product_id,
        v_vendor_id,
        v_location_id,
        'sale',
        v_current_quantity,
        v_current_quantity - v_quantity,
        -v_quantity,
        'order',
        p_order_id,
        NOW()
      );
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION deduct_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_inventory(UUID, JSONB) TO service_role;

-- Comment
COMMENT ON FUNCTION deduct_inventory(UUID, JSONB) IS
'Deducts inventory quantities for items in an order and creates stock movement records. Called after successful order completion.';

-- ============================================================================
-- ADD inventory_reconciliation_queue TABLE (for tracking failed deductions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_reconciliation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  error TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_inventory_reconciliation_order ON inventory_reconciliation_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reconciliation_resolved ON inventory_reconciliation_queue(resolved) WHERE NOT resolved;

-- RLS policies
ALTER TABLE inventory_reconciliation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reconciliation queue for their vendor"
  ON inventory_reconciliation_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN vendor_users vu ON vu.vendor_id = o.vendor_id
      WHERE o.id = inventory_reconciliation_queue.order_id
        AND vu.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON inventory_reconciliation_queue TO authenticated;
GRANT ALL ON inventory_reconciliation_queue TO service_role;

-- Comment
COMMENT ON TABLE inventory_reconciliation_queue IS
'Tracks failed inventory deduction attempts for manual reconciliation. Used when automatic inventory updates fail.';
