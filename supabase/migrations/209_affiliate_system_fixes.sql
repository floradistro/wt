/**
 * Affiliate System Fixes
 *
 * Fixes identified during testing:
 * 1. Auto-generate referral_code on insert
 * 2. Add UTM tracking columns to affiliate_clicks
 */

-- ============================================
-- FIX 1: Auto-generate referral code on insert
-- ============================================

-- Create a trigger function to auto-generate referral code
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_base TEXT;
  v_suffix INTEGER := 0;
  v_exists BOOLEAN;
BEGIN
  -- Only generate if referral_code is null or empty
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    -- Create base from first name or company name
    v_base := UPPER(COALESCE(
      NULLIF(TRIM(NEW.first_name), ''),
      NULLIF(TRIM(NEW.company_name), ''),
      'AFF'
    ));

    -- Limit to 8 chars and remove non-alphanumeric
    v_base := REGEXP_REPLACE(v_base, '[^A-Z0-9]', '', 'g');
    v_base := LEFT(v_base, 8);

    -- Try base code first
    v_code := v_base;

    -- Check if exists
    SELECT EXISTS(
      SELECT 1 FROM affiliates
      WHERE vendor_id = NEW.vendor_id
        AND referral_code = v_code
    ) INTO v_exists;

    -- If exists, add numeric suffix
    WHILE v_exists LOOP
      v_suffix := v_suffix + 1;
      v_code := v_base || v_suffix::TEXT;

      SELECT EXISTS(
        SELECT 1 FROM affiliates
        WHERE vendor_id = NEW.vendor_id
          AND referral_code = v_code
      ) INTO v_exists;

      -- Safety: don't loop forever
      IF v_suffix > 999 THEN
        v_code := v_base || '_' || SUBSTRING(gen_random_uuid()::TEXT, 1, 4);
        EXIT;
      END IF;
    END LOOP;

    NEW.referral_code := v_code;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating referral code
DROP TRIGGER IF EXISTS tr_auto_generate_referral_code ON affiliates;
CREATE TRIGGER tr_auto_generate_referral_code
  BEFORE INSERT ON affiliates
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();

-- ============================================
-- FIX 2: Add UTM tracking columns
-- ============================================

-- Add UTM columns to affiliate_clicks if they don't exist
ALTER TABLE affiliate_clicks
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- ============================================
-- FIX 3: Add helpful indexes
-- ============================================

-- Index for UTM campaign reporting
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_utm_campaign
  ON affiliate_clicks(vendor_id, utm_campaign)
  WHERE utm_campaign IS NOT NULL;

-- Index for date-based click reporting
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_date
  ON affiliate_clicks(vendor_id, clicked_at);

-- ============================================
-- FIX 4: Add trigger to update affiliate metrics
-- ============================================

-- Function to update affiliate click count
CREATE OR REPLACE FUNCTION update_affiliate_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE affiliates
  SET
    total_clicks = total_clicks + 1,
    updated_at = NOW()
  WHERE id = NEW.affiliate_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for click counting
DROP TRIGGER IF EXISTS tr_update_affiliate_click_count ON affiliate_clicks;
CREATE TRIGGER tr_update_affiliate_click_count
  AFTER INSERT ON affiliate_clicks
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_click_count();

-- ============================================
-- FIX 5: Add function to update affiliate metrics on conversion
-- ============================================

CREATE OR REPLACE FUNCTION update_affiliate_conversion_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- When conversion is approved
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status != 'approved') THEN
    UPDATE affiliates
    SET
      total_orders = total_orders + 1,
      total_revenue = total_revenue + NEW.order_total,
      total_commission_earned = total_commission_earned + NEW.commission_amount,
      pending_commission = pending_commission + NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  -- When conversion is paid
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE affiliates
    SET
      pending_commission = pending_commission - NEW.commission_amount,
      total_commission_paid = total_commission_paid + NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  -- When conversion is rejected (reverse if was approved)
  IF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
    UPDATE affiliates
    SET
      total_orders = total_orders - 1,
      total_revenue = total_revenue - NEW.order_total,
      total_commission_earned = total_commission_earned - NEW.commission_amount,
      pending_commission = pending_commission - NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conversion metrics
DROP TRIGGER IF EXISTS tr_update_affiliate_conversion_metrics ON affiliate_conversions;
CREATE TRIGGER tr_update_affiliate_conversion_metrics
  AFTER INSERT OR UPDATE ON affiliate_conversions
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_conversion_metrics();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Ensure authenticated users can use the new columns
GRANT SELECT, INSERT, UPDATE ON affiliate_clicks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON affiliate_conversions TO authenticated;
