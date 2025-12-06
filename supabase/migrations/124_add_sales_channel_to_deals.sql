/**
 * Add sales_channel column to deals table
 * Allows discounts to apply to: 'both' (POS + Online), 'in_store' (POS only), 'online' (E-commerce only)
 */

-- Add sales_channel column with default 'both' for backwards compatibility
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS sales_channel TEXT NOT NULL DEFAULT 'both'
CHECK (sales_channel IN ('both', 'in_store', 'online'));

-- Add index for filtering by sales channel
CREATE INDEX IF NOT EXISTS idx_deals_sales_channel ON deals(vendor_id, sales_channel) WHERE is_active = true;

-- Update is_deal_active function to check sales channel
CREATE OR REPLACE FUNCTION is_deal_active(deal_row deals, p_channel TEXT DEFAULT 'both')
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if deal is marked active
  IF NOT deal_row.is_active THEN
    RETURN false;
  END IF;

  -- Check sales channel
  IF deal_row.sales_channel != 'both' AND deal_row.sales_channel != p_channel THEN
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

COMMENT ON COLUMN deals.sales_channel IS 'Where discount applies: both (POS + Online), in_store (POS only), online (E-commerce only)';
