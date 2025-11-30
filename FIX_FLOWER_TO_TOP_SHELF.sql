-- ============================================================================
-- FIX: Assign all flower products to Top Shelf pricing template
-- ============================================================================
-- This fixes the issue where flower products got assigned Pre Roll template
-- ============================================================================

DO $$
DECLARE
  v_top_shelf_template_id UUID;
  v_flower_category_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Get the Top Shelf template ID
  SELECT id INTO v_top_shelf_template_id
  FROM pricing_tier_templates
  WHERE name = 'Top Shelf'
    AND is_active = TRUE
  LIMIT 1;

  -- Get the Flower category ID
  SELECT id INTO v_flower_category_id
  FROM categories
  WHERE name = 'Flower'
  LIMIT 1;

  IF v_top_shelf_template_id IS NULL THEN
    RAISE EXCEPTION 'Top Shelf pricing template not found!';
  END IF;

  IF v_flower_category_id IS NULL THEN
    RAISE EXCEPTION 'Flower category not found!';
  END IF;

  RAISE NOTICE 'Top Shelf template ID: %', v_top_shelf_template_id;
  RAISE NOTICE 'Flower category ID: %', v_flower_category_id;

  -- Update all flower products to use Top Shelf template
  -- Exclude Pre Roll products (they have their own template)
  UPDATE products
  SET pricing_template_id = v_top_shelf_template_id,
      updated_at = now()
  WHERE primary_category_id = v_flower_category_id
    AND (name NOT ILIKE '%Pre Roll%' AND name NOT ILIKE '%Pre-Roll%')
    AND (pricing_template_id IS NULL OR pricing_template_id != v_top_shelf_template_id);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RAISE NOTICE '✅ Updated % flower products to Top Shelf pricing', v_updated_count;
END $$;

-- Verify the fix
SELECT
  p.name,
  ptt.name as template_name,
  ptt.default_tiers->0->>'label' as first_tier
FROM products p
LEFT JOIN pricing_tier_templates ptt ON ptt.id = p.pricing_template_id
LEFT JOIN categories c ON c.id = p.primary_category_id
WHERE c.name = 'Flower'
  AND p.name NOT ILIKE '%Pre Roll%'
ORDER BY p.name
LIMIT 20;
