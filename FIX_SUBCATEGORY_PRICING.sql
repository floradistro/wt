-- ============================================================================
-- FIX SUBCATEGORY PRICING: Apply templates to products in subcategories
-- ============================================================================
-- This script fixes the issue where:
-- - Pricing templates are assigned to SUBCATEGORIES (e.g., "Fizzy", "Seltzers")
-- - Products have primary_category_id pointing to either parent OR subcategory
-- - Products in subcategories are NOT getting their pricing template
--
-- Solution: Find products in categories that have pricing templates and assign them
-- ============================================================================

-- First, let's diagnose the issue - show products without pricing templates
-- that are in categories (parent or child) that HAVE templates
SELECT
  p.id as product_id,
  p.name as product_name,
  p.pricing_template_id as current_template,
  c.name as category_name,
  c.parent_id,
  CASE WHEN c.parent_id IS NOT NULL THEN 'Subcategory' ELSE 'Parent' END as category_type,
  ptt.id as available_template_id,
  ptt.name as template_name
FROM products p
INNER JOIN categories c ON c.id = p.primary_category_id
LEFT JOIN pricing_tier_templates ptt ON ptt.category_id = c.id AND ptt.is_active = TRUE
WHERE ptt.id IS NOT NULL  -- Category has a template
  AND (p.pricing_template_id IS NULL OR p.pricing_template_id != ptt.id)  -- But product doesn't have it
ORDER BY c.name, p.name
LIMIT 20;

-- Apply the fix: Set pricing_template_id for products in categories with templates
DO $$
DECLARE
  template_rec RECORD;
  update_count INTEGER;
  total_updated INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixing Category Pricing Templates';
  RAISE NOTICE '========================================';

  -- For each category with a pricing template (both parents and subcategories)
  FOR template_rec IN
    SELECT
      c.id as category_id,
      c.name as category_name,
      c.parent_id,
      pc.name as parent_name,
      ptt.id as template_id,
      ptt.name as template_name,
      ptt.vendor_id
    FROM categories c
    LEFT JOIN categories pc ON pc.id = c.parent_id
    INNER JOIN pricing_tier_templates ptt ON ptt.category_id = c.id AND ptt.is_active = TRUE
    ORDER BY COALESCE(pc.name, c.name), c.name
  LOOP
    IF template_rec.parent_id IS NOT NULL THEN
      RAISE NOTICE '';
      RAISE NOTICE 'Processing Subcategory: % > % (template: %)',
        template_rec.parent_name,
        template_rec.category_name,
        template_rec.template_name;
    ELSE
      RAISE NOTICE '';
      RAISE NOTICE 'Processing Parent Category: % (template: %)',
        template_rec.category_name,
        template_rec.template_name;
    END IF;

    -- Update products in this category that don't have the template
    UPDATE products
    SET
      pricing_template_id = template_rec.template_id,
      updated_at = now()
    WHERE
      primary_category_id = template_rec.category_id
      AND vendor_id = template_rec.vendor_id
      AND (pricing_template_id IS NULL OR pricing_template_id != template_rec.template_id);

    GET DIAGNOSTICS update_count = ROW_COUNT;
    IF update_count > 0 THEN
      RAISE NOTICE '  -> Updated % products', update_count;
      total_updated := total_updated + update_count;
    ELSE
      RAISE NOTICE '  -> No products needed updating';
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COMPLETE: Updated % total products', total_updated;
  RAISE NOTICE '========================================';
END $$;

-- Verify the fix - show all categories with templates and product counts
SELECT
  COALESCE(pc.name, '(Parent)') as parent_category,
  c.name as category_name,
  ptt.name as template_name,
  COUNT(p.id) as products_with_template,
  COUNT(CASE WHEN p.pricing_template_id IS NULL THEN 1 END) as products_missing_template
FROM categories c
LEFT JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN pricing_tier_templates ptt ON ptt.category_id = c.id AND ptt.is_active = TRUE
LEFT JOIN products p ON p.primary_category_id = c.id
WHERE ptt.id IS NOT NULL  -- Only categories with templates
GROUP BY pc.name, c.name, ptt.name
ORDER BY pc.name NULLS FIRST, c.name;
