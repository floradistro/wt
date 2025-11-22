/**
 * Deal Builder System Migration
 * Steve Jobs-worthy simplicity for creating campaigns/promotions
 *
 * Tables:
 * - deals: Main deal configuration
 * - deal_usage: Track deal redemptions
 */

-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- Discount configuration
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'bogo')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),

  -- Targeting
  apply_to TEXT NOT NULL CHECK (apply_to IN ('all', 'categories', 'products')),
  apply_to_ids UUID[] DEFAULT '{}',

  -- Location scope
  location_scope TEXT NOT NULL CHECK (location_scope IN ('all', 'specific')),
  location_ids UUID[] DEFAULT '{}',

  -- Scheduling
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('always', 'date_range', 'recurring')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  recurring_pattern JSONB, -- {days: [0-6], start_time: "16:00", end_time: "18:00"}

  -- Application method
  application_method TEXT NOT NULL CHECK (application_method IN ('auto', 'manual', 'code')),
  coupon_code TEXT UNIQUE,

  -- Visual
  badge_text TEXT,
  badge_color TEXT,

  -- Usage limits
  max_uses_per_customer INTEGER,
  max_total_uses INTEGER,
  current_uses INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create deal_usage table to track redemptions
CREATE TABLE IF NOT EXISTS deal_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  discount_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_vendor_id ON deals(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deals_vendor_active ON deals(vendor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_deals_coupon_code ON deals(coupon_code) WHERE coupon_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_application_method ON deals(vendor_id, application_method) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_deal_usage_deal_id ON deal_usage(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_usage_order_id ON deal_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_deal_usage_customer_id ON deal_usage(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_usage_created_at ON deal_usage(created_at);

-- RLS Policies
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_usage ENABLE ROW LEVEL SECURITY;

-- Vendors can manage their own deals
CREATE POLICY "Vendors can view their own deals"
  ON deals FOR SELECT
  USING (vendor_id = auth.uid() OR vendor_id IN (
    SELECT vendor_id FROM vendor_employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Vendors can create deals"
  ON deals FOR INSERT
  WITH CHECK (vendor_id = auth.uid() OR vendor_id IN (
    SELECT vendor_id FROM vendor_employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Vendors can update their own deals"
  ON deals FOR UPDATE
  USING (vendor_id = auth.uid() OR vendor_id IN (
    SELECT vendor_id FROM vendor_employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "Vendors can delete their own deals"
  ON deals FOR DELETE
  USING (vendor_id = auth.uid() OR vendor_id IN (
    SELECT vendor_id FROM vendor_employees WHERE user_id = auth.uid()
  ));

-- Deal usage policies
CREATE POLICY "Vendors can view their deal usage"
  ON deal_usage FOR SELECT
  USING (deal_id IN (
    SELECT id FROM deals WHERE vendor_id = auth.uid() OR vendor_id IN (
      SELECT vendor_id FROM vendor_employees WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "System can create deal usage"
  ON deal_usage FOR INSERT
  WITH CHECK (true); -- Service role will handle this

-- Function to check if a deal is currently active
CREATE OR REPLACE FUNCTION is_deal_active(deal_row deals)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if deal is marked active
  IF NOT deal_row.is_active THEN
    RETURN false;
  END IF;

  -- Check date range if applicable
  IF deal_row.schedule_type = 'date_range' THEN
    IF deal_row.start_date IS NOT NULL AND NOW() < deal_row.start_date THEN
      RETURN false;
    END IF;
    IF deal_row.end_date IS NOT NULL AND NOW() > deal_row.end_date THEN
      RETURN false;
    END IF;
  END IF;

  -- Check usage limits
  IF deal_row.max_total_uses IS NOT NULL AND deal_row.current_uses >= deal_row.max_total_uses THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to apply deal to cart items
CREATE OR REPLACE FUNCTION calculate_deal_discount(
  p_deal_id UUID,
  p_product_id UUID,
  p_category_id UUID,
  p_item_price NUMERIC,
  p_quantity INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
  v_deal deals;
  v_discount NUMERIC := 0;
BEGIN
  -- Get deal
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;

  IF NOT FOUND OR NOT is_deal_active(v_deal) THEN
    RETURN 0;
  END IF;

  -- Check if deal applies to this product
  IF v_deal.apply_to = 'all' THEN
    -- Applies to all products
  ELSIF v_deal.apply_to = 'categories' THEN
    IF p_category_id IS NULL OR NOT (p_category_id = ANY(v_deal.apply_to_ids)) THEN
      RETURN 0;
    END IF;
  ELSIF v_deal.apply_to = 'products' THEN
    IF NOT (p_product_id = ANY(v_deal.apply_to_ids)) THEN
      RETURN 0;
    END IF;
  END IF;

  -- Calculate discount
  IF v_deal.discount_type = 'percentage' THEN
    v_discount := (p_item_price * p_quantity) * (v_deal.discount_value / 100.0);
  ELSIF v_deal.discount_type = 'fixed' THEN
    v_discount := v_deal.discount_value * p_quantity;
  END IF;

  -- Ensure discount doesn't exceed item price
  v_discount := LEAST(v_discount, p_item_price * p_quantity);

  RETURN v_discount;
END;
$$ LANGUAGE plpgsql;

-- Comment on tables
COMMENT ON TABLE deals IS 'Deal/promotion configurations - Steve Jobs simple deal builder';
COMMENT ON TABLE deal_usage IS 'Track deal redemptions for analytics and usage limits';
