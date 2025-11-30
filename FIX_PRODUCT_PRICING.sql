-- Find products that are incorrectly assigned Pre Roll template
SELECT
  p.name,
  p.pricing_template_id,
  ptt.name as template_name,
  ptt.default_tiers->0->>'label' as first_tier_label
FROM products p
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE ptt.name ILIKE '%Pre Roll%'
  AND p.name NOT ILIKE '%Pre Roll%'
LIMIT 20;
