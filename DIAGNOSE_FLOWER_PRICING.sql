-- ============================================================================
-- DIAGNOSE FLOWER PRICING: Why are flower products showing pre-roll pricing?
-- ============================================================================
-- Run these queries to identify the issue

-- 1. Show ALL flower products and their assigned pricing templates
SELECT
  p.id,
  p.name as product_name,
  c.name as category_name,
  p.pricing_template_id,
  ptt.name as assigned_template_name,
  ptt.default_tiers->0->>'label' as first_tier_label,
  ptt.default_tiers->0->>'default_price' as first_tier_price,
  CASE
    WHEN ptt.name ILIKE '%pre-roll%' OR ptt.name ILIKE '%preroll%' THEN '⚠️ PRE-ROLL TEMPLATE!'
    WHEN ptt.name ILIKE '%flower%' THEN '✅ Flower template'
    ELSE '❓ Other template'
  END as template_status
FROM products p
LEFT JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE c.name ILIKE '%flower%'
   OR p.name ILIKE '%flower%'
   OR (ptt.name ILIKE '%flower%' AND p.pricing_template_id IS NOT NULL)
ORDER BY p.name
LIMIT 50;

-- 2. Show ALL pricing templates - look for flower vs pre-roll templates
SELECT
  ptt.id as template_id,
  ptt.name as template_name,
  c.name as category_name,
  ptt.is_active,
  jsonb_array_length(ptt.default_tiers) as tier_count,
  ptt.default_tiers->0->>'label' as tier_1_label,
  ptt.default_tiers->0->>'default_price' as tier_1_price,
  ptt.default_tiers->1->>'label' as tier_2_label,
  ptt.default_tiers->1->>'default_price' as tier_2_price,
  ptt.updated_at
FROM pricing_tier_templates ptt
LEFT JOIN categories c ON c.id = ptt.category_id
WHERE ptt.name ILIKE '%flower%'
   OR ptt.name ILIKE '%pre-roll%'
   OR ptt.name ILIKE '%preroll%'
ORDER BY ptt.updated_at DESC, ptt.name;

-- 3. Check if any products were recently updated (last 24 hours)
-- This will show if the FIX scripts affected flower products
SELECT
  p.id,
  p.name as product_name,
  c.name as category_name,
  p.pricing_template_id,
  ptt.name as template_name,
  p.updated_at
FROM products p
LEFT JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE p.updated_at > now() - interval '24 hours'
ORDER BY p.updated_at DESC
LIMIT 50;

-- 4. Show category variant templates for Flower category
-- This shows if Pre-Roll is configured as a variant
SELECT
  c.name as category_name,
  cvt.name as variant_name,
  cvt.pricing_template_id as variant_pricing_template_id,
  ptt.name as variant_uses_template,
  ptt.default_tiers->0->>'label' as tier_1_label,
  ptt.default_tiers->0->>'default_price' as tier_1_price
FROM category_variant_templates cvt
LEFT JOIN categories c ON c.id = cvt.category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = cvt.pricing_template_id
WHERE c.name ILIKE '%flower%'
ORDER BY c.name, cvt.display_order;

-- 5. Compare the Flower template vs Pre-Roll template tiers
-- This will show if they're different or the same
SELECT
  'FLOWER TEMPLATE' as template_type,
  ptt.id,
  ptt.name,
  ptt.default_tiers
FROM pricing_tier_templates ptt
WHERE ptt.name ILIKE '%flower%' AND ptt.is_active = true
UNION ALL
SELECT
  'PRE-ROLL TEMPLATE' as template_type,
  ptt.id,
  ptt.name,
  ptt.default_tiers
FROM pricing_tier_templates ptt
WHERE (ptt.name ILIKE '%pre-roll%' OR ptt.name ILIKE '%preroll%') AND ptt.is_active = true;

-- 6. Find the Flower category and its templates
SELECT
  c.id as category_id,
  c.name as category_name,
  c.parent_id,
  pc.name as parent_name,
  ptt.id as template_id,
  ptt.name as template_name,
  ptt.is_active
FROM categories c
LEFT JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN pricing_tier_templates ptt ON ptt.category_id = c.id
WHERE c.name ILIKE '%flower%'
ORDER BY c.name, ptt.name;
