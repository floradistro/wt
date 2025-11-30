-- Check Animal Mintz product pricing
SELECT
  p.name as product_name,
  p.pricing_template_id,
  ptt.name as template_name,
  ptt.default_tiers as product_tiers,
  p.pricing_data as legacy_pricing_data,
  p.meta_data->'pricing_tiers' as legacy_meta_pricing
FROM products p
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE p.name = 'Animal Mintz';

-- Check variants
SELECT
  pv.variant_name,
  pv.pricing_template_id as variant_template_id,
  ptt.name as variant_template_name,
  ptt.default_tiers as variant_tiers
FROM product_variants pv
LEFT JOIN pricing_tier_templates ptt ON ptt.id = pv.pricing_template_id
WHERE pv.product_id = (SELECT id FROM products WHERE name = 'Animal Mintz' LIMIT 1);
