-- Create function for atomic bulk pricing updates
-- This updates ALL products in a category instantly with new pricing tiers

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

-- Add comment explaining the function
COMMENT ON FUNCTION update_products_pricing_from_template IS
  'Atomically updates all products in a category with new pricing tiers from template. Returns count and IDs of updated products.';
