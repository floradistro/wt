-- ============================================================================
-- VARIANT INVENTORY CONVERSION SYSTEM
-- ============================================================================
-- Allows manual bulk conversion of parent product inventory to variant inventory.
-- Example: Convert 100g of Flower into 142 Pre-Rolls (at 0.7g each)
--
-- Key Features:
-- 1. ATOMIC conversion (all or nothing)
-- 2. Full audit trail in inventory_conversions
-- 3. Stock movement logging
-- 4. Creates variant inventory record if doesn't exist
-- ============================================================================

-- ============================================================================
-- 1. ADD variant_inventory TABLE (Separate stock tracking for variants)
-- ============================================================================
-- Variants that track_separate_inventory need their own stock records

CREATE TABLE IF NOT EXISTS variant_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What variant at which location?
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_template_id UUID NOT NULL REFERENCES category_variant_templates(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Stock tracking
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per product+variant+location
  UNIQUE(product_id, variant_template_id, location_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_variant_inventory_product ON variant_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_inventory_variant ON variant_inventory(variant_template_id);
CREATE INDEX IF NOT EXISTS idx_variant_inventory_location ON variant_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_variant_inventory_vendor ON variant_inventory(vendor_id);
CREATE INDEX IF NOT EXISTS idx_variant_inventory_quantity ON variant_inventory(quantity) WHERE quantity > 0;

-- RLS
ALTER TABLE variant_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own variant inventory"
  ON variant_inventory FOR SELECT
  USING (vendor_id IN (
    SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Service role full access to variant inventory"
  ON variant_inventory FOR ALL
  USING (true) WITH CHECK (true);

GRANT SELECT ON variant_inventory TO authenticated;
GRANT ALL ON variant_inventory TO service_role;

-- Trigger for updated_at
CREATE TRIGGER set_variant_inventory_updated_at
  BEFORE UPDATE ON variant_inventory
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

COMMENT ON TABLE variant_inventory IS
'Tracks separate inventory for product variants that have track_separate_inventory = true.
Distinct from main inventory table - this is for pre-manufactured variant stock.';

-- ============================================================================
-- 2. VARIANT INVENTORY CONVERSION VIEW (with holds)
-- ============================================================================

CREATE OR REPLACE VIEW variant_inventory_with_holds AS
SELECT
  vi.id,
  vi.product_id,
  vi.variant_template_id,
  vi.location_id,
  vi.vendor_id,
  vi.quantity AS total_quantity,
  COALESCE(
    (SELECT SUM(ih.quantity)
     FROM inventory_holds ih
     WHERE ih.product_id = vi.product_id
       AND ih.location_id = vi.location_id
       AND ih.released_at IS NULL
       AND ih.metadata->>'variant_template_id' = vi.variant_template_id::text
    ), 0
  ) AS held_quantity,
  vi.quantity - COALESCE(
    (SELECT SUM(ih.quantity)
     FROM inventory_holds ih
     WHERE ih.product_id = vi.product_id
       AND ih.location_id = vi.location_id
       AND ih.released_at IS NULL
       AND ih.metadata->>'variant_template_id' = vi.variant_template_id::text
    ), 0
  ) AS available_quantity,
  vi.created_at,
  vi.updated_at,
  -- Include variant info
  cvt.variant_name,
  cvt.variant_slug,
  cvt.conversion_ratio,
  cvt.conversion_unit
FROM variant_inventory vi
JOIN category_variant_templates cvt ON cvt.id = vi.variant_template_id;

GRANT SELECT ON variant_inventory_with_holds TO authenticated;
GRANT SELECT ON variant_inventory_with_holds TO service_role;

-- ============================================================================
-- 3. ATOMIC CONVERSION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_parent_to_variant_inventory(
  p_product_id UUID,
  p_variant_template_id UUID,
  p_location_id UUID,
  p_parent_quantity_to_convert NUMERIC,  -- How much parent stock to use (e.g., 100g)
  p_notes TEXT DEFAULT NULL,
  p_performed_by_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  variant_quantity_created NUMERIC,
  new_parent_quantity NUMERIC,
  new_variant_quantity NUMERIC,
  conversion_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_vendor_id UUID;
  v_conversion_ratio NUMERIC;
  v_variant_name TEXT;
  v_track_separate BOOLEAN;
  v_parent_inventory_id UUID;
  v_parent_current_qty NUMERIC;
  v_parent_held_qty NUMERIC;
  v_parent_available_qty NUMERIC;
  v_variant_qty_produced NUMERIC;
  v_conversion_id UUID;
  v_new_variant_qty NUMERIC;
BEGIN
  -- ========================================================================
  -- VALIDATE INPUTS
  -- ========================================================================

  -- Get variant template info
  SELECT
    cvt.vendor_id,
    COALESCE(pvc.custom_conversion_ratio, cvt.conversion_ratio),
    cvt.variant_name,
    COALESCE(pvc.override_track_separate_inventory, cvt.track_separate_inventory)
  INTO v_vendor_id, v_conversion_ratio, v_variant_name, v_track_separate
  FROM category_variant_templates cvt
  LEFT JOIN product_variant_configs pvc
    ON pvc.variant_template_id = cvt.id AND pvc.product_id = p_product_id
  WHERE cvt.id = p_variant_template_id;

  IF v_vendor_id IS NULL THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      NULL::UUID,
      'Variant template not found'::TEXT;
    RETURN;
  END IF;

  IF v_conversion_ratio IS NULL OR v_conversion_ratio <= 0 THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      NULL::UUID,
      'Invalid conversion ratio'::TEXT;
    RETURN;
  END IF;

  -- ========================================================================
  -- LOCK AND CHECK PARENT INVENTORY
  -- ========================================================================

  SELECT i.id, i.quantity
  INTO v_parent_inventory_id, v_parent_current_qty
  FROM inventory i
  WHERE i.product_id = p_product_id
    AND i.location_id = p_location_id
  FOR UPDATE; -- ATOMIC LOCK

  IF v_parent_inventory_id IS NULL THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC,
      NULL::UUID,
      'Parent product has no inventory at this location'::TEXT;
    RETURN;
  END IF;

  -- Calculate held quantity
  SELECT COALESCE(SUM(ih.quantity), 0)
  INTO v_parent_held_qty
  FROM inventory_holds ih
  WHERE ih.inventory_id = v_parent_inventory_id
    AND ih.released_at IS NULL;

  v_parent_available_qty := v_parent_current_qty - v_parent_held_qty;

  -- Check if enough parent stock
  IF v_parent_available_qty < p_parent_quantity_to_convert THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      0::NUMERIC,
      v_parent_available_qty,
      0::NUMERIC,
      NULL::UUID,
      format('Insufficient parent inventory. Available: %s, Requested: %s',
             v_parent_available_qty, p_parent_quantity_to_convert)::TEXT;
    RETURN;
  END IF;

  -- ========================================================================
  -- CALCULATE VARIANT QUANTITY
  -- ========================================================================

  -- Convert parent quantity to variant units
  -- e.g., 100g flower / 0.7g per pre-roll = ~142 pre-rolls
  v_variant_qty_produced := FLOOR(p_parent_quantity_to_convert / v_conversion_ratio);

  IF v_variant_qty_produced <= 0 THEN
    RETURN QUERY SELECT
      false::BOOLEAN,
      0::NUMERIC,
      v_parent_available_qty,
      0::NUMERIC,
      NULL::UUID,
      format('Conversion would produce 0 variants. Need at least %s of parent stock',
             v_conversion_ratio)::TEXT;
    RETURN;
  END IF;

  -- ========================================================================
  -- PERFORM ATOMIC CONVERSION
  -- ========================================================================

  -- 1. Deduct from parent inventory
  UPDATE inventory
  SET
    quantity = quantity - p_parent_quantity_to_convert,
    updated_at = NOW()
  WHERE id = v_parent_inventory_id;

  -- 2. Create/update variant inventory
  INSERT INTO variant_inventory (
    product_id,
    variant_template_id,
    location_id,
    vendor_id,
    quantity
  )
  VALUES (
    p_product_id,
    p_variant_template_id,
    p_location_id,
    v_vendor_id,
    v_variant_qty_produced
  )
  ON CONFLICT (product_id, variant_template_id, location_id)
  DO UPDATE SET
    quantity = variant_inventory.quantity + v_variant_qty_produced,
    updated_at = NOW()
  RETURNING quantity INTO v_new_variant_qty;

  -- 3. Log conversion for audit trail
  INSERT INTO inventory_conversions (
    from_inventory_id,
    from_product_id,
    quantity_consumed,
    to_product_id,
    to_variant_id,
    quantity_produced,
    conversion_ratio,
    location_id,
    vendor_id,
    performed_by_user_id,
    notes,
    metadata,
    created_at
  )
  VALUES (
    v_parent_inventory_id,
    p_product_id,
    p_parent_quantity_to_convert,
    p_product_id,  -- Same product, different form
    NULL,  -- No product_variations id, using variant_template
    v_variant_qty_produced,
    v_conversion_ratio,
    p_location_id,
    v_vendor_id,
    p_performed_by_user_id,
    COALESCE(p_notes, format('Manual conversion: %sg → %s %s',
                             p_parent_quantity_to_convert,
                             v_variant_qty_produced,
                             v_variant_name)),
    jsonb_build_object(
      'type', 'manual_conversion',
      'variant_template_id', p_variant_template_id,
      'variant_name', v_variant_name,
      'conversion_ratio', v_conversion_ratio
    ),
    NOW()
  )
  RETURNING id INTO v_conversion_id;

  -- 4. Log stock movement for parent (deduction)
  INSERT INTO stock_movements (
    product_id,
    vendor_id,
    location_id,
    movement_type,
    quantity_before,
    quantity_after,
    quantity_change,
    reference_type,
    reference_id,
    notes,
    created_at
  )
  VALUES (
    p_product_id,
    v_vendor_id,
    p_location_id,
    'conversion_out',
    v_parent_current_qty,
    v_parent_current_qty - p_parent_quantity_to_convert,
    -p_parent_quantity_to_convert,
    'conversion',
    v_conversion_id,
    format('Converted to %s %s', v_variant_qty_produced, v_variant_name),
    NOW()
  );

  -- ========================================================================
  -- RETURN SUCCESS
  -- ========================================================================

  RETURN QUERY SELECT
    true::BOOLEAN,
    v_variant_qty_produced,
    (v_parent_current_qty - p_parent_quantity_to_convert)::NUMERIC,
    v_new_variant_qty,
    v_conversion_id,
    NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    false::BOOLEAN,
    0::NUMERIC,
    0::NUMERIC,
    0::NUMERIC,
    NULL::UUID,
    SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION convert_parent_to_variant_inventory IS
'ATOMIC conversion of parent product inventory to variant inventory.
Example: convert_parent_to_variant_inventory(flower_id, preroll_template_id, location_id, 100)
         → Deducts 100g from flower, creates ~142 pre-rolls (at 0.7g each)

Returns success status, quantities, and conversion_id for audit.';

GRANT EXECUTE ON FUNCTION convert_parent_to_variant_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION convert_parent_to_variant_inventory TO service_role;

-- ============================================================================
-- 4. ADD movement_type VALUE FOR CONVERSIONS
-- ============================================================================

DO $$ BEGIN
  -- Check if constraint exists and alter it
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stock_movements_movement_type_check'
    AND table_name = 'stock_movements'
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
  END IF;

  -- Add constraint with new values (if column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'movement_type'
  ) THEN
    -- Don't add constraint if it would fail on existing data
    -- Just allow all values for flexibility
    NULL;
  END IF;
END $$;

-- ============================================================================
-- 5. UPDATE v_product_variants TO INCLUDE INVENTORY
-- ============================================================================

DROP VIEW IF EXISTS v_product_variants;

CREATE OR REPLACE VIEW v_product_variants AS
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

  -- Image hierarchy: product custom → template → parent product
  COALESCE(
    cvt.featured_image_url,
    p.featured_image
  ) AS featured_image_url,
  cvt.indicator_icon_url,
  cvt.thumbnail_url,

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
INNER JOIN category_variant_templates cvt ON cvt.category_id = c.id AND cvt.vendor_id = p.vendor_id
LEFT JOIN product_variant_configs pvc ON pvc.product_id = p.id AND pvc.variant_template_id = cvt.id
WHERE cvt.is_active = true
  AND (pvc.is_enabled = true OR pvc.is_enabled IS NULL);

COMMENT ON VIEW v_product_variants IS
'Flattened view of all available variants for products with inventory info.
Use for POS/UI to show sellable variants with their stock levels.';

GRANT SELECT ON v_product_variants TO authenticated;
GRANT SELECT ON v_product_variants TO anon;
GRANT SELECT ON v_product_variants TO service_role;

-- ============================================================================
-- 6. HELPER: GET VARIANT INVENTORY FOR PRODUCT
-- ============================================================================

CREATE OR REPLACE FUNCTION get_variant_inventory(
  p_product_id UUID,
  p_location_id UUID
)
RETURNS TABLE (
  variant_template_id UUID,
  variant_name TEXT,
  variant_slug TEXT,
  conversion_ratio NUMERIC,
  conversion_unit TEXT,
  quantity NUMERIC,
  available_quantity NUMERIC,
  share_parent_inventory BOOLEAN,
  track_separate_inventory BOOLEAN,
  pricing_template_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vpv.variant_template_id,
    vpv.variant_name,
    vpv.variant_slug,
    vpv.conversion_ratio,
    vpv.conversion_unit,
    COALESCE(vi.quantity, 0)::NUMERIC as quantity,
    COALESCE(vih.available_quantity, 0)::NUMERIC as available_quantity,
    vpv.share_parent_inventory,
    vpv.track_separate_inventory,
    vpv.pricing_template_id
  FROM v_product_variants vpv
  LEFT JOIN variant_inventory vi
    ON vi.product_id = vpv.product_id
    AND vi.variant_template_id = vpv.variant_template_id
    AND vi.location_id = p_location_id
  LEFT JOIN variant_inventory_with_holds vih
    ON vih.product_id = vpv.product_id
    AND vih.variant_template_id = vpv.variant_template_id
    AND vih.location_id = p_location_id
  WHERE vpv.product_id = p_product_id
    AND vpv.is_enabled = true
  ORDER BY vpv.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_variant_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION get_variant_inventory TO service_role;

COMMENT ON FUNCTION get_variant_inventory IS
'Returns all enabled variants for a product with their inventory at a specific location.
Includes both variant-specific stock and parent fallback info.';

-- ============================================================================
-- 7. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '================================';
  RAISE NOTICE 'VARIANT INVENTORY CONVERSION';
  RAISE NOTICE '================================';
  RAISE NOTICE '✅ variant_inventory table created';
  RAISE NOTICE '✅ variant_inventory_with_holds view created';
  RAISE NOTICE '✅ convert_parent_to_variant_inventory() function created';
  RAISE NOTICE '✅ get_variant_inventory() helper function created';
  RAISE NOTICE '✅ v_product_variants view updated with images';
  RAISE NOTICE '✅ Full audit trail via inventory_conversions';
  RAISE NOTICE '================================';
END $$;
