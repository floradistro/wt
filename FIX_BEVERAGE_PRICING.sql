-- ============================================================================
-- FIX BEVERAGE PRICING: Assign parent templates to subcategory products
-- ============================================================================
-- Products are in subcategories (Darkside 30mg, Day Drinker 5mg, etc.)
-- But templates are on the parent Beverages category
-- This script matches by dosage in the subcategory name
-- ============================================================================

-- First, show what we're about to fix
SELECT
  c.name as subcategory,
  p.name as product_name,
  p.pricing_template_id as current_template,
  CASE
    WHEN c.name ILIKE '%5mg%' THEN 'Moonwater 5mg'
    WHEN c.name ILIKE '%10mg%' THEN 'MOONWATER 10MG'
    WHEN c.name ILIKE '%30mg%' THEN 'MOONWATER 30MG'
    WHEN c.name ILIKE '%60mg%' THEN 'MOONWATER 60MG'
  END as should_use_template
FROM products p
INNER JOIN categories c ON c.id = p.primary_category_id
INNER JOIN categories pc ON pc.id = c.parent_id
WHERE pc.name = 'Beverages'
ORDER BY c.name, p.name;

-- Apply the fix: Match subcategory dosage to template name
DO $$
DECLARE
  v_beverages_id UUID;
  v_vendor_id UUID;
  v_template_id UUID;
  v_update_count INTEGER;
  v_total INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixing Beverage Subcategory Pricing';
  RAISE NOTICE '========================================';

  -- Get the Beverages parent category ID and vendor
  SELECT id, vendor_id INTO v_beverages_id, v_vendor_id
  FROM categories
  WHERE name = 'Beverages' AND parent_id IS NULL
  LIMIT 1;

  IF v_beverages_id IS NULL THEN
    RAISE NOTICE '❌ Beverages category not found!';
    RETURN;
  END IF;

  RAISE NOTICE 'Found Beverages category: %', v_beverages_id;

  -- Fix 5mg products (Day Drinker)
  SELECT id INTO v_template_id
  FROM pricing_tier_templates
  WHERE category_id = v_beverages_id
    AND name ILIKE '%5mg%'
    AND is_active = TRUE
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    UPDATE products p
    SET pricing_template_id = v_template_id, updated_at = now()
    FROM categories c
    WHERE p.primary_category_id = c.id
      AND c.parent_id = v_beverages_id
      AND c.name ILIKE '%5mg%'
      AND (p.pricing_template_id IS NULL OR p.pricing_template_id != v_template_id);

    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE '✅ 5mg products: Updated % products', v_update_count;
    v_total := v_total + v_update_count;
  END IF;

  -- Fix 10mg products (Golden Hour)
  SELECT id INTO v_template_id
  FROM pricing_tier_templates
  WHERE category_id = v_beverages_id
    AND name ILIKE '%10mg%'
    AND is_active = TRUE
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    UPDATE products p
    SET pricing_template_id = v_template_id, updated_at = now()
    FROM categories c
    WHERE p.primary_category_id = c.id
      AND c.parent_id = v_beverages_id
      AND c.name ILIKE '%10mg%'
      AND (p.pricing_template_id IS NULL OR p.pricing_template_id != v_template_id);

    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE '✅ 10mg products: Updated % products', v_update_count;
    v_total := v_total + v_update_count;
  END IF;

  -- Fix 30mg products (Darkside)
  SELECT id INTO v_template_id
  FROM pricing_tier_templates
  WHERE category_id = v_beverages_id
    AND name ILIKE '%30mg%'
    AND is_active = TRUE
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    UPDATE products p
    SET pricing_template_id = v_template_id, updated_at = now()
    FROM categories c
    WHERE p.primary_category_id = c.id
      AND c.parent_id = v_beverages_id
      AND c.name ILIKE '%30mg%'
      AND (p.pricing_template_id IS NULL OR p.pricing_template_id != v_template_id);

    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE '✅ 30mg products: Updated % products', v_update_count;
    v_total := v_total + v_update_count;
  END IF;

  -- Fix 60mg products (Riptide)
  SELECT id INTO v_template_id
  FROM pricing_tier_templates
  WHERE category_id = v_beverages_id
    AND name ILIKE '%60mg%'
    AND is_active = TRUE
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    UPDATE products p
    SET pricing_template_id = v_template_id, updated_at = now()
    FROM categories c
    WHERE p.primary_category_id = c.id
      AND c.parent_id = v_beverages_id
      AND c.name ILIKE '%60mg%'
      AND (p.pricing_template_id IS NULL OR p.pricing_template_id != v_template_id);

    GET DIAGNOSTICS v_update_count = ROW_COUNT;
    RAISE NOTICE '✅ 60mg products: Updated % products', v_update_count;
    v_total := v_total + v_update_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPLETE: Updated % total beverage products', v_total;
  RAISE NOTICE '========================================';
END $$;

-- Verify the fix
SELECT
  c.name as subcategory,
  COUNT(p.id) as product_count,
  ptt.name as assigned_template
FROM products p
INNER JOIN categories c ON c.id = p.primary_category_id
INNER JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
WHERE pc.name = 'Beverages'
GROUP BY c.name, ptt.name
ORDER BY c.name;
