-- Migration: Daily Audit Batching
-- Purpose: Group inventory adjustments by day instead of individual audit sessions
-- This simplifies auditing - all adjustments on the same day at same location are one "batch"

-- ============================================================================
-- 1. ADD audit_date COLUMN
-- ============================================================================

-- Add audit_date column with default of current date
ALTER TABLE inventory_adjustments
ADD COLUMN IF NOT EXISTS audit_date DATE DEFAULT CURRENT_DATE;

-- ============================================================================
-- 2. BACKFILL EXISTING DATA
-- ============================================================================

-- Set audit_date from created_at for all existing records
UPDATE inventory_adjustments
SET audit_date = DATE(created_at)
WHERE audit_date IS NULL;

-- Make audit_date NOT NULL after backfill
ALTER TABLE inventory_adjustments
ALTER COLUMN audit_date SET NOT NULL;

-- ============================================================================
-- 3. CREATE INDEXES FOR DAILY QUERIES
-- ============================================================================

-- Primary index for daily batch queries: "What happened today at this location?"
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_daily_batch
ON inventory_adjustments (vendor_id, location_id, audit_date DESC);

-- Index for date-only queries across all locations
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_audit_date
ON inventory_adjustments (vendor_id, audit_date DESC);

-- ============================================================================
-- 4. UPDATE process_inventory_adjustment FUNCTION
-- ============================================================================

-- Update the atomic adjustment function to explicitly set audit_date
CREATE OR REPLACE FUNCTION process_inventory_adjustment(
  p_vendor_id UUID,
  p_product_id UUID,
  p_location_id UUID,
  p_adjustment_type TEXT,
  p_quantity_change NUMERIC,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  adjustment_id UUID,
  inventory_id UUID,
  quantity_before NUMERIC,
  quantity_after NUMERIC,
  quantity_change NUMERIC,
  product_total_stock NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inventory_id UUID;
  v_quantity_before NUMERIC;
  v_quantity_after NUMERIC;
  v_adjustment_id UUID;
  v_product_total NUMERIC;
  v_existing_adjustment_id UUID;
BEGIN
  -- Check idempotency if key provided
  IF p_idempotency_key IS NOT NULL THEN
    SELECT ia.id INTO v_existing_adjustment_id
    FROM inventory_adjustments ia
    WHERE ia.idempotency_key = p_idempotency_key;

    IF v_existing_adjustment_id IS NOT NULL THEN
      -- Return existing adjustment data
      RETURN QUERY
      SELECT
        ia.id,
        ia.inventory_id,
        ia.quantity_before,
        ia.quantity_after,
        ia.quantity_change,
        COALESCE(p.inventory_quantity, 0)
      FROM inventory_adjustments ia
      JOIN inventory i ON ia.inventory_id = i.id
      JOIN products p ON ia.product_id = p.id
      WHERE ia.id = v_existing_adjustment_id;
      RETURN;
    END IF;
  END IF;

  -- Lock and get inventory record
  SELECT id, quantity INTO v_inventory_id, v_quantity_before
  FROM inventory
  WHERE product_id = p_product_id AND location_id = p_location_id
  FOR UPDATE;

  -- Create inventory record if doesn't exist
  IF v_inventory_id IS NULL THEN
    INSERT INTO inventory (product_id, location_id, quantity, vendor_id)
    VALUES (p_product_id, p_location_id, 0, p_vendor_id)
    RETURNING id, quantity INTO v_inventory_id, v_quantity_before;
  END IF;

  -- Calculate new quantity
  v_quantity_after := GREATEST(0, v_quantity_before + p_quantity_change);

  -- Prevent negative inventory for non-sale adjustments
  IF v_quantity_after < 0 AND p_adjustment_type NOT IN ('sale', 'return') THEN
    RAISE EXCEPTION 'Cannot reduce inventory below zero. Current: %, Change: %', v_quantity_before, p_quantity_change;
  END IF;

  -- Update inventory
  UPDATE inventory
  SET quantity = v_quantity_after,
      updated_at = NOW()
  WHERE id = v_inventory_id;

  -- Create adjustment record with audit_date = today
  INSERT INTO inventory_adjustments (
    vendor_id,
    product_id,
    location_id,
    inventory_id,
    adjustment_type,
    quantity_before,
    quantity_after,
    quantity_change,
    reason,
    notes,
    reference_id,
    reference_type,
    created_by,
    idempotency_key,
    audit_date,
    created_at
  ) VALUES (
    p_vendor_id,
    p_product_id,
    p_location_id,
    v_inventory_id,
    p_adjustment_type,
    v_quantity_before,
    v_quantity_after,
    p_quantity_change,
    p_reason,
    p_notes,
    p_reference_id,
    p_reference_type,
    p_created_by,
    p_idempotency_key,
    CURRENT_DATE,  -- Always use today's date for the audit batch
    NOW()
  )
  RETURNING id INTO v_adjustment_id;

  -- Update product total stock
  UPDATE products
  SET inventory_quantity = (
    SELECT COALESCE(SUM(quantity), 0)
    FROM inventory
    WHERE product_id = p_product_id
  ),
  updated_at = NOW()
  WHERE id = p_product_id
  RETURNING inventory_quantity INTO v_product_total;

  -- Create stock movement record
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
    created_at
  ) VALUES (
    p_product_id,
    p_vendor_id,
    p_location_id,
    p_adjustment_type,
    v_quantity_before,
    v_quantity_after,
    p_quantity_change,
    'inventory_adjustment',
    v_adjustment_id::TEXT,
    NOW()
  );

  -- Return result
  RETURN QUERY SELECT
    v_adjustment_id,
    v_inventory_id,
    v_quantity_before,
    v_quantity_after,
    p_quantity_change,
    v_product_total;
END;
$$;

-- ============================================================================
-- 5. CREATE VIEW FOR DAILY AUDIT SUMMARIES
-- ============================================================================

-- Drop if exists to recreate
DROP VIEW IF EXISTS daily_audit_summary;

-- View for easy daily audit queries
CREATE VIEW daily_audit_summary AS
SELECT
  vendor_id,
  location_id,
  audit_date,
  COUNT(*) as adjustment_count,
  SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) ELSE 0 END) as total_shrinkage,
  SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END) as total_additions,
  SUM(quantity_change) as net_change,
  array_agg(DISTINCT reason) FILTER (WHERE reason IS NOT NULL) as reasons,
  MIN(created_at) as first_adjustment,
  MAX(created_at) as last_adjustment
FROM inventory_adjustments
GROUP BY vendor_id, location_id, audit_date;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON daily_audit_summary TO authenticated;

-- Done!
COMMENT ON COLUMN inventory_adjustments.audit_date IS 'Groups adjustments by day - all adjustments on same date at same location are one audit batch';
