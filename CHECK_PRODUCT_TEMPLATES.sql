-- ============================================================================
-- CHECK PRODUCT TEMPLATES: See which products already have templates set
-- ============================================================================

-- Check Beverages products
SELECT
  p.name as product_name,
  p.pricing_template_id,
  ptt.name as template_name,
  p.meta_data->'pricing_tiers' as legacy_pricing_tiers,
  p.pricing_data as legacy_pricing_data
FROM products p
LEFT JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE c.name = 'Beverages'
LIMIT 20;

-- Check Vapes products
SELECT
  p.name as product_name,
  p.pricing_template_id,
  ptt.name as template_name,
  p.meta_data->'pricing_tiers' as legacy_pricing_tiers,
  p.pricing_data as legacy_pricing_data
FROM products p
LEFT JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE c.name = 'Vape'
LIMIT 20;

-- Check Concentrates products
SELECT
  p.name as product_name,
  p.pricing_template_id,
  ptt.name as template_name,
  p.meta_data->'pricing_tiers' as legacy_pricing_tiers,
  p.pricing_data as legacy_pricing_data
FROM products p
LEFT JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE c.name = 'Concentrates'
LIMIT 20;
