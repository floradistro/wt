-- ============================================================================
-- CATEGORY VARIANT TEMPLATES (Apple-Style Zero Redundancy)
-- ============================================================================
-- Follows the existing pattern:
--   - pricing_tier_templates (category → pricing)
--   - vendor_product_fields (category → fields)
--   - category_variant_templates (category → variants) ← NEW
--
-- Design Philosophy:
-- 1. Define variant types at CATEGORY level (e.g., "All Flower → Pre-Roll")
-- 2. Products OPT-IN to variants (like pricing tiers)
-- 3. Each variant can have INDEPENDENT pricing structure
-- 4. Zero redundancy - configure once, reuse everywhere
-- ============================================================================

-- ============================================================================
-- 1. CATEGORY VARIANT TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_variant_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What category is this variant for?
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Variant definition
  variant_name TEXT NOT NULL, -- "Pre-Roll", "Edible", "Individual Piece", etc.
  variant_slug TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Emoji or icon name

  -- Conversion ratio (how much parent inventory needed)
  conversion_ratio NUMERIC(10,4) NOT NULL DEFAULT 1.0 CHECK (conversion_ratio > 0),
  conversion_unit TEXT, -- "g", "oz", "unit", "piece", etc.

  -- Pricing (can reference different pricing tier template)
  pricing_template_id UUID REFERENCES pricing_tier_templates(id) ON DELETE SET NULL,

  -- Behavior
  share_parent_inventory BOOLEAN DEFAULT true,
  track_separate_inventory BOOLEAN DEFAULT false,
  allow_on_demand_conversion BOOLEAN DEFAULT true,

  -- Display
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Additional config
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES auth.users(id),

  -- Uniqueness: one variant name per category per vendor
  UNIQUE(vendor_id, category_id, variant_slug)
);

-- Indexes
CREATE INDEX idx_variant_templates_category ON category_variant_templates(category_id);
CREATE INDEX idx_variant_templates_vendor ON category_variant_templates(vendor_id);
CREATE INDEX idx_variant_templates_active ON category_variant_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_variant_templates_pricing ON category_variant_templates(pricing_template_id);

-- RLS
ALTER TABLE category_variant_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active variant templates"
  ON category_variant_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Vendors can manage own variant templates"
  ON category_variant_templates FOR ALL
  USING (vendor_id IN (
    SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
  ))
  WITH CHECK (vendor_id IN (
    SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Service role full access"
  ON category_variant_templates FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON category_variant_templates TO authenticated;
GRANT ALL ON category_variant_templates TO service_role;

-- Trigger
CREATE TRIGGER set_variant_templates_updated_at
  BEFORE UPDATE ON category_variant_templates
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

COMMENT ON TABLE category_variant_templates IS
'Category-level variant templates (Apple-style). Define once at category level,
products opt-in. Example: "Flower" category → "Pre-Roll" variant with 0.7g conversion.
Each variant can have independent pricing structure via pricing_template_id.';

-- ============================================================================
-- 2. PRODUCT VARIANT CONFIGURATIONS (Opt-In)
-- ============================================================================
-- Products enable/disable variants and can override category defaults

CREATE TABLE IF NOT EXISTS product_variant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What product + variant?
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_template_id UUID NOT NULL REFERENCES category_variant_templates(id) ON DELETE CASCADE,

  -- Is this variant enabled for this product?
  is_enabled BOOLEAN DEFAULT true,

  -- Overrides (optional - null means use template default)
  custom_conversion_ratio NUMERIC(10,4) CHECK (custom_conversion_ratio IS NULL OR custom_conversion_ratio > 0),
  custom_pricing_template_id UUID REFERENCES pricing_tier_templates(id) ON DELETE SET NULL,

  -- Behavior overrides
  override_share_parent_inventory BOOLEAN,
  override_track_separate_inventory BOOLEAN,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One config per product per variant
  UNIQUE(product_id, variant_template_id)
);

-- Indexes
CREATE INDEX idx_product_variant_configs_product ON product_variant_configs(product_id);
CREATE INDEX idx_product_variant_configs_template ON product_variant_configs(variant_template_id);
CREATE INDEX idx_product_variant_configs_enabled ON product_variant_configs(is_enabled) WHERE is_enabled = true;

-- RLS
ALTER TABLE product_variant_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view enabled variant configs"
  ON product_variant_configs FOR SELECT
  USING (is_enabled = true);

CREATE POLICY "Service role full access to variant configs"
  ON product_variant_configs FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON product_variant_configs TO authenticated;
GRANT ALL ON product_variant_configs TO service_role;

-- Trigger
CREATE TRIGGER set_product_variant_configs_updated_at
  BEFORE UPDATE ON product_variant_configs
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

COMMENT ON TABLE product_variant_configs IS
'Product-level variant opt-in/configuration. Products enable variants from their
category templates and can override defaults (conversion ratio, pricing, etc.).';

-- ============================================================================
-- 3. HELPER VIEW: Product Variants (Flattened)
-- ============================================================================
-- Makes it easy to query all available variants for a product

CREATE OR REPLACE VIEW v_product_variants AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.primary_category_id,

  cvt.id AS variant_template_id,
  cvt.variant_name,
  cvt.variant_slug,
  cvt.icon AS variant_icon,

  -- Use custom conversion or fall back to template
  COALESCE(pvc.custom_conversion_ratio, cvt.conversion_ratio) AS conversion_ratio,
  cvt.conversion_unit,

  -- Use custom pricing or fall back to template
  COALESCE(pvc.custom_pricing_template_id, cvt.pricing_template_id) AS pricing_template_id,

  -- Behavior
  COALESCE(pvc.override_share_parent_inventory, cvt.share_parent_inventory) AS share_parent_inventory,
  COALESCE(pvc.override_track_separate_inventory, cvt.track_separate_inventory) AS track_separate_inventory,
  cvt.allow_on_demand_conversion,

  -- Status
  pvc.is_enabled,

  -- Metadata
  cvt.metadata AS template_metadata,
  pvc.metadata AS product_metadata

FROM products p
INNER JOIN categories c ON p.primary_category_id = c.id
INNER JOIN category_variant_templates cvt ON cvt.category_id = c.id
LEFT JOIN product_variant_configs pvc ON pvc.product_id = p.id AND pvc.variant_template_id = cvt.id
WHERE cvt.is_active = true
  AND (pvc.is_enabled = true OR pvc.is_enabled IS NULL); -- Show enabled or not configured

COMMENT ON VIEW v_product_variants IS
'Flattened view of all available variants for products. Combines category templates
with product-specific overrides. Use this for POS/UI to show sellable variants.';

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON v_product_variants TO authenticated;
GRANT SELECT ON v_product_variants TO anon;

-- ============================================================================
-- 5. SAMPLE DATA (For Testing)
-- ============================================================================

-- Example: Add "Pre-Roll" variant template for Flower category
-- (You'll do this via UI, but here's an example)

/*
INSERT INTO category_variant_templates (
  category_id,
  vendor_id,
  variant_name,
  variant_slug,
  description,
  icon,
  conversion_ratio,
  conversion_unit,
  share_parent_inventory,
  track_separate_inventory,
  allow_on_demand_conversion
)
SELECT
  c.id,
  c.vendor_id,
  'Pre-Roll',
  'pre-roll',
  'Individual pre-rolled joints made from flower',
  '🚬',
  0.7, -- 1 pre-roll uses 0.7g flower
  'g',
  true,  -- Share parent inventory
  true,  -- Can also track separate inventory if pre-manufactured
  true   -- Allow on-demand conversion
FROM categories c
WHERE c.slug = 'flower'
  AND c.vendor_id = 'YOUR_VENDOR_ID'
ON CONFLICT (vendor_id, category_id, variant_slug) DO NOTHING;
*/

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'CATEGORY VARIANT TEMPLATES';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ category_variant_templates created';
  RAISE NOTICE '✅ product_variant_configs created';
  RAISE NOTICE '✅ v_product_variants view created';
  RAISE NOTICE '✅ Follows pricing_tier_templates pattern';
  RAISE NOTICE '✅ Zero redundancy design';
  RAISE NOTICE '================================';
END $$;
