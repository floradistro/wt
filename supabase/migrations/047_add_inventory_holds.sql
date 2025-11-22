-- ============================================================================
-- INVENTORY HOLDS / RESERVATIONS SYSTEM
-- ============================================================================
-- This migration adds inventory hold/reservation functionality to prevent
-- overselling and race conditions during checkout.
--
-- Flow:
-- 1. Before payment: reserve_inventory() checks availability and creates holds
-- 2. After successful payment: finalize_inventory_holds() converts holds to deductions
-- 3. After failed payment: release_inventory_holds() releases the reservation
-- 4. Automatic cleanup: expired holds released after 10 minutes
-- ============================================================================

-- ============================================================================
-- CREATE INVENTORY HOLDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL, -- Denormalized for faster queries
  location_id UUID NOT NULL, -- Denormalized for faster queries
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  released_at TIMESTAMPTZ,
  release_reason TEXT, -- 'completed', 'cancelled', 'expired', 'error'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_holds_inventory_id ON inventory_holds(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_order_id ON inventory_holds(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_active ON inventory_holds(inventory_id, expires_at)
  WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_holds_expired ON inventory_holds(expires_at)
  WHERE released_at IS NULL;

-- RLS policies
ALTER TABLE inventory_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage inventory holds"
  ON inventory_holds
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON inventory_holds TO authenticated;
GRANT ALL ON inventory_holds TO service_role;

-- Comment
COMMENT ON TABLE inventory_holds IS
'Tracks temporary inventory reservations during checkout. Prevents overselling by holding inventory before payment completion.';

-- ============================================================================
-- FUNCTION: RESERVE INVENTORY
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_inventory(
  p_order_id UUID,
  p_items JSONB
)
RETURNS TABLE (
  hold_id UUID,
  inventory_id UUID,
  product_id UUID,
  quantity NUMERIC,
  available_quantity NUMERIC
) AS $$
DECLARE
  v_item JSONB;
  v_inventory_id UUID;
  v_product_id UUID;
  v_location_id UUID;
  v_requested_qty NUMERIC;
  v_current_qty NUMERIC;
  v_held_qty NUMERIC;
  v_available_qty NUMERIC;
  v_hold_id UUID;
BEGIN
  -- Loop through each item in the order
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_inventory_id := (v_item->>'inventoryId')::UUID;
    v_product_id := (v_item->>'productId')::UUID;
    v_requested_qty := (v_item->>'quantity')::NUMERIC;

    -- Skip if no inventory tracking for this item
    IF v_inventory_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Lock inventory row and get current quantity
    SELECT id, product_id, location_id, quantity
    INTO v_inventory_id, v_product_id, v_location_id, v_current_qty
    FROM inventory
    WHERE id = v_inventory_id
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
      RAISE EXCEPTION 'Inventory record not found for item %', v_item->>'productName';
    END IF;

    -- Calculate quantity already held by other orders
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_held_qty
    FROM inventory_holds
    WHERE inventory_id = v_inventory_id
      AND released_at IS NULL
      AND expires_at > NOW()
      AND order_id != p_order_id; -- Exclude holds from this order (retry case)

    -- Calculate available quantity
    v_available_qty := v_current_qty - v_held_qty;

    -- Check if sufficient inventory available
    IF v_available_qty < v_requested_qty THEN
      RAISE EXCEPTION 'Insufficient inventory for product "%". Available: %, Requested: %',
        v_item->>'productName', v_available_qty, v_requested_qty;
    END IF;

    -- Create or update hold for this order
    INSERT INTO inventory_holds (
      inventory_id,
      order_id,
      product_id,
      location_id,
      quantity,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      v_inventory_id,
      p_order_id,
      v_product_id,
      v_location_id,
      v_requested_qty,
      NOW() + INTERVAL '10 minutes',
      NOW(),
      NOW()
    )
    ON CONFLICT (order_id, inventory_id)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING id INTO v_hold_id;

    -- Return hold details
    RETURN QUERY SELECT
      v_hold_id,
      v_inventory_id,
      v_product_id,
      v_requested_qty,
      v_available_qty;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: FINALIZE INVENTORY HOLDS (Convert to actual deductions)
-- ============================================================================

CREATE OR REPLACE FUNCTION finalize_inventory_holds(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_hold RECORD;
BEGIN
  -- Loop through all active holds for this order
  FOR v_hold IN
    SELECT id, inventory_id, product_id, location_id, quantity
    FROM inventory_holds
    WHERE order_id = p_order_id
      AND released_at IS NULL
  LOOP
    -- Deduct from inventory
    UPDATE inventory
    SET
      quantity = quantity - v_hold.quantity,
      updated_at = NOW()
    WHERE id = v_hold.inventory_id;

    -- Create stock movement for audit trail
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
    SELECT
      v_hold.product_id,
      i.vendor_id,
      v_hold.location_id,
      'sale',
      i.quantity + v_hold.quantity, -- Before deduction
      i.quantity, -- After deduction
      -v_hold.quantity,
      'order',
      p_order_id,
      NOW()
    FROM inventory i
    WHERE i.id = v_hold.inventory_id;

    -- Mark hold as released (completed)
    UPDATE inventory_holds
    SET
      released_at = NOW(),
      release_reason = 'completed',
      updated_at = NOW()
    WHERE id = v_hold.id;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: RELEASE INVENTORY HOLDS (Cancel reservation)
-- ============================================================================

CREATE OR REPLACE FUNCTION release_inventory_holds(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'cancelled'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Mark all active holds for this order as released
  UPDATE inventory_holds
  SET
    released_at = NOW(),
    release_reason = p_reason,
    updated_at = NOW()
  WHERE order_id = p_order_id
    AND released_at IS NULL;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: CLEANUP EXPIRED HOLDS (Background job)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_holds()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Release all expired holds
  UPDATE inventory_holds
  SET
    released_at = NOW(),
    release_reason = 'expired',
    updated_at = NOW()
  WHERE released_at IS NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADD UNIQUE CONSTRAINT
-- ============================================================================

-- Prevent duplicate holds for same order + inventory
ALTER TABLE inventory_holds
ADD CONSTRAINT inventory_holds_order_inventory_unique
UNIQUE (order_id, inventory_id);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reserve_inventory(UUID, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_inventory_holds(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION release_inventory_holds(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION release_inventory_holds(UUID, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION cleanup_expired_holds() TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION reserve_inventory IS
'Reserves inventory for an order before payment. Checks availability considering existing holds. Throws exception if insufficient inventory.';

COMMENT ON FUNCTION finalize_inventory_holds IS
'Converts inventory holds to actual deductions after successful payment. Creates stock movement records and releases holds.';

COMMENT ON FUNCTION release_inventory_holds IS
'Releases inventory holds for a cancelled or failed order. Does not deduct inventory.';

COMMENT ON FUNCTION cleanup_expired_holds IS
'Background job function to automatically release holds that have expired (after 10 minutes). Should be called periodically via cron.';
