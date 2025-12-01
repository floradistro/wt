-- ============================================================================
-- SMART ORDER ROUTING FOR MULTI-LOCATION FULFILLMENT
-- ============================================================================
-- Automatically routes orders to optimal locations based on:
-- 1. Product availability
-- 2. Distance to customer (for shipping)
-- 3. Minimize number of shipments (prefer single-location fulfillment)
-- ============================================================================

-- ============================================================================
-- 0. ADD FULFILLMENT TRACKING TO ORDER ITEMS
-- ============================================================================

-- Per-item fulfillment status (for multi-location orders)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending'
  CHECK (fulfillment_status IN ('pending', 'fulfilled', 'cancelled'));

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS fulfilled_quantity NUMERIC(10,3) DEFAULT 0;

-- Index for unfulfilled items queries
CREATE INDEX IF NOT EXISTS idx_order_items_fulfillment_status
ON order_items(fulfillment_status) WHERE fulfillment_status != 'fulfilled';

COMMENT ON COLUMN order_items.fulfillment_status IS
'Per-item fulfillment status. For multi-location orders, each item can be fulfilled independently.';

-- ============================================================================
-- 1. HELPER: Calculate distance between two points (Haversine formula)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371; -- Earth's radius in km
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 2. MAIN FUNCTION: Route order items to optimal locations
-- ============================================================================

CREATE OR REPLACE FUNCTION route_order_to_locations(
  p_vendor_id UUID,
  p_items JSONB,  -- Array of {product_id, quantity}
  p_customer_lat DOUBLE PRECISION DEFAULT NULL,
  p_customer_lon DOUBLE PRECISION DEFAULT NULL,
  p_preferred_location_id UUID DEFAULT NULL  -- For pickup orders
)
RETURNS TABLE (
  product_id UUID,
  location_id UUID,
  location_name TEXT,
  quantity NUMERIC,
  available_quantity NUMERIC,
  distance_km DOUBLE PRECISION,
  can_fulfill BOOLEAN
) AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_best_single_location UUID;
  v_best_single_distance DOUBLE PRECISION;
  v_all_products_available BOOLEAN;
BEGIN
  -- If preferred location specified (pickup order), try to fulfill from there
  IF p_preferred_location_id IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;

      RETURN QUERY
      SELECT
        v_product_id,
        l.id,
        l.name,
        v_quantity,
        COALESCE(i.available_quantity, 0),
        calculate_distance_km(p_customer_lat, p_customer_lon, l.latitude, l.longitude),
        COALESCE(i.available_quantity, 0) >= v_quantity
      FROM locations l
      LEFT JOIN inventory i ON i.location_id = l.id
        AND i.product_id = v_product_id
        AND i.vendor_id = p_vendor_id
      WHERE l.id = p_preferred_location_id
        AND l.is_active = true;
    END LOOP;
    RETURN;
  END IF;

  -- For shipping orders: Try to find single location that can fulfill everything
  -- Check each active location
  FOR v_best_single_location, v_best_single_distance IN
    SELECT
      l.id,
      calculate_distance_km(p_customer_lat, p_customer_lon, l.latitude, l.longitude) as dist
    FROM locations l
    WHERE l.vendor_id = p_vendor_id AND l.is_active = true
    ORDER BY dist NULLS LAST
  LOOP
    -- Check if this location has all products
    SELECT bool_and(
      COALESCE(
        (SELECT i.available_quantity >= (item->>'quantity')::NUMERIC
         FROM inventory i
         WHERE i.location_id = v_best_single_location
           AND i.product_id = (item->>'product_id')::UUID
           AND i.vendor_id = p_vendor_id),
        false
      )
    )
    INTO v_all_products_available
    FROM jsonb_array_elements(p_items) item;

    -- If this location can fulfill everything, use it
    IF v_all_products_available THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
      LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;

        RETURN QUERY
        SELECT
          v_product_id,
          l.id,
          l.name,
          v_quantity,
          COALESCE(i.available_quantity, 0),
          v_best_single_distance,
          true
        FROM locations l
        LEFT JOIN inventory i ON i.location_id = l.id
          AND i.product_id = v_product_id
          AND i.vendor_id = p_vendor_id
        WHERE l.id = v_best_single_location;
      END LOOP;
      RETURN;
    END IF;
  END LOOP;

  -- No single location can fulfill everything
  -- Route each product to the closest location that has it in stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    RETURN QUERY
    SELECT
      v_product_id,
      l.id,
      l.name,
      v_quantity,
      i.available_quantity,
      calculate_distance_km(p_customer_lat, p_customer_lon, l.latitude, l.longitude) as dist,
      i.available_quantity >= v_quantity
    FROM inventory i
    JOIN locations l ON l.id = i.location_id
    WHERE i.product_id = v_product_id
      AND i.vendor_id = p_vendor_id
      AND i.available_quantity >= v_quantity
      AND l.is_active = true
    ORDER BY dist NULLS LAST
    LIMIT 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION route_order_to_locations IS
'Routes order items to optimal fulfillment locations.
For pickup: Uses preferred_location_id.
For shipping: Tries single-location fulfillment first, then routes per-item to closest available.';

-- ============================================================================
-- 3. VIEW: Location fulfillment queue (for staff)
-- ============================================================================

CREATE OR REPLACE VIEW v_location_fulfillment_queue AS
SELECT
  oi.id as order_item_id,
  oi.order_id,
  o.order_number,
  o.order_type,
  o.status as order_status,
  oi.location_id as fulfillment_location_id,
  l.name as fulfillment_location_name,
  oi.product_id,
  oi.product_name,
  oi.quantity,
  oi.quantity_grams,
  oi.tier_name,
  oi.fulfillment_status as item_fulfillment_status,
  o.created_at as order_created_at,
  o.customer_id,
  c.first_name as customer_first_name,
  c.last_name as customer_last_name,
  o.shipping_name,
  o.shipping_address_line1,
  o.shipping_city,
  o.shipping_state,
  o.shipping_zip,
  -- Count of items at this location for this order
  COUNT(*) OVER (PARTITION BY oi.order_id, oi.location_id) as items_at_location,
  -- Total items in order
  COUNT(*) OVER (PARTITION BY oi.order_id) as total_order_items
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
LEFT JOIN locations l ON l.id = oi.location_id
LEFT JOIN customers c ON c.id = o.customer_id
WHERE oi.location_id IS NOT NULL
  AND o.status NOT IN ('completed', 'cancelled')
ORDER BY o.created_at DESC;

COMMENT ON VIEW v_location_fulfillment_queue IS
'Shows order items that need to be fulfilled at each location.
Staff filter by their location_id to see their work queue.';

GRANT SELECT ON v_location_fulfillment_queue TO authenticated;
GRANT SELECT ON v_location_fulfillment_queue TO service_role;

-- ============================================================================
-- 4. FUNCTION: Mark items as fulfilled by location
-- ============================================================================

CREATE OR REPLACE FUNCTION fulfill_order_items_at_location(
  p_order_id UUID,
  p_location_id UUID,
  p_fulfilled_by_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  items_fulfilled INTEGER,
  order_fully_fulfilled BOOLEAN,
  remaining_locations UUID[]
) AS $$
DECLARE
  v_items_fulfilled INTEGER;
  v_total_items INTEGER;
  v_fulfilled_items INTEGER;
  v_remaining UUID[];
BEGIN
  -- Mark items at this location as fulfilled
  UPDATE order_items
  SET
    fulfillment_status = 'fulfilled',
    fulfilled_quantity = quantity
  WHERE order_id = p_order_id
    AND location_id = p_location_id
    AND fulfillment_status != 'fulfilled';

  GET DIAGNOSTICS v_items_fulfilled = ROW_COUNT;

  -- Update order_locations status
  UPDATE order_locations
  SET
    fulfillment_status = 'fulfilled',
    fulfilled_at = NOW(),
    updated_at = NOW()
  WHERE order_id = p_order_id
    AND location_id = p_location_id;

  -- Check if entire order is fulfilled
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE fulfillment_status = 'fulfilled')
  INTO v_total_items, v_fulfilled_items
  FROM order_items
  WHERE order_id = p_order_id;

  -- Get remaining unfulfilled locations
  SELECT array_agg(DISTINCT location_id)
  INTO v_remaining
  FROM order_items
  WHERE order_id = p_order_id
    AND fulfillment_status != 'fulfilled'
    AND location_id IS NOT NULL;

  -- Update order fulfillment status
  IF v_fulfilled_items = v_total_items THEN
    UPDATE orders
    SET
      fulfillment_status = 'fulfilled',
      status = CASE
        WHEN order_type = 'pickup' THEN 'ready'
        WHEN order_type = 'shipping' THEN 'ready_to_ship'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = p_order_id;
  ELSIF v_fulfilled_items > 0 THEN
    UPDATE orders
    SET
      fulfillment_status = 'partial',
      updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  items_fulfilled := v_items_fulfilled;
  order_fully_fulfilled := (v_fulfilled_items = v_total_items);
  remaining_locations := v_remaining;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fulfill_order_items_at_location IS
'Marks all items at a specific location as fulfilled.
Updates order status to partial or fulfilled based on remaining items.';

-- ============================================================================
-- 5. API: Get orders for a specific location
-- ============================================================================

CREATE OR REPLACE FUNCTION get_orders_for_location(
  p_location_id UUID,
  p_status TEXT DEFAULT NULL,  -- Filter by order status
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  order_type TEXT,
  order_status TEXT,
  customer_name TEXT,
  items_at_location BIGINT,
  total_order_items BIGINT,
  location_fulfillment_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (o.id)
    o.id,
    o.order_number,
    o.order_type,
    o.status,
    COALESCE(c.first_name || ' ' || c.last_name, o.shipping_name, 'Guest'),
    COUNT(oi.id) FILTER (WHERE oi.location_id = p_location_id) OVER (PARTITION BY o.id),
    COUNT(oi.id) OVER (PARTITION BY o.id),
    ol.fulfillment_status,
    o.created_at
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN order_locations ol ON ol.order_id = o.id AND ol.location_id = p_location_id
  LEFT JOIN customers c ON c.id = o.customer_id
  WHERE oi.location_id = p_location_id
    AND o.status NOT IN ('completed', 'cancelled')
    AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.id, o.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_orders_for_location IS
'Gets orders that have items to fulfill at a specific location.
Used by staff to see their work queue.';

-- ============================================================================
-- 6. PER-LOCATION SHIPPING SUPPORT
-- ============================================================================
-- For multi-location orders, each location ships separately with its own tracking

-- Add shipping columns to order_locations
ALTER TABLE order_locations
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
ADD COLUMN IF NOT EXISTS shipping_service TEXT,
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shipped_by_user_id UUID REFERENCES users(id);

COMMENT ON COLUMN order_locations.tracking_number IS 'Tracking number for shipment from this location';
COMMENT ON COLUMN order_locations.shipping_carrier IS 'Carrier used (USPS, UPS, FedEx, DHL, etc)';
COMMENT ON COLUMN order_locations.shipped_at IS 'When this location shipped its items';

-- Index for shipped/unshipped location queries
CREATE INDEX IF NOT EXISTS idx_order_locations_shipped
ON order_locations(order_id) WHERE shipped_at IS NULL;

-- ============================================================================
-- 7. FUNCTION: Ship items from a specific location
-- ============================================================================

CREATE OR REPLACE FUNCTION ship_order_from_location(
  p_order_id UUID,
  p_location_id UUID,
  p_tracking_number TEXT,
  p_shipping_carrier TEXT DEFAULT 'USPS',
  p_tracking_url TEXT DEFAULT NULL,
  p_shipping_cost NUMERIC DEFAULT NULL,
  p_shipped_by_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  location_shipped BOOLEAN,
  all_locations_shipped BOOLEAN,
  remaining_locations_to_ship UUID[]
) AS $$
DECLARE
  v_unshipped_locations UUID[];
  v_total_locations INTEGER;
  v_shipped_locations INTEGER;
BEGIN
  -- Update order_locations with shipping info
  UPDATE order_locations
  SET
    tracking_number = p_tracking_number,
    tracking_url = p_tracking_url,
    shipping_carrier = p_shipping_carrier,
    shipping_cost = COALESCE(p_shipping_cost, shipping_cost),
    shipped_at = NOW(),
    shipped_by_user_id = p_shipped_by_user_id,
    fulfillment_status = 'shipped',
    updated_at = NOW()
  WHERE order_id = p_order_id
    AND location_id = p_location_id;

  -- Also mark items at this location as fulfilled if not already
  UPDATE order_items
  SET
    fulfillment_status = 'fulfilled',
    fulfilled_quantity = quantity
  WHERE order_id = p_order_id
    AND location_id = p_location_id
    AND fulfillment_status != 'fulfilled';

  -- Check shipping status across all locations
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE shipped_at IS NOT NULL)
  INTO v_total_locations, v_shipped_locations
  FROM order_locations
  WHERE order_id = p_order_id;

  -- Get remaining unshipped locations
  SELECT array_agg(location_id)
  INTO v_unshipped_locations
  FROM order_locations
  WHERE order_id = p_order_id
    AND shipped_at IS NULL;

  -- Update order status based on shipping progress
  IF v_shipped_locations = v_total_locations AND v_total_locations > 0 THEN
    -- All locations shipped - mark order as shipped
    UPDATE orders
    SET
      status = 'shipped',
      fulfillment_status = 'fulfilled',
      shipped_at = NOW(),
      shipped_by_user_id = p_shipped_by_user_id,
      -- For single-location orders, copy tracking to order level
      tracking_number = CASE
        WHEN v_total_locations = 1 THEN p_tracking_number
        ELSE tracking_number
      END,
      tracking_url = CASE
        WHEN v_total_locations = 1 THEN p_tracking_url
        ELSE tracking_url
      END,
      shipping_carrier = CASE
        WHEN v_total_locations = 1 THEN p_shipping_carrier
        ELSE shipping_carrier
      END,
      updated_at = NOW()
    WHERE id = p_order_id;
  ELSIF v_shipped_locations > 0 THEN
    -- Partial shipping - update fulfillment status
    UPDATE orders
    SET
      fulfillment_status = 'partial',
      updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  success := true;
  location_shipped := true;
  all_locations_shipped := (v_shipped_locations = v_total_locations);
  remaining_locations_to_ship := v_unshipped_locations;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION ship_order_from_location IS
'Ships items from a specific location with tracking info.
For multi-location orders, each location can be shipped independently.
Order is marked as shipped only when all locations have shipped.';

-- ============================================================================
-- 8. VIEW: Per-location shipping status for orders
-- ============================================================================

CREATE OR REPLACE VIEW v_order_shipments AS
SELECT
  ol.order_id,
  o.order_number,
  ol.location_id,
  l.name as location_name,
  ol.item_count,
  ol.fulfillment_status,
  ol.tracking_number,
  ol.tracking_url,
  ol.shipping_carrier,
  ol.shipping_cost,
  ol.shipped_at,
  ol.shipped_by_user_id,
  u.first_name || ' ' || u.last_name as shipped_by_name,
  -- Count shipments for this order
  COUNT(*) OVER (PARTITION BY ol.order_id) as total_shipments,
  COUNT(*) FILTER (WHERE ol.shipped_at IS NOT NULL) OVER (PARTITION BY ol.order_id) as shipped_count,
  -- Customer info for notifications
  o.customer_id,
  COALESCE(c.first_name || ' ' || c.last_name, o.shipping_name, 'Guest') as customer_name,
  COALESCE(c.email, '') as customer_email,
  o.shipping_name,
  o.shipping_address_line1,
  o.shipping_city,
  o.shipping_state,
  o.shipping_zip
FROM order_locations ol
JOIN orders o ON o.id = ol.order_id
JOIN locations l ON l.id = ol.location_id
LEFT JOIN users u ON u.id = ol.shipped_by_user_id
LEFT JOIN customers c ON c.id = o.customer_id
WHERE o.order_type = 'shipping'
ORDER BY ol.order_id, ol.shipped_at NULLS LAST;

COMMENT ON VIEW v_order_shipments IS
'Shows all shipments for multi-location orders.
Used to display tracking info to customers and staff.';

GRANT SELECT ON v_order_shipments TO authenticated;
GRANT SELECT ON v_order_shipments TO service_role;

-- ============================================================================
-- 9. FUNCTION: Smart Order Routing (Apple/Best Buy style)
-- ============================================================================
-- For pickup orders: Check inventory at pickup location per-item
--   - Items IN STOCK at pickup → pickup from there
--   - Items NOT IN STOCK at pickup → ship from another location
-- For shipping orders: Route to locations with inventory
-- This gives customers automatic order splitting like major retailers

CREATE OR REPLACE FUNCTION route_order_to_locations(p_order_id UUID)
RETURNS TABLE (
  location_id UUID,
  location_name TEXT,
  item_count BIGINT,
  fulfillment_type TEXT  -- 'pickup' or 'shipping'
) AS $$
DECLARE
  v_vendor_id UUID;
  v_order_type TEXT;
  v_pickup_location_id UUID;
  v_pickup_location_name TEXT;
  v_item RECORD;
  v_has_inventory BOOLEAN;
  v_ship_location_id UUID;
  v_ship_location_name TEXT;
BEGIN
  -- Get order info
  SELECT o.vendor_id, o.order_type, o.pickup_location_id, l.name
  INTO v_vendor_id, v_order_type, v_pickup_location_id, v_pickup_location_name
  FROM orders o
  LEFT JOIN locations l ON l.id = o.pickup_location_id
  WHERE o.id = p_order_id;

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- =========================================================================
  -- SMART ROUTING: Check inventory per-item at pickup location
  -- =========================================================================

  IF v_order_type IN ('pickup', 'walk_in') AND v_pickup_location_id IS NOT NULL THEN
    -- For each item, check if pickup location has inventory
    FOR v_item IN
      SELECT oi.id as item_id, oi.product_id, oi.product_name, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = p_order_id
    LOOP
      -- Check inventory at pickup location
      SELECT EXISTS (
        SELECT 1 FROM inventory i
        WHERE i.location_id = v_pickup_location_id
          AND i.product_id = v_item.product_id
          AND i.vendor_id = v_vendor_id
          AND i.available_quantity >= v_item.quantity
      ) INTO v_has_inventory;

      IF v_has_inventory THEN
        -- ✅ IN STOCK at pickup location → customer picks up
        UPDATE order_items
        SET
          location_id = v_pickup_location_id,
          pickup_location_id = v_pickup_location_id,
          pickup_location_name = v_pickup_location_name,
          order_type = 'pickup'
        WHERE id = v_item.item_id;
      ELSE
        -- ❌ NOT IN STOCK at pickup → find another location to ship from
        SELECT i.location_id, l.name
        INTO v_ship_location_id, v_ship_location_name
        FROM inventory i
        JOIN locations l ON l.id = i.location_id
        WHERE i.product_id = v_item.product_id
          AND i.vendor_id = v_vendor_id
          AND i.available_quantity >= v_item.quantity
          AND l.is_active = true
          AND i.location_id != v_pickup_location_id  -- Different from pickup
        ORDER BY i.available_quantity DESC
        LIMIT 1;

        IF v_ship_location_id IS NOT NULL THEN
          -- Ship from another location
          UPDATE order_items
          SET
            location_id = v_ship_location_id,
            pickup_location_id = NULL,
            pickup_location_name = NULL,
            order_type = 'shipping'
          WHERE id = v_item.item_id;
        ELSE
          -- No other location has it - assign to pickup anyway (backorder scenario)
          UPDATE order_items
          SET
            location_id = v_pickup_location_id,
            pickup_location_id = v_pickup_location_id,
            pickup_location_name = v_pickup_location_name,
            order_type = 'pickup'
          WHERE id = v_item.item_id;
        END IF;
      END IF;
    END LOOP;

  ELSE
    -- =========================================================================
    -- PURE SHIPPING ORDER: Route to best locations with inventory
    -- =========================================================================

    FOR v_item IN
      SELECT oi.id as item_id, oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.location_id IS NULL
    LOOP
      -- Find location with this product in stock
      SELECT i.location_id, l.name
      INTO v_ship_location_id, v_ship_location_name
      FROM inventory i
      JOIN locations l ON l.id = i.location_id
      WHERE i.product_id = v_item.product_id
        AND i.vendor_id = v_vendor_id
        AND i.available_quantity >= v_item.quantity
        AND l.is_active = true
      ORDER BY i.available_quantity DESC
      LIMIT 1;

      IF v_ship_location_id IS NOT NULL THEN
        UPDATE order_items
        SET
          location_id = v_ship_location_id,
          order_type = 'shipping'
        WHERE id = v_item.item_id;
      END IF;
    END LOOP;
  END IF;

  -- =========================================================================
  -- CREATE ORDER_LOCATIONS RECORDS (grouped by location + fulfillment type)
  -- =========================================================================

  -- Delete existing order_locations for this order (in case of re-routing)
  DELETE FROM order_locations WHERE order_id = p_order_id;

  -- Insert fresh records grouped by location
  INSERT INTO order_locations (order_id, location_id, item_count, fulfillment_status)
  SELECT
    p_order_id,
    oi.location_id,
    COUNT(*),
    'pending'
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.location_id IS NOT NULL
  GROUP BY oi.location_id;

  -- =========================================================================
  -- UPDATE ORDER TYPE IF MIXED (has both pickup and shipping items)
  -- =========================================================================

  -- If order has shipping items, update order to reflect that
  IF EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = p_order_id AND order_type = 'shipping'
  ) THEN
    -- Check if it's a mixed order
    IF EXISTS (
      SELECT 1 FROM order_items
      WHERE order_id = p_order_id AND order_type = 'pickup'
    ) THEN
      -- Mixed order: pickup + shipping
      UPDATE orders
      SET delivery_type = 'mixed'
      WHERE id = p_order_id;
    ELSE
      -- Pure shipping
      UPDATE orders
      SET order_type = 'shipping', delivery_type = 'shipping'
      WHERE id = p_order_id;
    END IF;
  END IF;

  -- =========================================================================
  -- RETURN RESULTS
  -- =========================================================================

  RETURN QUERY
  SELECT
    oi.location_id,
    l.name,
    COUNT(*)::BIGINT,
    COALESCE(oi.order_type, 'shipping')::TEXT
  FROM order_items oi
  JOIN locations l ON l.id = oi.location_id
  WHERE oi.order_id = p_order_id
    AND oi.location_id IS NOT NULL
  GROUP BY oi.location_id, l.name, oi.order_type
  ORDER BY oi.order_type DESC;  -- pickup first, then shipping
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION route_order_to_locations(UUID) IS
'Smart order routing like Apple/Best Buy:
- For pickup orders: Checks inventory at pickup location PER ITEM
  - Items in stock → pickup from that location
  - Items NOT in stock → automatically ship from another location
- For shipping orders: Routes to locations with inventory
- Creates order_locations records for fulfillment tracking
- Updates order to "mixed" delivery_type if both pickup and shipping';

-- ============================================================================
-- 10. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'SMART ORDER ROUTING';
  RAISE NOTICE '================================';
  RAISE NOTICE 'calculate_distance_km() - Haversine distance';
  RAISE NOTICE 'route_order_to_locations(vendor, items) - Planning';
  RAISE NOTICE 'route_order_to_locations(order_id) - Checkout routing';
  RAISE NOTICE 'v_location_fulfillment_queue - Staff work queue';
  RAISE NOTICE 'fulfill_order_items_at_location() - Mark fulfilled';
  RAISE NOTICE 'get_orders_for_location() - Location order list';
  RAISE NOTICE 'ship_order_from_location() - Per-location shipping';
  RAISE NOTICE 'v_order_shipments - Shipment tracking view';
  RAISE NOTICE '================================';
END $$;
