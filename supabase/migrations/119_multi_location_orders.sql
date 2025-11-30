-- ============================================================================
-- MULTI-LOCATION ORDER SUPPORT
-- ============================================================================
-- Enables orders to pull inventory from multiple locations.
-- Each order item can specify which location it's fulfilled from.
--
-- Use Cases:
-- 1. Customer orders Product A (only in stock at Location 1) and
--    Product B (only in stock at Location 2)
-- 2. Large order split across locations based on stock levels
-- 3. Nearest-location fulfillment for delivery orders
-- ============================================================================

-- ============================================================================
-- 1. ADD LOCATION TRACKING TO ORDER ITEMS
-- ============================================================================

-- Add location_id to order_items (which location fulfills this line item)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Add index for queries by location
CREATE INDEX IF NOT EXISTS idx_order_items_location
ON order_items(location_id) WHERE location_id IS NOT NULL;

-- Composite index for order + location queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_location
ON order_items(order_id, location_id);

COMMENT ON COLUMN order_items.location_id IS
'The location this line item is fulfilled from. NULL means use order.primary_location_id (legacy).';

-- ============================================================================
-- 2. CREATE ORDER-LOCATIONS JUNCTION TABLE
-- ============================================================================
-- Tracks all locations involved in an order for reporting and fulfillment

CREATE TABLE IF NOT EXISTS order_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Tracking
  item_count INTEGER DEFAULT 0,
  total_quantity NUMERIC(10,3) DEFAULT 0,
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled'
    CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'shipped')),

  -- Optional notes (e.g., "Transferred from Main warehouse")
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,

  -- One entry per order-location combination
  UNIQUE(order_id, location_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_locations_order ON order_locations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_locations_location ON order_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_order_locations_status ON order_locations(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_order_locations_unfulfilled
ON order_locations(location_id, fulfillment_status)
WHERE fulfillment_status != 'fulfilled';

-- RLS
ALTER TABLE order_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order locations for their vendor"
ON order_locations FOR SELECT
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Service role full access to order_locations"
ON order_locations FOR ALL
USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER set_order_locations_updated_at
BEFORE UPDATE ON order_locations
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

COMMENT ON TABLE order_locations IS
'Junction table tracking all locations involved in fulfilling an order.
Enables multi-location order fulfillment and per-location status tracking.';

-- ============================================================================
-- 3. RENAME pickup_location_id TO primary_location_id (Optional)
-- ============================================================================
-- Keep pickup_location_id for backward compatibility but add alias

-- Note: We're NOT renaming the column to avoid breaking existing code
-- Instead, we document that pickup_location_id = primary fulfillment location
-- and order_items.location_id = actual per-item fulfillment location

COMMENT ON COLUMN orders.pickup_location_id IS
'Primary location for this order (customer pickup location or default fulfillment location).
For multi-location orders, actual fulfillment locations are in order_items.location_id.';

-- ============================================================================
-- 4. HELPER FUNCTION: Populate order_locations from order_items
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_order_locations(p_order_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Delete existing entries for this order
  DELETE FROM order_locations WHERE order_id = p_order_id;

  -- Insert aggregated data from order_items
  INSERT INTO order_locations (order_id, location_id, item_count, total_quantity)
  SELECT
    oi.order_id,
    COALESCE(oi.location_id, o.pickup_location_id) as location_id,
    COUNT(*) as item_count,
    SUM(oi.quantity) as total_quantity
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.order_id = p_order_id
    AND COALESCE(oi.location_id, o.pickup_location_id) IS NOT NULL
  GROUP BY oi.order_id, COALESCE(oi.location_id, o.pickup_location_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_order_locations IS
'Syncs order_locations table from order_items. Call after order creation or modification.';

-- ============================================================================
-- 5. ENHANCED INVENTORY RESERVATION FOR MULTI-LOCATION
-- ============================================================================

CREATE OR REPLACE FUNCTION reserve_inventory_multilocation(
  p_order_id UUID,
  p_vendor_id UUID,
  p_items JSONB,  -- Array of {product_id, location_id, quantity, inventory_id?}
  p_hold_duration_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  location_id UUID,
  hold_id UUID,
  inventory_id UUID,
  requested_quantity NUMERIC,
  available_quantity NUMERIC,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_location_id UUID;
  v_quantity NUMERIC;
  v_inventory_id UUID;
  v_available NUMERIC;
  v_hold_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_expires_at := NOW() + (p_hold_duration_minutes || ' minutes')::INTERVAL;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_location_id := (v_item->>'location_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_inventory_id := (v_item->>'inventory_id')::UUID;

    -- Find inventory record if not provided
    IF v_inventory_id IS NULL THEN
      SELECT i.id INTO v_inventory_id
      FROM inventory i
      WHERE i.product_id = v_product_id
        AND i.location_id = v_location_id
        AND i.vendor_id = p_vendor_id;
    END IF;

    -- Check if inventory exists
    IF v_inventory_id IS NULL THEN
      product_id := v_product_id;
      location_id := v_location_id;
      hold_id := NULL;
      inventory_id := NULL;
      requested_quantity := v_quantity;
      available_quantity := 0;
      success := FALSE;
      error_message := 'No inventory record found for product at this location';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Lock and check available quantity
    SELECT
      i.quantity - COALESCE(
        (SELECT SUM(h.quantity)
         FROM inventory_holds h
         WHERE h.inventory_id = i.id
           AND h.released_at IS NULL
           AND h.expires_at > NOW()),
        0
      )
    INTO v_available
    FROM inventory i
    WHERE i.id = v_inventory_id
    FOR UPDATE;

    -- Check availability
    IF v_available < v_quantity THEN
      product_id := v_product_id;
      location_id := v_location_id;
      hold_id := NULL;
      inventory_id := v_inventory_id;
      requested_quantity := v_quantity;
      available_quantity := v_available;
      success := FALSE;
      error_message := format('Insufficient inventory: requested %s, available %s', v_quantity, v_available);
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Create hold
    INSERT INTO inventory_holds (
      inventory_id,
      order_id,
      product_id,
      location_id,
      quantity,
      expires_at
    ) VALUES (
      v_inventory_id,
      p_order_id,
      v_product_id,
      v_location_id,
      v_quantity,
      v_expires_at
    )
    RETURNING id INTO v_hold_id;

    -- Return success
    product_id := v_product_id;
    location_id := v_location_id;
    hold_id := v_hold_id;
    inventory_id := v_inventory_id;
    requested_quantity := v_quantity;
    available_quantity := v_available;
    success := TRUE;
    error_message := NULL;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reserve_inventory_multilocation IS
'Reserves inventory for multi-location orders. Each item specifies its fulfillment location.
Returns success/failure status for each item with available quantities.';

-- ============================================================================
-- 6. VIEW: Orders with Location Summary
-- ============================================================================

CREATE OR REPLACE VIEW v_orders_with_locations AS
SELECT
  o.*,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'location_id', ol.location_id,
      'location_name', l.name,
      'item_count', ol.item_count,
      'total_quantity', ol.total_quantity,
      'fulfillment_status', ol.fulfillment_status
    ))
    FROM order_locations ol
    JOIN locations l ON l.id = ol.location_id
    WHERE ol.order_id = o.id
  ) as fulfillment_locations,
  (
    SELECT COUNT(DISTINCT oi.location_id)
    FROM order_items oi
    WHERE oi.order_id = o.id AND oi.location_id IS NOT NULL
  ) as location_count
FROM orders o;

COMMENT ON VIEW v_orders_with_locations IS
'Orders enriched with multi-location fulfillment data.';

-- Grant access
GRANT SELECT ON v_orders_with_locations TO authenticated;
GRANT SELECT ON v_orders_with_locations TO service_role;

-- ============================================================================
-- 7. BACKFILL: Set order_items.location_id from orders.pickup_location_id
-- ============================================================================

-- Backfill existing order items with their order's pickup_location_id
UPDATE order_items oi
SET location_id = o.pickup_location_id
FROM orders o
WHERE oi.order_id = o.id
  AND oi.location_id IS NULL
  AND o.pickup_location_id IS NOT NULL;

-- Sync order_locations for existing orders
DO $$
DECLARE
  v_order_id UUID;
BEGIN
  FOR v_order_id IN
    SELECT DISTINCT order_id FROM order_items WHERE location_id IS NOT NULL
  LOOP
    PERFORM sync_order_locations(v_order_id);
  END LOOP;
END $$;

-- ============================================================================
-- 8. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'MULTI-LOCATION ORDERS';
  RAISE NOTICE '================================';
  RAISE NOTICE 'order_items.location_id added';
  RAISE NOTICE 'order_locations junction table created';
  RAISE NOTICE 'reserve_inventory_multilocation() function created';
  RAISE NOTICE 'v_orders_with_locations view created';
  RAISE NOTICE 'Existing orders backfilled';
  RAISE NOTICE '================================';
END $$;
