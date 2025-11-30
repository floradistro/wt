-- ============================================================================
-- DIAGNOSE PRICING: Find products without pricing templates
-- ============================================================================

-- 1. Show products WITHOUT pricing templates grouped by category
SELECT
  c.name as category_name,
  COUNT(p.id) as products_without_pricing,
  array_agg(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL) as sample_products
FROM products p
LEFT JOIN categories c ON c.id = p.primary_category_id
WHERE p.pricing_template_id IS NULL
  AND p.primary_category_id IS NOT NULL
GROUP BY c.name
ORDER BY products_without_pricing DESC;

-- 2. Show all active pricing templates and their category
SELECT
  ptt.name as template_name,
  c.name as category_name,
  ptt.category_id,
  ptt.vendor_id,
  jsonb_array_length(ptt.default_tiers) as tier_count,
  ptt.default_tiers->0 as first_tier
FROM pricing_tier_templates ptt
LEFT JOIN categories c ON c.id = ptt.category_id
WHERE ptt.is_active = TRUE
ORDER BY c.name, ptt.name;

-- 3. Check if products have vendor_id matching templates
SELECT
  'Products missing vendor_id' as issue,
  COUNT(*) as count
FROM products
WHERE vendor_id IS NULL;

-- 4. Show beverages specifically (since they all show 0)
SELECT
  p.name as product_name,
  p.pricing_template_id,
  p.vendor_id,
  c.name as category_name
FROM products p
LEFT JOIN categories c ON c.id = p.primary_category_id
WHERE c.name = 'Beverages'
LIMIT 10;
