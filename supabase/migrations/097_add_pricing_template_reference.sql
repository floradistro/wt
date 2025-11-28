-- ============================================
-- LIVE PRICING TEMPLATES - Add Template Reference
-- ============================================
-- This migration changes the pricing system from "copy tiers" to "live reference"
-- Products will now point to a template instead of storing orphaned copies

-- Step 1: Add pricing_template_id column to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS pricing_template_id uuid REFERENCES pricing_tier_templates(id) ON DELETE SET NULL;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_pricing_template_id ON products(pricing_template_id);

-- Step 3: Backfill pricing_template_id for existing products
-- Match products to templates based on category and matching tier prices
-- This is a best-effort migration - some products may not match perfectly
DO $$
DECLARE
  template_record RECORD;
  product_record RECORD;
  first_tier_price numeric;
BEGIN
  -- For each active pricing template
  FOR template_record IN
    SELECT id, category_id, default_tiers
    FROM pricing_tier_templates
    WHERE is_active = true
  LOOP
    -- Get the first tier price from template
    first_tier_price := (template_record.default_tiers->0->>'default_price')::numeric;

    -- Update products that match this template's category and first tier price
    UPDATE products
    SET pricing_template_id = template_record.id
    WHERE
      primary_category_id = template_record.category_id
      AND (meta_data->'pricing_tiers'->0->>'price')::numeric = first_tier_price
      AND pricing_template_id IS NULL; -- Don't overwrite if already set
  END LOOP;
END $$;

-- Step 4: Update the bulk update function to set template reference
DROP FUNCTION IF EXISTS update_products_pricing_from_template(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION update_products_pricing_from_template(
  p_category_id uuid,
  p_vendor_id uuid,
  p_template_id uuid
)
RETURNS TABLE (
  updated_count integer,
  updated_product_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count integer;
  v_updated_ids uuid[];
BEGIN
  -- Update products to reference the template (LIVE REFERENCE)
  -- No longer copying tiers - products will read from template at runtime
  WITH updated_products AS (
    UPDATE products
    SET
      pricing_template_id = p_template_id,
      updated_at = now()
    WHERE
      primary_category_id = p_category_id
      AND vendor_id = p_vendor_id
    RETURNING id
  )
  SELECT
    count(*)::integer,
    array_agg(id)
  INTO v_updated_count, v_updated_ids
  FROM updated_products;

  RETURN QUERY SELECT v_updated_count, v_updated_ids;
END;
$$;

COMMENT ON FUNCTION update_products_pricing_from_template IS
  'Sets pricing_template_id reference for products. Products now read pricing from template dynamically instead of storing orphaned copies.';

-- Step 5: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
