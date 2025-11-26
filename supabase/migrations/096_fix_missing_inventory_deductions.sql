-- ============================================================================
-- FIX MISSING INVENTORY DEDUCTIONS (Nov 19-26, 2025)
-- ============================================================================
-- PROBLEM: Sales from Nov 19-26 have inventory_id = NULL, so NO inventory
--          was deducted. Need to retroactively deduct the correct quantities.
--
-- SOLUTION: Match tier_price to product pricing_data to determine quantity,
--           then deduct from inventory (or set to 0 if would go negative)
-- ============================================================================

-- Create audit table first
CREATE TABLE IF NOT EXISTS inventory_fix_missing_deductions_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fix_date TIMESTAMP DEFAULT NOW(),
  inventory_id UUID REFERENCES inventory(id),
  product_id UUID REFERENCES products(id),
  location_id UUID REFERENCES locations(id),
  product_name TEXT,
  location_name TEXT,
  old_quantity NUMERIC,
  quantity_to_deduct NUMERIC,
  new_quantity NUMERIC,
  num_sales INTEGER,
  went_negative BOOLEAN,
  unit_type TEXT
);

-- Calculate and apply fixes
DO $$
DECLARE
  v_total_records INTEGER := 0;
  v_fixed_count INTEGER := 0;
  v_negative_count INTEGER := 0;
  v_total_deducted NUMERIC := 0;
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE 'FIXING MISSING INVENTORY DEDUCTIONS';
  RAISE NOTICE 'Date Range: Nov 19-26, 2025';
  RAISE NOTICE '================================';
  RAISE NOTICE '';

  -- Process each affected inventory record
  FOR rec IN
    WITH sales_with_quantities AS (
      SELECT
        oi.product_id,
        o.pickup_location_id,
        oi.quantity as units_in_sale,
        -- Match tier price to get quantity to deduct
        COALESCE(
          (SELECT (tier->>'quantity')::numeric
           FROM jsonb_array_elements(p.pricing_data->'tiers') AS tier
           WHERE (tier->>'price')::numeric = oi.tier_price
           LIMIT 1),
          (SELECT (tier->>'quantity')::numeric
           FROM jsonb_array_elements(p.pricing_data->'tiers') AS tier
           WHERE (tier->>'price')::numeric <= oi.tier_price
           ORDER BY (tier->>'price')::numeric DESC
           LIMIT 1),
          (SELECT (tier->>'quantity')::numeric
           FROM jsonb_array_elements(p.pricing_data->'tiers') AS tier
           ORDER BY (tier->>'quantity')::numeric ASC
           LIMIT 1)
        ) as quantity_per_unit,
        -- Get unit type
        COALESCE(
          (SELECT tier->>'unit'
           FROM jsonb_array_elements(p.pricing_data->'tiers') AS tier
           WHERE (tier->>'price')::numeric = oi.tier_price
           LIMIT 1),
          (SELECT tier->>'unit'
           FROM jsonb_array_elements(p.pricing_data->'tiers') AS tier
           LIMIT 1)
        ) as unit_type
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE oi.created_at >= '2025-11-19'
        AND oi.created_at < '2025-11-27'
        AND oi.inventory_id IS NULL
        AND p.pricing_data IS NOT NULL
    ),
    inventory_impact AS (
      SELECT
        i.id as inventory_id,
        p.id as product_id,
        p.name as product_name,
        l.id as location_id,
        l.name as location_name,
        i.quantity as current_quantity,
        COUNT(*) as num_sales,
        SUM(swq.quantity_per_unit * swq.units_in_sale) as total_to_deduct,
        (SELECT DISTINCT unit_type
         FROM sales_with_quantities swq2
         WHERE swq2.product_id = swq.product_id
         LIMIT 1) as unit_type,
        i.quantity - SUM(swq.quantity_per_unit * swq.units_in_sale) as after_deduction
      FROM sales_with_quantities swq
      JOIN inventory i ON i.product_id = swq.product_id
                      AND i.location_id = swq.pickup_location_id
      JOIN products p ON p.id = swq.product_id
      JOIN locations l ON l.id = i.location_id
      GROUP BY i.id, p.id, p.name, l.id, l.name, i.quantity, swq.product_id
    )
    SELECT * FROM inventory_impact
    ORDER BY after_deduction
  LOOP
    v_total_records := v_total_records + 1;

    -- Determine new quantity (0 if would go negative)
    DECLARE
      v_new_quantity NUMERIC;
      v_went_negative BOOLEAN;
    BEGIN
      IF rec.after_deduction < 0 THEN
        v_new_quantity := 0;
        v_went_negative := TRUE;
        v_negative_count := v_negative_count + 1;

        RAISE NOTICE '⚠️  % - % (%)',
          v_total_records,
          rec.product_name,
          rec.location_name;
        RAISE NOTICE '    Current: % | Deduct: % | Setting to: 0 (would be %)',
          rec.current_quantity,
          rec.total_to_deduct,
          rec.after_deduction;
      ELSE
        v_new_quantity := rec.after_deduction;
        v_went_negative := FALSE;
        v_fixed_count := v_fixed_count + 1;
      END IF;

      -- Update inventory
      UPDATE inventory
      SET
        quantity = v_new_quantity,
        updated_at = NOW()
      WHERE id = rec.inventory_id;

      v_total_deducted := v_total_deducted + rec.total_to_deduct;

      -- Insert audit record
      INSERT INTO inventory_fix_missing_deductions_report (
        inventory_id,
        product_id,
        location_id,
        product_name,
        location_name,
        old_quantity,
        quantity_to_deduct,
        new_quantity,
        num_sales,
        went_negative,
        unit_type
      ) VALUES (
        rec.inventory_id,
        rec.product_id,
        rec.location_id,
        rec.product_name,
        rec.location_name,
        rec.current_quantity,
        rec.total_to_deduct,
        v_new_quantity,
        rec.num_sales,
        v_went_negative,
        rec.unit_type
      );
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE 'FIX COMPLETE';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Total inventory records processed: %', v_total_records;
  RAISE NOTICE 'Successfully fixed (no negatives): %', v_fixed_count;
  RAISE NOTICE 'Set to zero (would go negative): %', v_negative_count;
  RAISE NOTICE 'Total quantity deducted: %', v_total_deducted;
  RAISE NOTICE '';
  RAISE NOTICE 'View audit report:';
  RAISE NOTICE '  SELECT * FROM inventory_fix_missing_deductions_report ORDER BY went_negative DESC, new_quantity;';
  RAISE NOTICE '================================';
END $$;
