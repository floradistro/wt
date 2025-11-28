-- ============================================================================
-- FIX INVENTORY QUANTITIES FROM TIER BUG
-- ============================================================================
-- PROBLEM: Before 2025-11-25, the system was deducting 1g for ALL tier sales
--          instead of the actual tier quantity (28g, 3.5g, 7g, etc.)
--
-- SOLUTION: This script calculates the difference and corrects inventory:
--   - What SHOULD have been deducted (from tier_name/quantity_grams)
--   - What WAS deducted (1g per sale)
--   - Adjustment = should_have - was_deducted
--
-- SAFETY: Only updates inventory that won't go negative
--         Products that would go negative are reported for manual review
-- ============================================================================

-- Create temporary table to calculate adjustments
CREATE TEMP TABLE IF NOT EXISTS inventory_fixes AS
WITH historical_sales AS (
  SELECT
    oi.inventory_id,
    COUNT(*) as number_of_sales,
    -- What SHOULD have been deducted (actual tier quantities)
    SUM(oi.quantity_grams) as should_have_deducted,
    -- What WAS actually deducted (bug: only 1g per sale)
    COUNT(*) as was_deducted,
    -- The adjustment needed (negative = need to deduct more)
    SUM(oi.quantity_grams) - COUNT(*) as adjustment_needed
  FROM order_items oi
  WHERE oi.tier_name IS NOT NULL  -- Only tier-based sales
    AND oi.inventory_id IS NOT NULL
    AND oi.created_at < CURRENT_TIMESTAMP  -- All historical sales
  GROUP BY oi.inventory_id
)
SELECT
  hs.inventory_id,
  i.product_id,
  i.location_id,
  i.quantity as current_quantity,
  hs.number_of_sales,
  hs.should_have_deducted,
  hs.was_deducted,
  hs.adjustment_needed,
  i.quantity - hs.adjustment_needed as corrected_quantity,
  CASE
    WHEN (i.quantity - hs.adjustment_needed) < 0 THEN false
    ELSE true
  END as can_auto_fix
FROM historical_sales hs
JOIN inventory i ON i.id = hs.inventory_id
WHERE hs.adjustment_needed != 0;

-- Show summary before applying fixes
DO $$
DECLARE
  v_total_products INTEGER;
  v_can_fix INTEGER;
  v_needs_manual INTEGER;
  v_total_adjustment NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE can_auto_fix = true),
    COUNT(*) FILTER (WHERE can_auto_fix = false),
    SUM(adjustment_needed)
  INTO v_total_products, v_can_fix, v_needs_manual, v_total_adjustment
  FROM inventory_fixes;

  RAISE NOTICE '================================';
  RAISE NOTICE 'INVENTORY FIX SUMMARY';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Total products affected: %', v_total_products;
  RAISE NOTICE 'Can auto-fix: %', v_can_fix;
  RAISE NOTICE 'Need manual review: %', v_needs_manual;
  RAISE NOTICE 'Total adjustment: % grams', v_total_adjustment;
  RAISE NOTICE '================================';
END $$;

-- Apply fixes for products that won't go negative
UPDATE inventory i
SET
  quantity = fix.corrected_quantity,
  updated_at = NOW()
FROM inventory_fixes fix
WHERE i.id = fix.inventory_id
  AND fix.can_auto_fix = true;

-- Report what was fixed
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM inventory_fixes
  WHERE can_auto_fix = true;

  RAISE NOTICE '✅ Successfully updated % products', v_updated_count;
END $$;

-- Report products that need manual review (would go negative)
DO $$
DECLARE
  rec RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  PRODUCTS NEEDING MANUAL REVIEW (would go negative):';
  RAISE NOTICE '================================';

  FOR rec IN
    SELECT
      p.name as product_name,
      p.sku,
      l.name as location_name,
      fix.current_quantity,
      fix.number_of_sales,
      fix.should_have_deducted,
      fix.adjustment_needed,
      fix.corrected_quantity
    FROM inventory_fixes fix
    JOIN products p ON p.id = fix.product_id
    JOIN locations l ON l.id = fix.location_id
    WHERE fix.can_auto_fix = false
    ORDER BY fix.corrected_quantity
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '% - %', v_count, rec.product_name;
    RAISE NOTICE '   Location: %', rec.location_name;
    RAISE NOTICE '   SKU: %', rec.sku;
    RAISE NOTICE '   Current qty: % | Sales: % | Should deduct: % | Would be: %',
      rec.current_quantity, rec.number_of_sales, rec.should_have_deducted, rec.corrected_quantity;
    RAISE NOTICE '   ACTION: Do physical count and set correct quantity';
    RAISE NOTICE '';
  END LOOP;

  IF v_count = 0 THEN
    RAISE NOTICE 'None! All products fixed successfully.';
  END IF;
  RAISE NOTICE '================================';
END $$;

-- Create a report table for manual review (optional - keeps permanent record)
CREATE TABLE IF NOT EXISTS inventory_fix_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fix_date TIMESTAMP DEFAULT NOW(),
  inventory_id UUID REFERENCES inventory(id),
  product_id UUID REFERENCES products(id),
  location_id UUID REFERENCES locations(id),
  old_quantity NUMERIC,
  new_quantity NUMERIC,
  adjustment_applied NUMERIC,
  number_of_sales INTEGER,
  auto_fixed BOOLEAN
);

-- Insert report records
INSERT INTO inventory_fix_report (
  inventory_id,
  product_id,
  location_id,
  old_quantity,
  new_quantity,
  adjustment_applied,
  number_of_sales,
  auto_fixed
)
SELECT
  fix.inventory_id,
  fix.product_id,
  fix.location_id,
  fix.current_quantity,
  CASE
    WHEN fix.can_auto_fix THEN fix.corrected_quantity
    ELSE fix.current_quantity  -- Not changed if needs manual review
  END,
  CASE
    WHEN fix.can_auto_fix THEN fix.adjustment_needed
    ELSE 0
  END,
  fix.number_of_sales,
  fix.can_auto_fix
FROM inventory_fixes fix;

-- Final summary
DO $$
DECLARE
  v_report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_report_count FROM inventory_fix_report;

  RAISE NOTICE '';
  RAISE NOTICE '✅ INVENTORY FIX COMPLETE';
  RAISE NOTICE 'Report saved to inventory_fix_report table (% records)', v_report_count;
  RAISE NOTICE '';
  RAISE NOTICE 'To view the full report:';
  RAISE NOTICE '  SELECT * FROM inventory_fix_report ORDER BY fix_date DESC;';
  RAISE NOTICE '';
  RAISE NOTICE 'To view products that need manual review:';
  RAISE NOTICE '  SELECT * FROM inventory_fix_report WHERE auto_fixed = false;';
END $$;

-- Cleanup temp table
DROP TABLE IF EXISTS inventory_fixes;

COMMENT ON TABLE inventory_fix_report IS
'Audit log of inventory fixes applied to correct the tier deduction bug.
Records show which products were automatically fixed and which need manual review.';
