-- =============================================================================
-- OPTIMIZE SHIPPING ORDER ROUTING: Single-Location Priority
-- =============================================================================
--
-- Problem: Current routing splits shipping orders across multiple locations
-- even when ONE location could fulfill everything. This increases shipping costs.
--
-- Solution: For shipping orders, first try to find a single location that can
-- fulfill ALL items. Only split if absolutely necessary.
-- =============================================================================

-- Drop existing function to recreate with improved logic
DROP FUNCTION IF EXISTS route_order_to_locations(UUID);

-- =============================================================================
-- IMPROVED ROUTING FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION route_order_to_locations(p_order_id UUID)
RETURNS TABLE(
  result_location_id UUID,
  result_location_name TEXT,
  result_item_count BIGINT,
  result_fulfillment_type TEXT
) AS $$
DECLARE
  v_order_type TEXT;
  v_pickup_location_id UUID;
  v_vendor_id UUID;
  v_item RECORD;
  v_best_location_id UUID;
  v_best_location_name TEXT;
  v_ship_location_id UUID;
  v_ship_location_name TEXT;
  v_total_items INT;
  v_fulfillable_count INT;
BEGIN
  -- Get order info
  SELECT o.order_type, o.pickup_location_id, o.vendor_id
  INTO v_order_type, v_pickup_location_id, v_vendor_id
  FROM orders o
  WHERE o.id = p_order_id;

  IF v_order_type IS NULL THEN
    RAISE NOTICE 'Order % not found', p_order_id;
    RETURN;
  END IF;

  RAISE NOTICE '[Routing] Order % - type: %, pickup_loc: %', p_order_id, v_order_type, v_pickup_location_id;

  -- =========================================================================
  -- PICKUP ORDER: Route to pickup location, ship items not in stock
  -- =========================================================================
  IF v_order_type = 'pickup' AND v_pickup_location_id IS NOT NULL THEN
    FOR v_item IN
      SELECT oi.id as item_id, oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = p_order_id
        AND oi.location_id IS NULL
    LOOP
      -- Check if item is in stock at pickup location
      IF EXISTS (
        SELECT 1 FROM inventory i
        WHERE i.product_id = v_item.product_id
          AND i.location_id = v_pickup_location_id
          AND i.vendor_id = v_vendor_id
          AND i.available_quantity >= v_item.quantity
      ) THEN
        -- In stock at pickup location
        UPDATE order_items
        SET
          location_id = v_pickup_location_id,
          order_type = 'pickup',
          pickup_location_id = v_pickup_location_id
        WHERE id = v_item.item_id;
      ELSE
        -- Not in stock - try to ship from another location
        SELECT i.location_id, l.name
        INTO v_ship_location_id, v_ship_location_name
        FROM inventory i
        JOIN locations l ON l.id = i.location_id
        WHERE i.product_id = v_item.product_id
          AND i.vendor_id = v_vendor_id
          AND i.available_quantity >= v_item.quantity
          AND l.is_active = true
          AND i.location_id != v_pickup_location_id
        ORDER BY i.available_quantity DESC
        LIMIT 1;

        IF v_ship_location_id IS NOT NULL THEN
          UPDATE order_items
          SET
            location_id = v_ship_location_id,
            order_type = 'shipping'
          WHERE id = v_item.item_id;
        ELSE
          -- Fallback: assign to pickup location anyway (backorder)
          UPDATE order_items
          SET
            location_id = v_pickup_location_id,
            order_type = 'pickup',
            pickup_location_id = v_pickup_location_id
          WHERE id = v_item.item_id;
        END IF;
      END IF;
    END LOOP;

  ELSE
    -- =========================================================================
    -- PURE SHIPPING ORDER: PRIORITY = SINGLE LOCATION FULFILLMENT
    -- =========================================================================

    -- Count total items that need routing
    SELECT COUNT(*) INTO v_total_items
    FROM order_items
    WHERE order_id = p_order_id
      AND location_id IS NULL;

    IF v_total_items > 0 THEN
      RAISE NOTICE '[Routing] Shipping order with % items - trying single location first', v_total_items;

      -- STEP 1: Find a single location that can fulfill ALL items
      -- This query finds locations that have ALL products with sufficient quantity
      SELECT l.id, l.name
      INTO v_best_location_id, v_best_location_name
      FROM locations l
      WHERE l.vendor_id = v_vendor_id
        AND l.is_active = true
        AND NOT EXISTS (
          -- Find items this location CANNOT fulfill
          SELECT 1
          FROM order_items oi
          LEFT JOIN inventory i ON i.product_id = oi.product_id
            AND i.location_id = l.id
            AND i.vendor_id = v_vendor_id
          WHERE oi.order_id = p_order_id
            AND oi.location_id IS NULL
            AND (i.id IS NULL OR i.available_quantity < oi.quantity)
        )
      -- Prioritize locations with highest total stock
      ORDER BY (
        SELECT COALESCE(SUM(i.available_quantity), 0)
        FROM inventory i
        JOIN order_items oi ON oi.product_id = i.product_id
        WHERE i.location_id = l.id
          AND oi.order_id = p_order_id
          AND oi.location_id IS NULL
      ) DESC
      LIMIT 1;

      IF v_best_location_id IS NOT NULL THEN
        -- SUCCESS! Route ALL items to single location
        RAISE NOTICE '[Routing] ✅ Single location fulfillment: % (%)', v_best_location_name, v_best_location_id;

        UPDATE order_items
        SET
          location_id = v_best_location_id,
          order_type = 'shipping'
        WHERE order_id = p_order_id
          AND location_id IS NULL;
      ELSE
        -- STEP 2: No single location works - try to minimize locations
        RAISE NOTICE '[Routing] ⚠️ No single location can fulfill all items - routing individually';

        -- Route each item to best available location
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
    END IF;
  END IF;

  -- =========================================================================
  -- CREATE ORDER_LOCATIONS RECORDS (grouped by location + fulfillment type)
  -- =========================================================================

  -- Delete existing order_locations for this order (in case of re-routing)
  DELETE FROM order_locations WHERE order_id = p_order_id;

  -- Insert fresh records grouped by location (with conflict handling for concurrent calls)
  INSERT INTO order_locations (order_id, location_id, item_count, total_quantity, fulfillment_status)
  SELECT
    p_order_id,
    oi.location_id,
    COUNT(*),
    SUM(oi.quantity),
    'unfulfilled'
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.location_id IS NOT NULL
  GROUP BY oi.location_id
  ON CONFLICT (order_id, location_id) DO UPDATE SET
    item_count = EXCLUDED.item_count,
    total_quantity = EXCLUDED.total_quantity,
    updated_at = NOW();

  -- =========================================================================
  -- UPDATE ORDER TYPE IF MIXED (has both pickup and shipping items)
  -- =========================================================================

  IF EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = p_order_id AND order_type = 'shipping'
  ) THEN
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
    oi.location_id AS result_location_id,
    l.name AS result_location_name,
    COUNT(*)::BIGINT AS result_item_count,
    COALESCE(oi.order_type, 'shipping')::TEXT AS result_fulfillment_type
  FROM order_items oi
  JOIN locations l ON l.id = oi.location_id
  WHERE oi.order_id = p_order_id
    AND oi.location_id IS NOT NULL
  GROUP BY oi.location_id, l.name, oi.order_type
  ORDER BY oi.order_type DESC;  -- pickup first, then shipping
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION route_order_to_locations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION route_order_to_locations(UUID) TO service_role;

-- Add comment
COMMENT ON FUNCTION route_order_to_locations(UUID) IS
'Smart order routing with single-location priority for shipping orders.
For shipping orders: tries to find ONE location that can fulfill ALL items first.
Only splits across locations if absolutely necessary (no single location has all items).
For pickup orders: routes to pickup location, ships items not in stock from other locations.';
