-- ============================================================================
-- Customer Intelligence System
-- AI-Powered Marketing Segmentation & Targeting
--
-- This migration creates the infrastructure for:
-- 1. Customer Metrics - RFM scores, product affinities, behavioral patterns
-- 2. Enhanced Segments - Dynamic rule-based audience targeting
-- 3. AI Campaign Optimization - Data for personalized marketing
-- ============================================================================

-- ===========================================
-- CUSTOMER METRICS TABLE
-- Pre-computed analytics for fast segmentation
-- ===========================================
CREATE TABLE IF NOT EXISTS customer_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- ==================
  -- RFM SCORING (1-5 scale, 5 = best)
  -- ==================
  recency_score INTEGER CHECK (recency_score BETWEEN 1 AND 5),
  frequency_score INTEGER CHECK (frequency_score BETWEEN 1 AND 5),
  monetary_score INTEGER CHECK (monetary_score BETWEEN 1 AND 5),
  rfm_segment TEXT, -- e.g., "Champions", "At Risk", "Lost"

  -- ==================
  -- CORE METRICS
  -- ==================
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0,
  average_order_value NUMERIC(10, 2) DEFAULT 0,
  days_since_first_order INTEGER,
  days_since_last_order INTEGER,
  order_frequency_days NUMERIC(8, 2), -- Avg days between orders

  -- ==================
  -- PRODUCT AFFINITIES (JSON for flexibility)
  -- ==================
  category_affinity JSONB DEFAULT '{}', -- {"Flower": 0.7, "Edibles": 0.2, "Concentrates": 0.1}
  strain_affinity JSONB DEFAULT '{}',   -- {"Indica": 0.6, "Hybrid": 0.3, "Sativa": 0.1}
  effect_affinity JSONB DEFAULT '{}',   -- {"Relaxed": 0.8, "Euphoric": 0.5, "Focused": 0.3}
  potency_preference TEXT,              -- "low", "medium", "high", "very_high"
  price_tier_preference TEXT,           -- "budget", "mid", "premium"
  size_preference TEXT,                 -- "small", "medium", "large" (3.5g, 7g, 14g+)

  -- ==================
  -- CHANNEL BEHAVIOR
  -- ==================
  preferred_channel TEXT,               -- "pickup", "shipping", "mixed"
  preferred_location_id UUID,           -- Most frequent pickup location
  pickup_order_count INTEGER DEFAULT 0,
  shipping_order_count INTEGER DEFAULT 0,

  -- ==================
  -- ENGAGEMENT METRICS
  -- ==================
  email_open_rate NUMERIC(5, 4),        -- 0.0000 to 1.0000
  email_click_rate NUMERIC(5, 4),
  campaigns_received INTEGER DEFAULT 0,
  last_email_opened_at TIMESTAMPTZ,

  -- ==================
  -- BEHAVIORAL SIGNALS
  -- ==================
  is_new_customer BOOLEAN DEFAULT TRUE, -- <2 orders
  is_vip_customer BOOLEAN DEFAULT FALSE, -- Top 10% by LTV
  is_at_risk BOOLEAN DEFAULT FALSE,      -- No order in 45+ days
  is_churned BOOLEAN DEFAULT FALSE,      -- No order in 90+ days
  reorder_due BOOLEAN DEFAULT FALSE,     -- Based on avg frequency

  -- ==================
  -- AI TARGETING TAGS (computed by AI)
  -- ==================
  ai_tags JSONB DEFAULT '[]',           -- ["deal_seeker", "quality_buyer", "bulk_buyer"]
  ai_next_best_action TEXT,             -- "reorder_reminder", "upsell_flower", "win_back"
  ai_predicted_ltv NUMERIC(10, 2),      -- Predicted lifetime value
  ai_churn_risk NUMERIC(5, 4),          -- 0-1 probability

  -- ==================
  -- METADATA
  -- ==================
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id)
);

-- Indexes for fast segment queries
CREATE INDEX IF NOT EXISTS idx_customer_metrics_vendor ON customer_metrics(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_rfm ON customer_metrics(rfm_segment);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_recency ON customer_metrics(days_since_last_order);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_ltv ON customer_metrics(total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_channel ON customer_metrics(preferred_channel);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_at_risk ON customer_metrics(is_at_risk) WHERE is_at_risk = TRUE;
CREATE INDEX IF NOT EXISTS idx_customer_metrics_vip ON customer_metrics(is_vip_customer) WHERE is_vip_customer = TRUE;

-- GIN index for JSONB affinity queries
CREATE INDEX IF NOT EXISTS idx_customer_metrics_category_aff ON customer_metrics USING GIN (category_affinity);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_strain_aff ON customer_metrics USING GIN (strain_affinity);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_ai_tags ON customer_metrics USING GIN (ai_tags);

-- ===========================================
-- ENHANCED CUSTOMER SEGMENTS
-- Add new columns to existing table
-- Existing columns: id, vendor_id, name, description, segment_rules, customer_count,
--                   last_calculated_at, is_dynamic, created_at, updated_at, type, filter_criteria
-- ===========================================
ALTER TABLE customer_segments
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

ALTER TABLE customer_segments
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366F1',
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'people-outline',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_refresh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS refresh_interval_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_description TEXT,
ADD COLUMN IF NOT EXISTS targeting_tips JSONB DEFAULT '[]';

-- ===========================================
-- SEGMENT MEMBERSHIP TABLE
-- Tracks which customers are in which segments
-- ===========================================
CREATE TABLE IF NOT EXISTS customer_segment_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Membership metadata
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by TEXT DEFAULT 'system', -- 'system', 'ai', 'manual'
  match_score NUMERIC(5, 4), -- How well they match (0-1)

  UNIQUE(segment_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_membership_segment ON customer_segment_memberships(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_membership_customer ON customer_segment_memberships(customer_id);

-- ===========================================
-- ENHANCED SYSTEM SEGMENTS
-- Pre-built segments for common use cases
-- Uses existing columns: segment_rules (NOT NULL), filter_criteria, is_dynamic, type
-- Plus new columns: is_system, priority, color, icon
-- ===========================================

-- RFM-based segments
INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Champions',
  'Best customers - high recency, frequency, and spend. Reward them!',
  '{"type": "rfm", "segments": ["Champions"]}',
  '{"type": "rfm", "segments": ["Champions"]}',
  true,
  true,
  100,
  '#10B981',
  'trophy-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Champions'
);

INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'At Risk',
  'Previously good customers who haven''t ordered recently. Win them back!',
  '{"type": "rfm", "segments": ["At Risk", "About to Sleep"]}',
  '{"type": "rfm", "segments": ["At Risk", "About to Sleep"]}',
  true,
  true,
  90,
  '#F59E0B',
  'warning-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'At Risk'
);

-- Product affinity segments
INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Indica Lovers',
  'Customers who prefer Indica strains',
  '{"type": "strain_affinity", "strain": "Indica", "min_affinity": 0.5}',
  '{"type": "strain_affinity", "strain": "Indica", "min_affinity": 0.5}',
  true,
  true,
  50,
  '#8B5CF6',
  'moon-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Indica Lovers'
);

INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Sativa Lovers',
  'Customers who prefer Sativa strains',
  '{"type": "strain_affinity", "strain": "Sativa", "min_affinity": 0.5}',
  '{"type": "strain_affinity", "strain": "Sativa", "min_affinity": 0.5}',
  true,
  true,
  50,
  '#F97316',
  'sunny-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Sativa Lovers'
);

INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Flower Enthusiasts',
  'Customers who primarily buy flower products',
  '{"type": "category_affinity", "category": "Flower", "min_affinity": 0.6}',
  '{"type": "category_affinity", "category": "Flower", "min_affinity": 0.6}',
  true,
  true,
  50,
  '#22C55E',
  'leaf-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Flower Enthusiasts'
);

INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Edibles Fans',
  'Customers who frequently buy edibles',
  '{"type": "category_affinity", "category": "Edibles", "min_affinity": 0.4}',
  '{"type": "category_affinity", "category": "Edibles", "min_affinity": 0.4}',
  true,
  true,
  50,
  '#EC4899',
  'nutrition-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Edibles Fans'
);

-- Channel-based segments
INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Pickup Regulars',
  'Customers who prefer in-store pickup',
  '{"type": "channel", "channel": "pickup"}',
  '{"type": "channel", "channel": "pickup"}',
  true,
  true,
  40,
  '#0EA5E9',
  'storefront-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Pickup Regulars'
);

INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Shipping Customers',
  'Customers who order for delivery',
  '{"type": "channel", "channel": "shipping"}',
  '{"type": "channel", "channel": "shipping"}',
  true,
  true,
  40,
  '#6366F1',
  'cube-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Shipping Customers'
);

-- Value-based segments
INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'VIP Customers',
  'Top 10% of customers by lifetime value',
  '{"type": "vip", "percentile": 90}',
  '{"type": "vip", "percentile": 90}',
  true,
  true,
  95,
  '#EAB308',
  'star-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'VIP Customers'
);

INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'High Potency Seekers',
  'Customers who prefer high THCa products (25%+)',
  '{"type": "potency", "preference": "high"}',
  '{"type": "potency", "preference": "high"}',
  true,
  true,
  45,
  '#DC2626',
  'flame-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'High Potency Seekers'
);

-- Behavioral segments
INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'Due for Reorder',
  'Customers past their typical order cycle',
  '{"type": "reorder_due"}',
  '{"type": "reorder_due"}',
  true,
  true,
  85,
  '#14B8A6',
  'refresh-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'Due for Reorder'
);

INSERT INTO customer_segments (vendor_id, name, description, segment_rules, filter_criteria, is_dynamic, is_system, priority, color, icon)
SELECT
  v.id,
  'New Customers',
  'Customers with 1-2 orders (nurture them!)',
  '{"type": "new_customer"}',
  '{"type": "new_customer"}',
  true,
  true,
  60,
  '#06B6D4',
  'person-add-outline'
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs WHERE cs.vendor_id = v.id AND cs.name = 'New Customers'
);

-- ===========================================
-- RLS POLICIES
-- ===========================================
ALTER TABLE customer_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segment_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view their customer metrics"
  ON customer_metrics
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage customer metrics"
  ON customer_metrics
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Vendors can view segment memberships"
  ON customer_segment_memberships
  FOR SELECT
  USING (
    segment_id IN (
      SELECT id FROM customer_segments WHERE vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can manage segment memberships"
  ON customer_segment_memberships
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ===========================================
-- FUNCTION: Compute Customer Metrics
-- Called periodically to refresh all metrics
-- ===========================================
CREATE OR REPLACE FUNCTION compute_customer_metrics(p_vendor_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_customer RECORD;
  v_metrics RECORD;
  v_orders RECORD;
  v_category_counts JSONB;
  v_strain_counts JSONB;
  v_total_items INTEGER;
  v_rfm_segment TEXT;
  v_p90_ltv NUMERIC;
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
    -- Calculate category and strain affinities
    SELECT
      COALESCE(jsonb_object_agg(cat, ROUND((cat_count::numeric / NULLIF(total, 0))::numeric, 2)), '{}'),
      COALESCE(jsonb_object_agg(strain, ROUND((strain_count::numeric / NULLIF(total, 0))::numeric, 2)), '{}'),
      total
    INTO v_category_counts, v_strain_counts, v_total_items
    FROM (
      SELECT
        cat.name as cat,
        COUNT(*) as cat_count,
        p.custom_fields->>'strain_type' as strain,
        COUNT(*) as strain_count,
        SUM(COUNT(*)) OVER () as total
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN categories cat ON cat.id = p.primary_category_id
      WHERE o.customer_id = v_customer.id
        AND o.status NOT IN ('cancelled', 'refunded')
      GROUP BY cat.name, p.custom_fields->>'strain_type'
    ) t
    GROUP BY total;

    -- Calculate RFM scores (1-5)
    -- Recency: 1=90+ days, 2=60-89, 3=30-59, 4=14-29, 5=<14
    -- Frequency: Based on order count quintiles
    -- Monetary: Based on total spend quintiles

    -- Determine RFM segment
    v_rfm_segment := CASE
      WHEN v_customer.order_count = 0 THEN 'No Orders'
      WHEN EXTRACT(DAY FROM NOW() - v_customer.last_order) > 90 THEN
        CASE WHEN v_customer.total_spent > v_p90_ltv THEN 'Lost Champions' ELSE 'Lost' END
      WHEN EXTRACT(DAY FROM NOW() - v_customer.last_order) > 60 THEN 'At Risk'
      WHEN EXTRACT(DAY FROM NOW() - v_customer.last_order) > 30 THEN 'About to Sleep'
      WHEN v_customer.order_count >= 5 AND v_customer.total_spent > v_p90_ltv THEN 'Champions'
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
      -- Frequency score (simplified)
      CASE
        WHEN v_customer.order_count >= 10 THEN 5
        WHEN v_customer.order_count >= 5 THEN 4
        WHEN v_customer.order_count >= 3 THEN 3
        WHEN v_customer.order_count >= 2 THEN 2
        ELSE 1
      END,
      -- Monetary score (simplified)
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
      COALESCE(v_category_counts, '{}'),
      COALESCE(v_strain_counts, '{}'),
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
      FALSE, -- reorder_due calculated separately
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
      computed_at = NOW(),
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCTION: Get Segment Customers
-- Returns customers matching a segment's criteria
-- ===========================================
CREATE OR REPLACE FUNCTION get_segment_customers(p_segment_id UUID)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  email TEXT,
  match_score NUMERIC
) AS $$
DECLARE
  v_segment RECORD;
  v_criteria JSONB;
BEGIN
  -- Get segment details
  SELECT * INTO v_segment FROM customer_segments WHERE id = p_segment_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_criteria := v_segment.filter_criteria;

  -- Return based on criteria type
  RETURN QUERY
  SELECT
    c.id,
    (c.first_name || ' ' || c.last_name)::TEXT,
    c.email,
    1.0::NUMERIC as match_score
  FROM customers c
  JOIN customer_metrics cm ON cm.customer_id = c.id
  WHERE c.vendor_id = v_segment.vendor_id
    AND c.email IS NOT NULL
    AND c.is_active = TRUE
    AND (
      -- All customers
      (v_criteria->>'type' = 'all')

      -- RFM segment
      OR (v_criteria->>'type' = 'rfm' AND cm.rfm_segment = ANY(SELECT jsonb_array_elements_text(v_criteria->'segments')))

      -- Strain affinity
      OR (v_criteria->>'type' = 'strain_affinity'
          AND (cm.strain_affinity->>COALESCE(v_criteria->>'strain', 'Indica'))::NUMERIC >= COALESCE((v_criteria->>'min_affinity')::NUMERIC, 0.5))

      -- Category affinity
      OR (v_criteria->>'type' = 'category_affinity'
          AND (cm.category_affinity->>COALESCE(v_criteria->>'category', 'Flower'))::NUMERIC >= COALESCE((v_criteria->>'min_affinity')::NUMERIC, 0.5))

      -- Channel preference
      OR (v_criteria->>'type' = 'channel' AND cm.preferred_channel = v_criteria->>'channel')

      -- VIP (top percentile)
      OR (v_criteria->>'type' = 'vip' AND cm.is_vip_customer = TRUE)

      -- New customer
      OR (v_criteria->>'type' = 'new_customer' AND cm.is_new_customer = TRUE)

      -- Reorder due
      OR (v_criteria->>'type' = 'reorder_due' AND cm.reorder_due = TRUE)

      -- At risk
      OR (v_criteria->>'type' = 'at_risk' AND cm.is_at_risk = TRUE)

      -- Loyalty points
      OR (v_criteria->>'type' = 'loyalty' AND c.loyalty_points >= COALESCE((v_criteria->>'min_points')::INTEGER, 0))

      -- Recent order
      OR (v_criteria->>'type' = 'recent_order' AND cm.days_since_last_order <= COALESCE((v_criteria->>'days')::INTEGER, 30))

      -- Inactive
      OR (v_criteria->>'type' = 'inactive' AND cm.days_since_last_order >= COALESCE((v_criteria->>'days')::INTEGER, 90))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCTION: Refresh Segment Count
-- Updates the cached customer count for a segment
-- ===========================================
CREATE OR REPLACE FUNCTION refresh_segment_count(p_segment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM get_segment_customers(p_segment_id);

  UPDATE customer_segments
  SET customer_count = v_count,
      last_count_at = NOW(),
      last_refreshed_at = NOW()
  WHERE id = p_segment_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Enable realtime for metrics
-- ===========================================
ALTER PUBLICATION supabase_realtime ADD TABLE customer_metrics;

COMMENT ON TABLE customer_metrics IS 'Pre-computed customer analytics for AI-powered marketing segmentation';
COMMENT ON TABLE customer_segment_memberships IS 'Tracks which customers belong to which segments for fast queries';
COMMENT ON FUNCTION compute_customer_metrics IS 'Computes all customer metrics for a vendor - run periodically';
COMMENT ON FUNCTION get_segment_customers IS 'Returns all customers matching a segment criteria';
