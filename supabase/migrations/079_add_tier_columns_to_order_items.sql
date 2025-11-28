-- Add tier information columns to order_items table
-- This fixes the sales history showing "1.00g" instead of actual tier quantities

-- Add tier_name column (e.g., "28g (Ounce)", "3.5g (Eighth)")
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS tier_name TEXT;

-- Add quantity_grams column (actual grams deducted from inventory)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS quantity_grams NUMERIC;

-- Add quantity_display column (display string for UI)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS quantity_display TEXT;

-- Add comments for documentation
COMMENT ON COLUMN order_items.tier_name IS 'Display name of the tier sold (e.g., "28g (Ounce)", "3.5g (Eighth)")';
COMMENT ON COLUMN order_items.quantity_grams IS 'Actual grams deducted from inventory (e.g., 28 for "28g (Ounce)")';
COMMENT ON COLUMN order_items.quantity_display IS 'Display string for UI (tier_name or quantity)';
