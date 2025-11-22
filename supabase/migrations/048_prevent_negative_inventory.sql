-- ============================================================================
-- PREVENT NEGATIVE INVENTORY
-- ============================================================================
-- This migration adds database-level constraints to prevent negative inventory
-- Ensures data integrity at the database level, independent of application logic
-- ============================================================================

-- ============================================================================
-- ADD CHECK CONSTRAINT TO INVENTORY TABLE
-- ============================================================================

-- Add constraint to prevent negative inventory quantities
ALTER TABLE inventory
ADD CONSTRAINT inventory_non_negative_qty
CHECK (quantity >= 0);

-- ============================================================================
-- UPDATE EXISTING FUNCTIONS TO HANDLE CONSTRAINT VIOLATIONS
-- ============================================================================

-- Update the deduct_inventory function to provide better error messages
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

      -- Check if deduction would result in negative inventory
      IF v_current_quantity < v_quantity THEN
        RAISE EXCEPTION 'Insufficient inventory: product % has % units, requested %',
          v_product_id, v_current_quantity, v_quantity;
      END IF;

      -- Deduct from inventory
      UPDATE inventory
      SET
        quantity = quantity - v_quantity,
        updated_at = NOW()
      WHERE id = v_inventory_id;

      -- Log stock movement
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

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT inventory_non_negative_qty ON inventory IS
'Ensures inventory quantity can never be negative. Prevents overselling at the database level.';

-- ============================================================================
-- VALIDATION QUERY (Optional - for testing)
-- ============================================================================

-- Check if any existing records violate the constraint
-- (This will fail the migration if negative quantities exist)
-- If this fails, you need to clean up data first:
-- UPDATE inventory SET quantity = 0 WHERE quantity < 0;

DO $$
DECLARE
  v_negative_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_negative_count
  FROM inventory
  WHERE quantity < 0;

  IF v_negative_count > 0 THEN
    RAISE WARNING 'Found % inventory records with negative quantities. These will need to be corrected.', v_negative_count;
    -- Uncomment below to auto-correct (USE WITH CAUTION):
    -- UPDATE inventory SET quantity = 0 WHERE quantity < 0;
  END IF;
END $$;
