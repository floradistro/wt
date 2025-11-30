-- ============================================================================
-- FIX CATEGORY PRICING: Apply templates to all products in categories
-- ============================================================================
-- This script finds all categories with pricing templates and applies them
-- to their products so pricing shows up in POS
-- ============================================================================

DO $$
DECLARE
  template_rec RECORD;
  update_result RECORD;
BEGIN
  -- Find all active pricing templates with categories
  FOR template_rec IN
    SELECT
      id as template_id,
      category_id,
      vendor_id,
      name as template_name
    FROM pricing_tier_templates
    WHERE is_active = TRUE
      AND category_id IS NOT NULL
  LOOP
    RAISE NOTICE 'Applying template "%" to products in category %',
      template_rec.template_name, template_rec.category_id;

    -- Update all products in this category to use this template
    UPDATE products
    SET pricing_template_id = template_rec.template_id,
        updated_at = now()
    WHERE primary_category_id = template_rec.category_id
      AND vendor_id = template_rec.vendor_id
      AND (pricing_template_id IS NULL OR pricing_template_id != template_rec.template_id);

    RAISE NOTICE 'Updated % products', FOUND;
  END LOOP;

  RAISE NOTICE '✅ COMPLETE: All products updated with category pricing templates';
END $$;

-- Verify the fix
SELECT
  c.name as category_name,
  ptt.name as template_name,
  COUNT(p.id) as products_with_template
FROM categories c
LEFT JOIN pricing_tier_templates ptt ON ptt.category_id = c.id AND ptt.is_active = TRUE
LEFT JOIN products p ON p.primary_category_id = c.id AND p.pricing_template_id = ptt.id
GROUP BY c.name, ptt.name
ORDER BY c.name;
