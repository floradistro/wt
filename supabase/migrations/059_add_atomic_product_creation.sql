-- ============================================================================
-- ATOMIC PRODUCT CREATION FUNCTIONS
-- ============================================================================
-- Apple-quality implementation for product creation with:
-- ✅ Idempotency (safe retries)
-- ✅ Automatic unique slug generation
-- ✅ Optional initial inventory creation
-- ✅ All-or-nothing bulk creation
-- ✅ Audit trail (via existing trigger from migration 049)
-- ============================================================================

-- ============================================================================
-- FUNCTION: create_product_atomic (Single Product)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_product_atomic(
  p_vendor_id UUID,
  p_name TEXT,
  p_category_id UUID,
  p_pricing_data JSONB,
  p_sku TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'simple',
  p_status TEXT DEFAULT 'published',
  p_stock_status TEXT DEFAULT 'instock',
  p_featured BOOLEAN DEFAULT FALSE,
  p_initial_inventory JSONB DEFAULT NULL,  -- [{location_id: UUID, quantity: NUMERIC}]
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  slug TEXT,
  inventory_created INTEGER
) AS $$
DECLARE
  v_product_id UUID;
  v_slug TEXT;
  v_base_slug TEXT;
  v_slug_counter INTEGER := 0;
  v_slug_exists BOOLEAN;
  v_inventory_item JSONB;
  v_inventory_count INTEGER := 0;
BEGIN
  -- STEP 1: CHECK IDEMPOTENCY
  IF p_idempotency_key IS NOT NULL THEN
    SELECT p.id, p.name, p.slug
    INTO v_product_id, product_name, slug
    FROM products p
    WHERE p.vendor_id = p_vendor_id
      AND p.idempotency_key = p_idempotency_key;

    IF v_product_id IS NOT NULL THEN
      -- Return existing product
      SELECT COUNT(*) INTO v_inventory_count
      FROM inventory
      WHERE inventory.product_id = v_product_id;

      RETURN QUERY
      SELECT v_product_id, product_name, slug, v_inventory_count;
      RETURN;
    END IF;
  END IF;

  -- STEP 2: VALIDATE INPUTS
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;

  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor ID is required';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required';
  END IF;

  -- STEP 3: GENERATE UNIQUE SLUG
  -- Base slug from product name (lowercase first, then replace non-alphanumeric)
  v_base_slug := REGEXP_REPLACE(LOWER(TRIM(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base_slug := REGEXP_REPLACE(v_base_slug, '^-+|-+$', '', 'g');

  -- Ensure slug is not empty
  IF v_base_slug = '' THEN
    v_base_slug := 'product';
  END IF;

  v_slug := v_base_slug;

  -- Check for slug collision and append number if needed
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM products p
      WHERE p.slug = v_slug AND p.vendor_id = p_vendor_id
    ) INTO v_slug_exists;

    EXIT WHEN NOT v_slug_exists;

    v_slug_counter := v_slug_counter + 1;
    v_slug := v_base_slug || '-' || v_slug_counter;
  END LOOP;

  -- STEP 4: CREATE PRODUCT
  INSERT INTO products (
    vendor_id,
    name,
    slug,
    sku,
    description,
    type,
    status,
    primary_category_id,
    pricing_data,
    stock_status,
    featured,
    stock_quantity,
    idempotency_key,
    created_at,
    updated_at
  )
  VALUES (
    p_vendor_id,
    TRIM(p_name),
    v_slug,
    p_sku,
    p_description,
    p_type,
    p_status,
    p_category_id,
    p_pricing_data,
    p_stock_status,
    p_featured,
    0,  -- Will be updated if initial inventory provided
    p_idempotency_key,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_product_id;

  -- STEP 5: CREATE INITIAL INVENTORY (if provided)
  IF p_initial_inventory IS NOT NULL THEN
    FOR v_inventory_item IN SELECT * FROM jsonb_array_elements(p_initial_inventory)
    LOOP
      -- Validate inventory item
      IF (v_inventory_item->>'location_id') IS NULL THEN
        RAISE EXCEPTION 'location_id is required for inventory items';
      END IF;

      IF (v_inventory_item->>'quantity')::NUMERIC < 0 THEN
        RAISE EXCEPTION 'Quantity cannot be negative';
      END IF;

      -- Insert or update inventory
      INSERT INTO inventory (
        vendor_id,
        product_id,
        location_id,
        quantity,
        created_at,
        updated_at
      )
      VALUES (
        p_vendor_id,
        v_product_id,
        (v_inventory_item->>'location_id')::UUID,
        (v_inventory_item->>'quantity')::NUMERIC,
        NOW(),
        NOW()
      )
      ON CONFLICT ON CONSTRAINT inventory_product_location_unique
      DO UPDATE SET
        quantity = inventory.quantity + EXCLUDED.quantity,
        updated_at = NOW();

      v_inventory_count := v_inventory_count + 1;
    END LOOP;

    -- Update product stock_quantity if inventory was created
    UPDATE products
    SET stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM inventory
      WHERE inventory.product_id = v_product_id
    )
    WHERE id = v_product_id;
  END IF;

  -- RETURN RESULTS
  RETURN QUERY
  SELECT v_product_id, TRIM(p_name), v_slug, v_inventory_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: create_products_bulk (Batch Creation)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_products_bulk(
  p_vendor_id UUID,
  p_products TEXT,  -- JSON string for Supabase client compatibility
  p_category_id UUID,
  p_pricing_data JSONB,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  products_created INTEGER,
  products_skipped INTEGER,
  product_ids UUID[]
) AS $$
DECLARE
  v_products_json JSONB;
  v_product JSONB;
  v_product_id UUID;
  v_product_ids UUID[] := ARRAY[]::UUID[];
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_slug_map JSONB := '{}'::JSONB;
  v_name TEXT;
  v_sku TEXT;
BEGIN
  v_products_json := p_products::JSONB;

  -- STEP 1: CHECK BATCH IDEMPOTENCY
  IF p_idempotency_key IS NOT NULL THEN
    -- Check if this batch was already processed
    IF EXISTS (
      SELECT 1 FROM products
      WHERE vendor_id = p_vendor_id
        AND idempotency_key LIKE p_idempotency_key || '-%'
      LIMIT 1
    ) THEN
      -- Return existing batch results
      SELECT
        COUNT(*)::INTEGER,
        0::INTEGER,
        ARRAY_AGG(id)
      INTO products_created, products_skipped, product_ids
      FROM products
      WHERE vendor_id = p_vendor_id
        AND idempotency_key LIKE p_idempotency_key || '-%';

      RETURN QUERY
      SELECT products_created, products_skipped, product_ids;
      RETURN;
    END IF;
  END IF;

  -- STEP 2: VALIDATE INPUTS
  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor ID is required';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required';
  END IF;

  -- STEP 3: PROCESS EACH PRODUCT
  FOR v_product IN SELECT * FROM jsonb_array_elements(v_products_json)
  LOOP
    v_name := TRIM(v_product->>'name');
    v_sku := v_product->>'sku';

    -- Skip if name is empty
    IF v_name IS NULL OR v_name = '' THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Skip if product with same name already exists for this vendor
    IF EXISTS (
      SELECT 1 FROM products
      WHERE vendor_id = p_vendor_id
        AND LOWER(name) = LOWER(v_name)
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Create product with unique idempotency key per item
    SELECT product_id FROM create_product_atomic(
      p_vendor_id,
      v_name,
      p_category_id,
      p_pricing_data,
      v_sku,
      v_product->>'description',
      COALESCE(v_product->>'type', 'simple'),
      COALESCE(v_product->>'status', 'published'),
      COALESCE(v_product->>'stock_status', 'instock'),
      COALESCE((v_product->>'featured')::BOOLEAN, FALSE),
      NULL,  -- no initial inventory in bulk
      CASE
        WHEN p_idempotency_key IS NOT NULL
        THEN p_idempotency_key || '-' || v_created_count
        ELSE NULL
      END
    ) INTO v_product_id;

    v_product_ids := array_append(v_product_ids, v_product_id);
    v_created_count := v_created_count + 1;
  END LOOP;

  -- RETURN RESULTS
  RETURN QUERY
  SELECT v_created_count, v_skipped_count, v_product_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADD idempotency_key COLUMN (if not exists)
-- ============================================================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_products_idempotency
ON products(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION create_product_atomic(UUID, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_product_atomic(UUID, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION create_products_bulk(UUID, TEXT, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_products_bulk(UUID, TEXT, UUID, JSONB, TEXT) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION create_product_atomic IS
'Atomically creates a single product with automatic slug generation, optional initial inventory, and idempotency support. Follows Apple engineering best practices.';

COMMENT ON FUNCTION create_products_bulk IS
'Atomically creates multiple products in a single transaction. Skips duplicates based on product name. All-or-nothing operation for data integrity.';

COMMENT ON COLUMN products.idempotency_key IS
'Unique key to prevent duplicate product creation. Enables safe retries for both single and bulk operations.';
