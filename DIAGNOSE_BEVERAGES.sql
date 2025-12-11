-- ============================================================================
-- DIAGNOSE BEVERAGES: Check beverage products and their pricing
-- ============================================================================

-- 1. Show ALL beverage products with their pricing template status
SELECT
  p.id,
  p.name as product_name,
  c.name as category_name,
  p.pricing_template_id,
  ptt.name as assigned_template_name,
  CASE
    WHEN p.pricing_template_id IS NOT NULL THEN '✅ Has Template'
    ELSE '❌ Missing Template'
  END as status
FROM products p
INNER JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE c.name ILIKE '%beverage%'
ORDER BY p.name;

-- 2. Show all available templates for Beverages category
SELECT
  ptt.id as template_id,
  ptt.name as template_name,
  c.name as category_name,
  jsonb_array_length(ptt.default_tiers) as tier_count,
  ptt.default_tiers->0->>'label' as first_tier_label,
  ptt.default_tiers->0->>'default_price' as first_tier_price
FROM pricing_tier_templates ptt
INNER JOIN categories c ON c.id = ptt.category_id
WHERE c.name ILIKE '%beverage%'
  AND ptt.is_active = TRUE
ORDER BY ptt.display_order, ptt.name;

-- 3. Count summary
SELECT
  c.name as category_name,
  COUNT(p.id) as total_products,
  COUNT(p.pricing_template_id) as products_with_template,
  COUNT(*) - COUNT(p.pricing_template_id) as products_missing_template
FROM categories c
LEFT JOIN products p ON p.primary_category_id = c.id
WHERE c.name ILIKE '%beverage%'
GROUP BY c.name;
