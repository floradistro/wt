-- Add age tracking to customer_metrics
-- Each customer gets their calculated age and age bracket for segmentation

-- Add age columns to customer_metrics
ALTER TABLE customer_metrics
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS age_bracket TEXT;

-- Add index for age-based queries
CREATE INDEX IF NOT EXISTS idx_customer_metrics_age_bracket
ON customer_metrics(age_bracket)
WHERE age_bracket IS NOT NULL;

-- Update compute_customer_metrics to include age calculation
CREATE OR REPLACE FUNCTION compute_customer_metrics(p_vendor_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_customer RECORD;
  v_category_counts JSONB;
  v_strain_counts JSONB;
  v_total_items INTEGER;
  v_rfm_segment TEXT;
  v_p90_ltv NUMERIC;
  v_age INTEGER;
  v_age_bracket TEXT;
BEGIN
  -- Get P90 LTV for VIP calculation
  SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total_spent)
  INTO v_p90_ltv
  FROM (
    SELECT c.id, COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE c.vendor_id = p_vendor_id
    GROUP BY c.id
  ) t;

  -- Process each customer
  FOR v_customer IN
    SELECT
      c.id,
      c.vendor_id,
      c.loyalty_points,
      c.date_of_birth,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      COALESCE(AVG(o.total_amount), 0) as avg_order_value,
      MIN(o.created_at) as first_order,
      MAX(o.created_at) as last_order,
      COUNT(DISTINCT CASE WHEN o.order_type = 'pickup' THEN o.id END) as pickup_count,
      COUNT(DISTINCT CASE WHEN o.order_type = 'shipping' THEN o.id END) as shipping_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
    WHERE c.vendor_id = p_vendor_id
    GROUP BY c.id
  LOOP
    -- Calculate age from date_of_birth
    IF v_customer.date_of_birth IS NOT NULL THEN
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_customer.date_of_birth))::INTEGER;
      -- Sanity check: age should be between 18 and 120
      IF v_age < 18 OR v_age > 120 THEN
        v_age := NULL;
        v_age_bracket := NULL;
      ELSE
        v_age_bracket := CASE
          WHEN v_age < 25 THEN '21-24'
          WHEN v_age < 35 THEN '25-34'
          WHEN v_age < 45 THEN '35-44'
          WHEN v_age < 55 THEN '45-54'
          WHEN v_age < 65 THEN '55-64'
          ELSE '65+'
        END;
      END IF;
    ELSE
      v_age := NULL;
      v_age_bracket := NULL;
    END IF;

    -- Calculate category affinities
    SELECT
      COALESCE(jsonb_object_agg(cat_name, pct) FILTER (WHERE cat_name IS NOT NULL), '{}'::jsonb),
      COUNT(*)
    INTO v_category_counts, v_total_items
    FROM (
      SELECT
        COALESCE(cat.name, 'Other') as cat_name,
        ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) as pct
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories cat ON cat.id = p.primary_category_id
      WHERE o.customer_id = v_customer.id
        AND o.status NOT IN ('cancelled', 'refunded')
      GROUP BY COALESCE(cat.name, 'Other')
    ) cat_data;

    -- Calculate strain affinities
    SELECT
      COALESCE(jsonb_object_agg(strain, pct) FILTER (WHERE strain IS NOT NULL), '{}'::jsonb)
    INTO v_strain_counts
    FROM (
      SELECT
        p.custom_fields->>'strain_type' as strain,
        ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) as pct
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE o.customer_id = v_customer.id
        AND o.status NOT IN ('cancelled', 'refunded')
        AND p.custom_fields->>'strain_type' IS NOT NULL
      GROUP BY p.custom_fields->>'strain_type'
    ) strain_data;

    -- Determine RFM segment
    v_rfm_segment := CASE
      WHEN v_customer.order_count = 0 THEN 'No Orders'
      WHEN v_customer.last_order IS NOT NULL AND EXTRACT(DAY FROM NOW() - v_customer.last_order) > 90 THEN
        CASE WHEN v_customer.total_spent > COALESCE(v_p90_ltv, 0) THEN 'Lost Champions' ELSE 'Lost' END
      WHEN v_customer.last_order IS NOT NULL AND EXTRACT(DAY FROM NOW() - v_customer.last_order) > 60 THEN 'At Risk'
      WHEN v_customer.last_order IS NOT NULL AND EXTRACT(DAY FROM NOW() - v_customer.last_order) > 30 THEN 'About to Sleep'
      WHEN v_customer.order_count >= 5 AND v_customer.total_spent > COALESCE(v_p90_ltv, 0) THEN 'Champions'
      WHEN v_customer.order_count >= 3 THEN 'Loyal'
      WHEN v_customer.order_count = 1 THEN 'New'
      ELSE 'Promising'
    END;

    -- Upsert metrics
    INSERT INTO customer_metrics (
      customer_id,
      vendor_id,
      recency_score,
      frequency_score,
      monetary_score,
      rfm_segment,
      total_orders,
      total_spent,
      average_order_value,
      days_since_first_order,
      days_since_last_order,
      order_frequency_days,
      category_affinity,
      strain_affinity,
      preferred_channel,
      pickup_order_count,
      shipping_order_count,
      is_new_customer,
      is_vip_customer,
      is_at_risk,
      is_churned,
      reorder_due,
      age,
      age_bracket,
      computed_at
    )
    VALUES (
      v_customer.id,
      v_customer.vendor_id,
      -- Recency score
      CASE
        WHEN v_customer.last_order IS NULL THEN 1
        WHEN EXTRACT(DAY FROM NOW() - v_customer.last_order) < 14 THEN 5
        WHEN EXTRACT(DAY FROM NOW() - v_customer.last_order) < 30 THEN 4
        WHEN EXTRACT(DAY FROM NOW() - v_customer.last_order) < 60 THEN 3
        WHEN EXTRACT(DAY FROM NOW() - v_customer.last_order) < 90 THEN 2
        ELSE 1
      END,
      -- Frequency score
      CASE
        WHEN v_customer.order_count >= 10 THEN 5
        WHEN v_customer.order_count >= 5 THEN 4
        WHEN v_customer.order_count >= 3 THEN 3
        WHEN v_customer.order_count >= 2 THEN 2
        ELSE 1
      END,
      -- Monetary score
      CASE
        WHEN v_customer.total_spent >= 500 THEN 5
        WHEN v_customer.total_spent >= 250 THEN 4
        WHEN v_customer.total_spent >= 100 THEN 3
        WHEN v_customer.total_spent >= 50 THEN 2
        ELSE 1
      END,
      v_rfm_segment,
      v_customer.order_count,
      v_customer.total_spent,
      v_customer.avg_order_value,
      CASE WHEN v_customer.first_order IS NOT NULL
        THEN EXTRACT(DAY FROM NOW() - v_customer.first_order)::INTEGER
        ELSE NULL
      END,
      CASE WHEN v_customer.last_order IS NOT NULL
        THEN EXTRACT(DAY FROM NOW() - v_customer.last_order)::INTEGER
        ELSE NULL
      END,
      CASE WHEN v_customer.order_count > 1 AND v_customer.first_order IS NOT NULL
        THEN EXTRACT(DAY FROM v_customer.last_order - v_customer.first_order)::NUMERIC / (v_customer.order_count - 1)
        ELSE NULL
      END,
      v_category_counts,
      v_strain_counts,
      CASE
        WHEN v_customer.pickup_count > v_customer.shipping_count THEN 'pickup'
        WHEN v_customer.shipping_count > v_customer.pickup_count THEN 'shipping'
        ELSE 'mixed'
      END,
      v_customer.pickup_count,
      v_customer.shipping_count,
      v_customer.order_count <= 2,
      v_customer.total_spent >= COALESCE(v_p90_ltv, 0),
      v_customer.last_order IS NOT NULL AND EXTRACT(DAY FROM NOW() - v_customer.last_order) BETWEEN 45 AND 90,
      v_customer.last_order IS NOT NULL AND EXTRACT(DAY FROM NOW() - v_customer.last_order) > 90,
      FALSE,
      v_age,
      v_age_bracket,
      NOW()
    )
    ON CONFLICT (customer_id) DO UPDATE SET
      recency_score = EXCLUDED.recency_score,
      frequency_score = EXCLUDED.frequency_score,
      monetary_score = EXCLUDED.monetary_score,
      rfm_segment = EXCLUDED.rfm_segment,
      total_orders = EXCLUDED.total_orders,
      total_spent = EXCLUDED.total_spent,
      average_order_value = EXCLUDED.average_order_value,
      days_since_first_order = EXCLUDED.days_since_first_order,
      days_since_last_order = EXCLUDED.days_since_last_order,
      order_frequency_days = EXCLUDED.order_frequency_days,
      category_affinity = EXCLUDED.category_affinity,
      strain_affinity = EXCLUDED.strain_affinity,
      preferred_channel = EXCLUDED.preferred_channel,
      pickup_order_count = EXCLUDED.pickup_order_count,
      shipping_order_count = EXCLUDED.shipping_order_count,
      is_new_customer = EXCLUDED.is_new_customer,
      is_vip_customer = EXCLUDED.is_vip_customer,
      is_at_risk = EXCLUDED.is_at_risk,
      is_churned = EXCLUDED.is_churned,
      age = EXCLUDED.age,
      age_bracket = EXCLUDED.age_bracket,
      computed_at = NOW(),
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON COLUMN customer_metrics.age IS 'Customer age calculated from date_of_birth';
COMMENT ON COLUMN customer_metrics.age_bracket IS 'Age bracket for segmentation (21-24, 25-34, 35-44, 45-54, 55-64, 65+)';
