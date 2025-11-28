CREATE OR REPLACE FUNCTION find_tier_for_order_item(
  p_product_id UUID,
  p_unit_price NUMERIC
)
RETURNS TABLE (
  tier_name TEXT,
  tier_quantity NUMERIC,
  tier_price NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tier->>'name' AS tier_name,
    (tier->>'quantity')::NUMERIC AS tier_quantity,
    (tier->>'price')::NUMERIC AS tier_price
  FROM products,
       jsonb_array_elements(pricing_data->'tiers') AS tier
  WHERE products.id = p_product_id
    AND (tier->>'price')::NUMERIC = p_unit_price
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

UPDATE order_items oi
SET
  tier_name = tier.tier_name,
  quantity_grams = tier.tier_quantity * oi.quantity,
  quantity_display = tier.tier_name
FROM (
  SELECT
    oi2.id,
    (find_tier_for_order_item(oi2.product_id, oi2.unit_price)).*
  FROM order_items oi2
  WHERE oi2.tier_name IS NULL
    AND oi2.product_id IS NOT NULL
    AND oi2.unit_price IS NOT NULL
) AS tier
WHERE oi.id = tier.id
  AND tier.tier_name IS NOT NULL;

UPDATE order_items
SET
  quantity_display = CASE
    WHEN quantity = 1 THEN '1 unit'
    ELSE quantity::TEXT || ' units'
  END,
  quantity_grams = quantity
WHERE tier_name IS NULL
  AND quantity_display IS NULL;

DO $$
DECLARE
  updated_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM order_items;
  SELECT COUNT(*) INTO updated_count FROM order_items WHERE tier_name IS NOT NULL;
  RAISE NOTICE 'Backfill complete: % of % order_items now have tier data', updated_count, total_count;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_tier_name ON order_items(tier_name) WHERE tier_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_product_price ON order_items(product_id, unit_price) WHERE tier_name IS NULL;

COMMENT ON FUNCTION find_tier_for_order_item IS 'Finds the matching pricing tier for an order item based on unit price';
