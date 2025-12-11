-- ============================================================================
-- FIND BEVERAGE PRODUCTS: Where are they actually located?
-- ============================================================================

-- 1. Show the Beverages category hierarchy
SELECT
  c.id,
  c.name,
  c.parent_id,
  pc.name as parent_name,
  CASE WHEN c.parent_id IS NULL THEN 'PARENT' ELSE 'SUBCATEGORY' END as type,
  (SELECT COUNT(*) FROM products p WHERE p.primary_category_id = c.id) as product_count,
  (SELECT COUNT(*) FROM pricing_tier_templates ptt WHERE ptt.category_id = c.id AND ptt.is_active = TRUE) as template_count
FROM categories c
LEFT JOIN categories pc ON pc.id = c.parent_id
WHERE c.name ILIKE '%beverage%'
   OR pc.name ILIKE '%beverage%'
   OR c.name ILIKE '%fizzy%'
   OR c.name ILIKE '%seltzer%'
   OR c.name ILIKE '%drink%'
   OR c.name ILIKE '%moonwater%'
ORDER BY c.parent_id NULLS FIRST, c.name;

-- 2. Find products that might be beverages by name
SELECT
  p.id,
  p.name as product_name,
  c.name as category_name,
  pc.name as parent_category_name,
  p.pricing_template_id,
  ptt.name as assigned_template
FROM products p
INNER JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE p.name ILIKE '%lemonade%'
   OR p.name ILIKE '%fizzy%'
   OR p.name ILIKE '%seltzer%'
   OR p.name ILIKE '%moonwater%'
   OR p.name ILIKE '%drink%'
   OR p.name ILIKE '%10mg%'
   OR p.name ILIKE '%beverage%'
ORDER BY p.name;

-- 3. Show all subcategories that have products but NO pricing template
-- These need templates assigned or products need to inherit from parent
SELECT
  pc.name as parent_category,
  c.name as subcategory,
  c.id as subcategory_id,
  COUNT(p.id) as product_count,
  (SELECT ptt.name FROM pricing_tier_templates ptt
   WHERE ptt.category_id = c.id AND ptt.is_active = TRUE LIMIT 1) as subcategory_template,
  (SELECT ptt.name FROM pricing_tier_templates ptt
   WHERE ptt.category_id = pc.id AND ptt.is_active = TRUE LIMIT 1) as parent_template
FROM categories c
INNER JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN products p ON p.primary_category_id = c.id
GROUP BY pc.name, c.name, c.id, pc.id
HAVING COUNT(p.id) > 0
ORDER BY pc.name, c.name;
