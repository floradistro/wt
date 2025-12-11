/**
 * Affiliate Checkout Integration
 *
 * Adds customer discount rate to affiliates (separate from commission rate)
 * and integrates affiliate codes into the checkout flow.
 *
 * Each affiliate can have:
 * - commission_rate: What the affiliate earns (e.g., 10%)
 * - customer_discount_rate: What discount the customer gets (e.g., 5%, or 0 for no discount)
 */

-- ============================================
-- ADD CUSTOMER DISCOUNT RATE TO AFFILIATES
-- ============================================

-- Add customer discount rate (what discount the customer gets when using this code)
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS customer_discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Add discount type (percentage or fixed amount)
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS customer_discount_type TEXT NOT NULL DEFAULT 'percentage'
  CHECK (customer_discount_type IN ('percentage', 'fixed'));

-- Add constraint to ensure discount is not negative
ALTER TABLE affiliates
  ADD CONSTRAINT check_customer_discount_rate_positive
  CHECK (customer_discount_rate >= 0);

-- Comment for clarity
COMMENT ON COLUMN affiliates.customer_discount_rate IS 'Discount given to customer when using this affiliate code (0 = no discount)';
COMMENT ON COLUMN affiliates.customer_discount_type IS 'Type of discount: percentage (e.g., 10% off) or fixed (e.g., $5 off)';

-- ============================================
-- ADD AFFILIATE TRACKING TO ORDERS
-- ============================================

-- Add affiliate_id to orders for tracking which affiliate referred the sale
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;

-- Add affiliate_code to orders (stored for historical reference)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS affiliate_code TEXT;

-- Add affiliate discount amount applied
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS affiliate_discount_amount DECIMAL(12,2) DEFAULT 0;

-- Index for finding orders by affiliate
CREATE INDEX IF NOT EXISTS idx_orders_affiliate_id ON orders(affiliate_id) WHERE affiliate_id IS NOT NULL;

-- ============================================
-- FUNCTION: Validate Affiliate Code at Checkout
-- ============================================

CREATE OR REPLACE FUNCTION validate_affiliate_code(
  p_vendor_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  affiliate_id UUID,
  first_name TEXT,
  last_name TEXT,
  referral_code TEXT,
  commission_rate DECIMAL(5,2),
  customer_discount_rate DECIMAL(5,2),
  customer_discount_type TEXT,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_affiliate RECORD;
BEGIN
  -- Look up the affiliate by code (case-insensitive)
  SELECT a.* INTO v_affiliate
  FROM affiliates a
  WHERE a.vendor_id = p_vendor_id
    AND UPPER(a.referral_code) = UPPER(TRIM(p_code))
  LIMIT 1;

  -- Not found
  IF v_affiliate IS NULL THEN
    RETURN QUERY SELECT
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::DECIMAL(5,2),
      NULL::DECIMAL(5,2),
      NULL::TEXT,
      FALSE,
      'Invalid affiliate code'::TEXT;
    RETURN;
  END IF;

  -- Found but not active
  IF v_affiliate.status != 'active' THEN
    RETURN QUERY SELECT
      v_affiliate.id,
      v_affiliate.first_name,
      v_affiliate.last_name,
      v_affiliate.referral_code,
      v_affiliate.commission_rate,
      v_affiliate.customer_discount_rate,
      v_affiliate.customer_discount_type,
      FALSE,
      CASE v_affiliate.status
        WHEN 'pending' THEN 'This affiliate is pending approval'
        WHEN 'paused' THEN 'This affiliate code is temporarily disabled'
        WHEN 'terminated' THEN 'This affiliate code is no longer valid'
        ELSE 'This affiliate code is not active'
      END;
    RETURN;
  END IF;

  -- Valid and active!
  RETURN QUERY SELECT
    v_affiliate.id,
    v_affiliate.first_name,
    v_affiliate.last_name,
    v_affiliate.referral_code,
    v_affiliate.commission_rate,
    v_affiliate.customer_discount_rate,
    v_affiliate.customer_discount_type,
    TRUE,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Calculate Affiliate Discount
-- ============================================

CREATE OR REPLACE FUNCTION calculate_affiliate_discount(
  p_subtotal DECIMAL(12,2),
  p_discount_rate DECIMAL(5,2),
  p_discount_type TEXT
)
RETURNS DECIMAL(12,2) AS $$
BEGIN
  IF p_discount_rate IS NULL OR p_discount_rate <= 0 THEN
    RETURN 0;
  END IF;

  IF p_discount_type = 'percentage' THEN
    RETURN ROUND(p_subtotal * (p_discount_rate / 100), 2);
  ELSIF p_discount_type = 'fixed' THEN
    -- Fixed discount cannot exceed subtotal
    RETURN LEAST(p_discount_rate, p_subtotal);
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- TRIGGER: Auto-create Affiliate Conversion on Order
-- ============================================

CREATE OR REPLACE FUNCTION create_affiliate_conversion_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_affiliate RECORD;
  v_commission_amount DECIMAL(12,2);
BEGIN
  -- Only process if affiliate_id is set
  IF NEW.affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get affiliate details
  SELECT * INTO v_affiliate
  FROM affiliates
  WHERE id = NEW.affiliate_id;

  IF v_affiliate IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate commission based on order total (after discounts)
  v_commission_amount := ROUND(
    COALESCE(NEW.total_amount, 0) * (v_affiliate.commission_rate / 100),
    2
  );

  -- Create conversion record (only if one doesn't exist for this order)
  INSERT INTO affiliate_conversions (
    affiliate_id,
    vendor_id,
    order_id,
    order_total,
    order_subtotal,
    commission_rate,
    commission_amount,
    status
  )
  VALUES (
    NEW.affiliate_id,
    NEW.vendor_id,
    NEW.id,
    COALESCE(NEW.total_amount, 0),
    COALESCE(NEW.subtotal, 0),
    v_affiliate.commission_rate,
    v_commission_amount,
    'pending'  -- Conversions start as pending, vendor can approve/reject
  )
  ON CONFLICT (order_id) DO NOTHING;  -- Don't duplicate if order is updated

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for affiliate conversion tracking
DROP TRIGGER IF EXISTS tr_create_affiliate_conversion ON orders;
CREATE TRIGGER tr_create_affiliate_conversion
  AFTER INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.affiliate_id IS NOT NULL)
  EXECUTE FUNCTION create_affiliate_conversion_on_order();

-- ============================================
-- ADD UNIQUE CONSTRAINT ON CONVERSIONS
-- ============================================

-- Ensure one conversion per order
ALTER TABLE affiliate_conversions
  DROP CONSTRAINT IF EXISTS unique_conversion_per_order;

ALTER TABLE affiliate_conversions
  ADD CONSTRAINT unique_conversion_per_order UNIQUE (order_id);

-- ============================================
-- UPDATE EXISTING AFFILIATE (Bobs Burgers) WITH DISCOUNT
-- ============================================

-- Give Bobs Burgers a 10% customer discount to test
UPDATE affiliates
SET customer_discount_rate = 10,
    customer_discount_type = 'percentage'
WHERE referral_code = 'BOBS';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION validate_affiliate_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_affiliate_discount(DECIMAL, DECIMAL, TEXT) TO authenticated;
