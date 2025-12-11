/**
 * Affiliate Marketing System
 *
 * Enables vendors to create affiliate programs where external partners
 * can promote products and earn commission on sales they generate.
 *
 * Key features:
 * - Affiliate registration and management
 * - Unique referral codes/links
 * - Click and conversion tracking
 * - Commission calculation (percentage-based)
 * - Payout management
 */

-- ============================================
-- AFFILIATES TABLE
-- Core affiliate information
-- ============================================
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Affiliate identity
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  website_url TEXT,

  -- Authentication (for web portal)
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  password_hash TEXT, -- For standalone auth if not using Supabase auth

  -- Referral tracking
  referral_code TEXT NOT NULL, -- Unique code like "JOHN20"
  referral_link TEXT, -- Full URL with tracking params

  -- Commission settings
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- Percentage (e.g., 10.00 = 10%)

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'terminated')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  -- Metrics (denormalized for performance)
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_commission_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_commission_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  pending_commission DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Payment info
  payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'paypal', 'check', 'venmo', 'other')),
  payment_details JSONB DEFAULT '{}', -- Bank account, PayPal email, etc.
  minimum_payout DECIMAL(10,2) NOT NULL DEFAULT 50.00,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_vendor_email UNIQUE(vendor_id, email),
  CONSTRAINT unique_vendor_referral_code UNIQUE(vendor_id, referral_code)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_affiliates_vendor_id ON affiliates(vendor_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_auth_user_id ON affiliates(auth_user_id);

-- ============================================
-- AFFILIATE CLICKS TABLE
-- Track every click on affiliate links
-- ============================================
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Tracking
  ip_address INET,
  user_agent TEXT,
  referrer_url TEXT,
  landing_page TEXT,

  -- Attribution
  session_id TEXT, -- For linking to orders
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Timestamps
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_id ON affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_vendor_id ON affiliate_clicks(vendor_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_session_id ON affiliate_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_clicked_at ON affiliate_clicks(clicked_at);

-- ============================================
-- AFFILIATE CONVERSIONS TABLE
-- Track successful sales from affiliates
-- ============================================
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  click_id UUID REFERENCES affiliate_clicks(id) ON DELETE SET NULL,

  -- Order details (snapshot at conversion time)
  order_total DECIMAL(12,2) NOT NULL,
  order_subtotal DECIMAL(12,2) NOT NULL, -- Before tax/shipping

  -- Commission calculation
  commission_rate DECIMAL(5,2) NOT NULL, -- Rate at time of conversion
  commission_amount DECIMAL(12,2) NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  -- Payout tracking
  payout_id UUID, -- Links to affiliate_payouts when paid
  paid_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate conversions for same order
  CONSTRAINT unique_order_conversion UNIQUE(order_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_affiliate_id ON affiliate_conversions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_vendor_id ON affiliate_conversions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_status ON affiliate_conversions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_created_at ON affiliate_conversions(created_at);

-- ============================================
-- AFFILIATE PAYOUTS TABLE
-- Track commission payouts to affiliates
-- ============================================
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Payout details
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_reference TEXT, -- Transaction ID, check number, etc.

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  failure_reason TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_vendor_id ON affiliate_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_vendor_id UUID, p_base_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_suffix INTEGER := 0;
  v_exists BOOLEAN;
BEGIN
  -- Clean and uppercase the base name
  v_code := UPPER(REGEXP_REPLACE(p_base_name, '[^A-Za-z0-9]', '', 'g'));

  -- Truncate to 10 chars
  v_code := LEFT(v_code, 10);

  -- Check if exists, add suffix if needed
  LOOP
    IF v_suffix = 0 THEN
      SELECT EXISTS(
        SELECT 1 FROM affiliates
        WHERE vendor_id = p_vendor_id AND referral_code = v_code
      ) INTO v_exists;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM affiliates
        WHERE vendor_id = p_vendor_id AND referral_code = v_code || v_suffix::TEXT
      ) INTO v_exists;
      v_code := LEFT(v_code, 10) || v_suffix::TEXT;
    END IF;

    EXIT WHEN NOT v_exists;
    v_suffix := v_suffix + 1;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Record affiliate click
CREATE OR REPLACE FUNCTION record_affiliate_click(
  p_referral_code TEXT,
  p_vendor_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL,
  p_landing_page TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_affiliate_id UUID;
  v_click_id UUID;
BEGIN
  -- Find affiliate by code
  SELECT id INTO v_affiliate_id
  FROM affiliates
  WHERE vendor_id = p_vendor_id
    AND referral_code = UPPER(p_referral_code)
    AND status = 'active';

  IF v_affiliate_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Insert click record
  INSERT INTO affiliate_clicks (
    affiliate_id, vendor_id, ip_address, user_agent,
    referrer_url, landing_page, session_id
  ) VALUES (
    v_affiliate_id, p_vendor_id, p_ip_address, p_user_agent,
    p_referrer_url, p_landing_page, p_session_id
  )
  RETURNING id INTO v_click_id;

  -- Update affiliate click count
  UPDATE affiliates
  SET total_clicks = total_clicks + 1,
      updated_at = NOW()
  WHERE id = v_affiliate_id;

  RETURN v_click_id;
END;
$$ LANGUAGE plpgsql;

-- Record affiliate conversion (called when order is completed)
CREATE OR REPLACE FUNCTION record_affiliate_conversion(
  p_order_id UUID,
  p_session_id TEXT DEFAULT NULL,
  p_referral_code TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order RECORD;
  v_affiliate_id UUID;
  v_click_id UUID;
  v_commission_rate DECIMAL(5,2);
  v_commission_amount DECIMAL(12,2);
  v_conversion_id UUID;
BEGIN
  -- Get order details
  SELECT id, vendor_id, subtotal, total
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if already converted
  IF EXISTS (SELECT 1 FROM affiliate_conversions WHERE order_id = p_order_id) THEN
    RETURN NULL;
  END IF;

  -- Find affiliate by session_id (click tracking) or direct referral code
  IF p_session_id IS NOT NULL THEN
    SELECT ac.affiliate_id, ac.id, a.commission_rate
    INTO v_affiliate_id, v_click_id, v_commission_rate
    FROM affiliate_clicks ac
    JOIN affiliates a ON a.id = ac.affiliate_id
    WHERE ac.session_id = p_session_id
      AND ac.vendor_id = v_order.vendor_id
      AND a.status = 'active'
      AND ac.converted = FALSE
    ORDER BY ac.clicked_at DESC
    LIMIT 1;
  END IF;

  -- Fallback to referral code if no session match
  IF v_affiliate_id IS NULL AND p_referral_code IS NOT NULL THEN
    SELECT id, commission_rate
    INTO v_affiliate_id, v_commission_rate
    FROM affiliates
    WHERE vendor_id = v_order.vendor_id
      AND referral_code = UPPER(p_referral_code)
      AND status = 'active';
  END IF;

  IF v_affiliate_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate commission (on subtotal, not including tax/shipping)
  v_commission_amount := ROUND((COALESCE(v_order.subtotal, v_order.total) * v_commission_rate / 100), 2);

  -- Create conversion record
  INSERT INTO affiliate_conversions (
    affiliate_id, vendor_id, order_id, click_id,
    order_total, order_subtotal, commission_rate, commission_amount
  ) VALUES (
    v_affiliate_id, v_order.vendor_id, p_order_id, v_click_id,
    v_order.total, COALESCE(v_order.subtotal, v_order.total),
    v_commission_rate, v_commission_amount
  )
  RETURNING id INTO v_conversion_id;

  -- Update click as converted
  IF v_click_id IS NOT NULL THEN
    UPDATE affiliate_clicks
    SET converted = TRUE,
        converted_at = NOW(),
        order_id = p_order_id
    WHERE id = v_click_id;
  END IF;

  -- Update affiliate metrics
  UPDATE affiliates
  SET total_orders = total_orders + 1,
      total_revenue = total_revenue + v_order.total,
      total_commission_earned = total_commission_earned + v_commission_amount,
      pending_commission = pending_commission + v_commission_amount,
      updated_at = NOW()
  WHERE id = v_affiliate_id;

  RETURN v_conversion_id;
END;
$$ LANGUAGE plpgsql;

-- Approve conversion
CREATE OR REPLACE FUNCTION approve_affiliate_conversion(
  p_conversion_id UUID,
  p_approved_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE affiliate_conversions
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = p_approved_by,
      updated_at = NOW()
  WHERE id = p_conversion_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Reject conversion
CREATE OR REPLACE FUNCTION reject_affiliate_conversion(
  p_conversion_id UUID,
  p_approved_by UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_conversion RECORD;
BEGIN
  SELECT * INTO v_conversion
  FROM affiliate_conversions
  WHERE id = p_conversion_id AND status = 'pending';

  IF v_conversion IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update conversion status
  UPDATE affiliate_conversions
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = p_approved_by,
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_conversion_id;

  -- Reduce pending commission
  UPDATE affiliates
  SET pending_commission = pending_commission - v_conversion.commission_amount,
      total_commission_earned = total_commission_earned - v_conversion.commission_amount,
      updated_at = NOW()
  WHERE id = v_conversion.affiliate_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create payout
CREATE OR REPLACE FUNCTION create_affiliate_payout(
  p_affiliate_id UUID,
  p_processed_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_affiliate RECORD;
  v_payout_amount DECIMAL(12,2);
  v_payout_id UUID;
BEGIN
  -- Get affiliate details
  SELECT * INTO v_affiliate
  FROM affiliates
  WHERE id = p_affiliate_id;

  IF v_affiliate IS NULL THEN
    RAISE EXCEPTION 'Affiliate not found';
  END IF;

  -- Calculate payout amount (approved conversions not yet paid)
  SELECT COALESCE(SUM(commission_amount), 0)
  INTO v_payout_amount
  FROM affiliate_conversions
  WHERE affiliate_id = p_affiliate_id
    AND status = 'approved'
    AND payout_id IS NULL;

  IF v_payout_amount < v_affiliate.minimum_payout THEN
    RAISE EXCEPTION 'Payout amount (%) is below minimum (%)', v_payout_amount, v_affiliate.minimum_payout;
  END IF;

  -- Create payout record
  INSERT INTO affiliate_payouts (
    affiliate_id, vendor_id, amount, payment_method, status
  ) VALUES (
    p_affiliate_id, v_affiliate.vendor_id, v_payout_amount,
    v_affiliate.payment_method, 'pending'
  )
  RETURNING id INTO v_payout_id;

  -- Link conversions to payout
  UPDATE affiliate_conversions
  SET payout_id = v_payout_id,
      updated_at = NOW()
  WHERE affiliate_id = p_affiliate_id
    AND status = 'approved'
    AND payout_id IS NULL;

  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql;

-- Complete payout
CREATE OR REPLACE FUNCTION complete_affiliate_payout(
  p_payout_id UUID,
  p_processed_by UUID,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_payout RECORD;
BEGIN
  SELECT * INTO v_payout
  FROM affiliate_payouts
  WHERE id = p_payout_id AND status IN ('pending', 'processing');

  IF v_payout IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update payout status
  UPDATE affiliate_payouts
  SET status = 'completed',
      processed_at = NOW(),
      processed_by = p_processed_by,
      payment_reference = COALESCE(p_payment_reference, payment_reference),
      updated_at = NOW()
  WHERE id = p_payout_id;

  -- Update conversion statuses
  UPDATE affiliate_conversions
  SET status = 'paid',
      paid_at = NOW(),
      updated_at = NOW()
  WHERE payout_id = p_payout_id;

  -- Update affiliate metrics
  UPDATE affiliates
  SET total_commission_paid = total_commission_paid + v_payout.amount,
      pending_commission = pending_commission - v_payout.amount,
      updated_at = NOW()
  WHERE id = v_payout.affiliate_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Affiliates: Vendors can manage their affiliates
CREATE POLICY affiliates_vendor_access ON affiliates
  FOR ALL
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Affiliates can view their own record
CREATE POLICY affiliates_self_access ON affiliates
  FOR SELECT
  USING (auth_user_id = auth.uid());

-- Clicks: Vendors can view clicks
CREATE POLICY affiliate_clicks_vendor_access ON affiliate_clicks
  FOR ALL
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Conversions: Vendors can manage conversions
CREATE POLICY affiliate_conversions_vendor_access ON affiliate_conversions
  FOR ALL
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Affiliates can view their conversions
CREATE POLICY affiliate_conversions_affiliate_access ON affiliate_conversions
  FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE auth_user_id = auth.uid()
    )
  );

-- Payouts: Vendors can manage payouts
CREATE POLICY affiliate_payouts_vendor_access ON affiliate_payouts
  FOR ALL
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Affiliates can view their payouts
CREATE POLICY affiliate_payouts_affiliate_access ON affiliate_payouts
  FOR SELECT
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_affiliate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_updated_at();

CREATE TRIGGER affiliate_conversions_updated_at
  BEFORE UPDATE ON affiliate_conversions
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_updated_at();

CREATE TRIGGER affiliate_payouts_updated_at
  BEFORE UPDATE ON affiliate_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_updated_at();

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE affiliates;
ALTER PUBLICATION supabase_realtime ADD TABLE affiliate_conversions;
ALTER PUBLICATION supabase_realtime ADD TABLE affiliate_payouts;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE affiliates IS 'Affiliate partners who promote products and earn commission';
COMMENT ON TABLE affiliate_clicks IS 'Track clicks on affiliate referral links';
COMMENT ON TABLE affiliate_conversions IS 'Track sales attributed to affiliates';
COMMENT ON TABLE affiliate_payouts IS 'Commission payouts to affiliates';
