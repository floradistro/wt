-- ============================================================================
-- PRODUCT AUDIT TRAIL SYSTEM
-- ============================================================================
-- This migration adds comprehensive audit logging for product changes
-- Tracks who changed what, when, and provides historical versioning
-- ============================================================================

-- ============================================================================
-- CREATE PRODUCT AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL, -- Denormalized for faster vendor queries
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'restored')),
  field_name TEXT, -- Specific field that changed (NULL for bulk updates)
  old_value JSONB, -- Previous value (NULL for creations)
  new_value JSONB, -- New value (NULL for deletions)
  metadata JSONB, -- Additional context (e.g., reason, source, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_audit_product_id ON product_audit(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_vendor_id ON product_audit(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_changed_by ON product_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_product_audit_changed_at ON product_audit(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_audit_change_type ON product_audit(change_type);

-- RLS policies
ALTER TABLE product_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their vendor"
  ON product_audit
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage product audit"
  ON product_audit
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON product_audit TO authenticated;
GRANT ALL ON product_audit TO service_role;

-- Comment
COMMENT ON TABLE product_audit IS
'Comprehensive audit trail for all product changes. Tracks field-level modifications with timestamps and user attribution.';

-- ============================================================================
-- FUNCTION: UPDATE PRODUCT WITH AUDIT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_with_audit(
  p_product_id UUID,
  p_vendor_id UUID,
  p_changes JSONB,
  p_changed_by UUID,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_field TEXT;
  v_old_product RECORD;
  v_old_value JSONB;
  v_new_value JSONB;
  v_changed BOOLEAN := FALSE;
BEGIN
  -- Lock product row and get current values
  SELECT * INTO v_old_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  -- Verify vendor ownership
  IF v_old_product.vendor_id != p_vendor_id THEN
    RAISE EXCEPTION 'Product % does not belong to vendor %', p_product_id, p_vendor_id;
  END IF;

  -- Apply each change and log audit record
  FOR v_field IN SELECT jsonb_object_keys(p_changes)
  LOOP
    v_new_value := p_changes->v_field;

    -- Get old value based on field name
    CASE v_field
      WHEN 'name' THEN
        v_old_value := to_jsonb(v_old_product.name);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET name = (v_new_value->>0)::TEXT WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      WHEN 'sku' THEN
        v_old_value := to_jsonb(v_old_product.sku);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET sku = (v_new_value->>0)::TEXT WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      WHEN 'description' THEN
        v_old_value := to_jsonb(v_old_product.description);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET description = (v_new_value->>0)::TEXT WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      WHEN 'price' THEN
        v_old_value := to_jsonb(v_old_product.price);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET price = (v_new_value->>0)::NUMERIC WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      WHEN 'cost' THEN
        v_old_value := to_jsonb(v_old_product.cost);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET cost = (v_new_value->>0)::NUMERIC WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      WHEN 'barcode' THEN
        v_old_value := to_jsonb(v_old_product.barcode);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET barcode = (v_new_value->>0)::TEXT WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      WHEN 'is_active' THEN
        v_old_value := to_jsonb(v_old_product.is_active);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET is_active = (v_new_value->>0)::BOOLEAN WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      WHEN 'category_id' THEN
        v_old_value := to_jsonb(v_old_product.category_id);
        IF v_old_value IS DISTINCT FROM v_new_value THEN
          UPDATE products SET category_id = (v_new_value->>0)::UUID WHERE id = p_product_id;
          v_changed := TRUE;
        END IF;

      ELSE
        -- Unknown field, skip
        RAISE WARNING 'Unknown product field: %', v_field;
        CONTINUE;
    END CASE;

    -- Log audit record if changed
    IF v_changed THEN
      INSERT INTO product_audit (
        product_id,
        vendor_id,
        changed_by,
        changed_at,
        change_type,
        field_name,
        old_value,
        new_value,
        metadata
      )
      VALUES (
        p_product_id,
        p_vendor_id,
        p_changed_by,
        NOW(),
        'updated',
        v_field,
        v_old_value,
        v_new_value,
        p_metadata
      );

      v_changed := FALSE; -- Reset for next field
    END IF;
  END LOOP;

  -- Update the products updated_at timestamp
  UPDATE products
  SET updated_at = NOW()
  WHERE id = p_product_id;

  RETURN p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: LOG PRODUCT CREATION (Trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_product_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO product_audit (
    product_id,
    vendor_id,
    changed_by,
    changed_at,
    change_type,
    field_name,
    old_value,
    new_value,
    metadata
  )
  VALUES (
    NEW.id,
    NEW.vendor_id,
    NEW.created_by,
    NOW(),
    'created',
    NULL,
    NULL,
    to_jsonb(NEW),
    jsonb_build_object('source', 'trigger')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGER FOR PRODUCT CREATION
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_log_product_creation ON products;

CREATE TRIGGER trigger_log_product_creation
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_product_creation();

-- ============================================================================
-- FUNCTION: GET PRODUCT HISTORY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_product_history(
  p_product_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  changed_by UUID,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ,
  change_type TEXT,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.changed_by,
    u.email as changed_by_email,
    pa.changed_at,
    pa.change_type,
    pa.field_name,
    pa.old_value,
    pa.new_value,
    pa.metadata
  FROM product_audit pa
  LEFT JOIN auth.users u ON u.id = pa.changed_by
  WHERE pa.product_id = p_product_id
  ORDER BY pa.changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION update_product_with_audit(UUID, UUID, JSONB, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_product_with_audit(UUID, UUID, JSONB, UUID, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION get_product_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_history(UUID, INTEGER) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION update_product_with_audit IS
'Updates product fields atomically while logging all changes to the audit trail. Provides field-level change tracking.';

COMMENT ON FUNCTION log_product_creation IS
'Trigger function that automatically logs product creation events to the audit trail.';

COMMENT ON FUNCTION get_product_history IS
'Retrieves the complete change history for a product, including who made changes and when.';
