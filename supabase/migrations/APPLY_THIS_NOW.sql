-- ============================================
-- PRICING SYSTEM MIGRATION - APPLY THIS NOW
-- ============================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor and click RUN
-- ============================================

-- Step 1: Enable real-time for pricing tables
ALTER PUBLICATION supabase_realtime ADD TABLE pricing_tier_templates;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Create bulk update function
CREATE OR REPLACE FUNCTION update_products_pricing_from_template(
  p_category_id uuid,
  p_vendor_id uuid,
  p_new_tiers jsonb
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
  -- Update all products in this category with new pricing tiers
  -- This is ATOMIC - all products update together or none
  WITH updated_products AS (
    UPDATE products
    SET
      meta_data = jsonb_set(
        jsonb_set(
          COALESCE(meta_data, '{}'::jsonb),
          '{pricing_tiers}',
          p_new_tiers
        ),
        '{pricing_mode}',
        '"tiered"'::jsonb
      ),
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

  -- Return results
  RETURN QUERY SELECT v_updated_count, v_updated_ids;
END;
$$;

-- Step 3: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Step 4: Verify function was created
SELECT
  'SUCCESS: Function created' as status,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'update_products_pricing_from_template';

-- Done! Now pricing updates will cascade instantly to all products.
