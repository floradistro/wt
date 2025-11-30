-- Check a specific product that has variants to see its pricing template
-- Replace 'Product Name' with the actual product name showing the issue

SELECT
  p.name as product_name,
  p.pricing_template_id as product_template_id,
  ptt.name as product_template_name,
  ptt.default_tiers as product_tiers
FROM products p
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE p.name ILIKE '%Runtz%'  -- Change this to match your product
LIMIT 5;

-- Check the variants for this product
SELECT
  pv.variant_name,
  pv.pricing_template_id as variant_template_id,
  ptt.name as variant_template_name,
  ptt.default_tiers->0 as first_tier
FROM product_variants pv
LEFT JOIN pricing_tier_templates ptt ON ptt.id = pv.pricing_template_id
WHERE pv.product_id IN (
  SELECT id FROM products WHERE name ILIKE '%Runtz%' LIMIT 1
);
