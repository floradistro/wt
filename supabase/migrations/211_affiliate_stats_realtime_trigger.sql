-- Update affiliate stats when conversions are created
-- This trigger updates the affiliate's aggregate columns in real-time

CREATE OR REPLACE FUNCTION update_affiliate_stats_on_conversion()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the affiliate's stats
  UPDATE affiliates
  SET
    total_orders = COALESCE(total_orders, 0) + 1,
    total_revenue = COALESCE(total_revenue, 0) + COALESCE(NEW.order_total, 0),
    total_commission_earned = COALESCE(total_commission_earned, 0) + COALESCE(NEW.commission_amount, 0),
    pending_commission = COALESCE(pending_commission, 0) + COALESCE(NEW.commission_amount, 0),
    updated_at = NOW()
  WHERE id = NEW.affiliate_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS tr_update_affiliate_stats ON affiliate_conversions;

-- Create trigger
CREATE TRIGGER tr_update_affiliate_stats
  AFTER INSERT ON affiliate_conversions
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_stats_on_conversion();

-- Also update stats when conversion status changes (approved/rejected)
CREATE OR REPLACE FUNCTION update_affiliate_stats_on_conversion_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'approved', no change needed (already counted)
  -- If status changed to 'rejected', reverse the stats
  IF OLD.status != 'rejected' AND NEW.status = 'rejected' THEN
    UPDATE affiliates
    SET
      total_orders = GREATEST(COALESCE(total_orders, 0) - 1, 0),
      total_revenue = GREATEST(COALESCE(total_revenue, 0) - COALESCE(OLD.order_total, 0), 0),
      total_commission_earned = GREATEST(COALESCE(total_commission_earned, 0) - COALESCE(OLD.commission_amount, 0), 0),
      pending_commission = GREATEST(COALESCE(pending_commission, 0) - COALESCE(OLD.commission_amount, 0), 0),
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  -- If status changed to 'paid', move from pending to paid
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    UPDATE affiliates
    SET
      pending_commission = GREATEST(COALESCE(pending_commission, 0) - COALESCE(NEW.commission_amount, 0), 0),
      total_commission_paid = COALESCE(total_commission_paid, 0) + COALESCE(NEW.commission_amount, 0),
      updated_at = NOW()
    WHERE id = NEW.affiliate_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS tr_update_affiliate_stats_on_update ON affiliate_conversions;

-- Create trigger
CREATE TRIGGER tr_update_affiliate_stats_on_update
  AFTER UPDATE ON affiliate_conversions
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_stats_on_conversion_update();

-- Now update the existing affiliate with the conversion we already created
UPDATE affiliates
SET
  total_orders = (
    SELECT COUNT(*) FROM affiliate_conversions
    WHERE affiliate_id = affiliates.id AND status != 'rejected'
  ),
  total_revenue = (
    SELECT COALESCE(SUM(order_total), 0) FROM affiliate_conversions
    WHERE affiliate_id = affiliates.id AND status != 'rejected'
  ),
  total_commission_earned = (
    SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_conversions
    WHERE affiliate_id = affiliates.id AND status != 'rejected'
  ),
  pending_commission = (
    SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_conversions
    WHERE affiliate_id = affiliates.id AND status = 'pending'
  ),
  total_commission_paid = (
    SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_conversions
    WHERE affiliate_id = affiliates.id AND status = 'paid'
  )
WHERE id = 'd5907a3c-466b-4603-8fe7-eeb69b1e607c';  -- Bobs affiliate
