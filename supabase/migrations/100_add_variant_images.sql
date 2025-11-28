-- ============================================================================
-- ADD IMAGE SUPPORT FOR VARIANTS (Two Types)
-- ============================================================================
-- Supports TWO use cases:
-- 1. Full variant image (standalone product view)
-- 2. Indicator/badge icon (overlay on parent product cards)
--
-- Example:
--   User toggles "Pre-Roll" filter → Product cards show flower image
--   with small pre-roll badge in bottom-right corner
-- ============================================================================

-- ============================================================================
-- 1. ADD IMAGE FIELDS TO CATEGORY VARIANT TEMPLATES
-- ============================================================================

ALTER TABLE category_variant_templates
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS indicator_icon_url TEXT;

COMMENT ON COLUMN category_variant_templates.featured_image_url IS
'Full variant product image (e.g., pre-roll package photo).
Used when displaying variant as standalone product.
Example: Generic pre-roll package image for all flower pre-rolls.';

COMMENT ON COLUMN category_variant_templates.thumbnail_url IS
'Thumbnail version of featured_image_url for list views.';

COMMENT ON COLUMN category_variant_templates.indicator_icon_url IS
'Small badge/icon for overlaying on parent product cards (e.g., small pre-roll icon).
Used when user filters by variant type - shows parent product with variant indicator.
Example: 48x48px pre-roll icon for bottom-right corner of flower cards.';

-- ============================================================================
-- 2. ADD IMAGE OVERRIDE FIELDS TO PRODUCT VARIANT CONFIGS
-- ============================================================================

ALTER TABLE product_variant_configs
  ADD COLUMN IF NOT EXISTS custom_featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_indicator_icon_url TEXT;

COMMENT ON COLUMN product_variant_configs.custom_featured_image_url IS
'Product-specific variant image (e.g., branded pre-roll package for this strain).
Overrides category_variant_templates.featured_image_url if set.';

COMMENT ON COLUMN product_variant_configs.custom_thumbnail_url IS
'Thumbnail version of custom_featured_image_url.';

COMMENT ON COLUMN product_variant_configs.custom_indicator_icon_url IS
'Product-specific badge/icon for overlaying on this product card.
Overrides category_variant_templates.indicator_icon_url if set.
Example: Branded pre-roll badge for premium strains.';

-- ============================================================================
-- 3. UPDATE v_product_variants VIEW TO INCLUDE ALL IMAGE TYPES
-- ============================================================================

DROP VIEW IF EXISTS v_product_variants CASCADE;

CREATE VIEW v_product_variants AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.primary_category_id,
  p.featured_image AS parent_product_image,

  cvt.id AS variant_template_id,
  cvt.variant_name,
  cvt.variant_slug,
  cvt.icon AS variant_icon,

  -- Use custom conversion or fall back to template
  COALESCE(pvc.custom_conversion_ratio, cvt.conversion_ratio) AS conversion_ratio,
  cvt.conversion_unit,

  -- Use custom pricing or fall back to template
  COALESCE(pvc.custom_pricing_template_id, cvt.pricing_template_id) AS pricing_template_id,

  -- FEATURED IMAGE (for standalone variant product view)
  -- Priority: product custom → template default → parent product image
  COALESCE(
    pvc.custom_featured_image_url,
    cvt.featured_image_url,
    p.featured_image
  ) AS featured_image_url,

  -- THUMBNAIL (for list views)
  COALESCE(
    pvc.custom_thumbnail_url,
    cvt.thumbnail_url
  ) AS thumbnail_url,

  -- INDICATOR ICON (for badge overlay on parent product cards)
  -- Priority: product custom → template default
  COALESCE(
    pvc.custom_indicator_icon_url,
    cvt.indicator_icon_url
  ) AS indicator_icon_url,

  -- Behavior
  COALESCE(pvc.override_share_parent_inventory, cvt.share_parent_inventory) AS share_parent_inventory,
  COALESCE(pvc.override_track_separate_inventory, cvt.track_separate_inventory) AS track_separate_inventory,
  cvt.allow_on_demand_conversion,

  -- Status
  COALESCE(pvc.is_enabled, true) AS is_enabled,

  -- Display
  cvt.display_order,

  -- Metadata
  cvt.metadata AS template_metadata,
  pvc.metadata AS product_metadata

FROM products p
INNER JOIN categories c ON p.primary_category_id = c.id
INNER JOIN category_variant_templates cvt ON cvt.category_id = c.id
LEFT JOIN product_variant_configs pvc ON pvc.product_id = p.id AND pvc.variant_template_id = cvt.id
WHERE cvt.is_active = true
  AND (pvc.is_enabled = true OR pvc.is_enabled IS NULL);

COMMENT ON VIEW v_product_variants IS
'Flattened view of all available variants with image support.

Image Types:
1. featured_image_url - Full variant product image (standalone view)
2. indicator_icon_url - Small badge for overlaying on parent cards (filter mode)

UI Usage:
- Filter mode (user selects "Pre-Roll"): Show parent_product_image + indicator_icon_url overlay
- Standalone mode: Show featured_image_url
- List views: Use thumbnail_url';

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON v_product_variants TO authenticated;
GRANT SELECT ON v_product_variants TO anon;

-- ============================================================================
-- 5. EXAMPLE USAGE
-- ============================================================================

/*
-- ============================================================================
-- SETUP: Category Template (All Flower Pre-Rolls)
-- ============================================================================

UPDATE category_variant_templates
SET
  -- Full product image (for standalone view)
  featured_image_url = 'https://cdn.vendor.com/images/generic-preroll-package.jpg',
  thumbnail_url = 'https://cdn.vendor.com/images/generic-preroll-thumb.jpg',

  -- Small badge/icon (for overlay on flower product cards)
  indicator_icon_url = 'https://cdn.vendor.com/images/preroll-badge-48x48.png'
WHERE variant_slug = 'pre-roll';

-- ============================================================================
-- OVERRIDE: Product-Specific (Branded Pre-Roll for Premium Strain)
-- ============================================================================

UPDATE product_variant_configs
SET
  -- Custom branded package image
  custom_featured_image_url = 'https://cdn.vendor.com/images/lemon-cherry-preroll-branded.jpg',

  -- Custom gold badge for premium strains
  custom_indicator_icon_url = 'https://cdn.vendor.com/images/premium-preroll-badge-gold.png'
WHERE product_id = 'LEMON_CHERRY_PRODUCT_ID'
  AND variant_template_id = 'PREROLL_TEMPLATE_ID';

-- ============================================================================
-- UI USAGE EXAMPLE
-- ============================================================================

-- When user toggles "Pre-Roll" filter in product list:
SELECT
  product_id,
  product_name,
  parent_product_image,      -- Show this as main image
  indicator_icon_url          -- Overlay this in bottom-right corner
FROM v_product_variants
WHERE variant_slug = 'pre-roll'
  AND is_enabled = true;

-- Result:
--   [Flower Product Card]
--   +-------------------------+
--   |                         |
--   | [Lemon Cherry Flower]   |  ← parent_product_image
--   |                         |
--   |                    [🚬] |  ← indicator_icon_url overlay
--   +-------------------------+
--   Lemon Cherry Runtz - Pre-Roll

-- When showing variant as standalone product:
SELECT
  product_id,
  product_name,
  featured_image_url,         -- Show this as main image
  thumbnail_url               -- For list view
FROM v_product_variants
WHERE variant_slug = 'pre-roll'
  AND product_id = 'LEMON_CHERRY_PRODUCT_ID';

*/

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'VARIANT IMAGE SUPPORT';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ featured_image_url (full product image)';
  RAISE NOTICE '✅ indicator_icon_url (badge overlay)';
  RAISE NOTICE '✅ thumbnail_url (list views)';
  RAISE NOTICE '✅ Product-level overrides supported';
  RAISE NOTICE '✅ v_product_variants updated';
  RAISE NOTICE '================================';
  RAISE NOTICE '';
  RAISE NOTICE 'USE CASES:';
  RAISE NOTICE '1. Filter mode: parent_product_image + indicator_icon_url overlay';
  RAISE NOTICE '2. Standalone: featured_image_url';
  RAISE NOTICE '================================';
END $$;
