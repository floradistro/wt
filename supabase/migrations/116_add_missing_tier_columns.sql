-- ============================================================================
-- ADD MISSING TIER COLUMNS TO order_items
-- ============================================================================
-- Issue: Edge Function is trying to insert tier_qty and tier_price but they don't exist
-- These columns were referenced in code but never created in migrations
-- Error: "invalid input syntax for type integer: "3.5"" suggests PostgreSQL auto-created them as INTEGER

-- Add tier_qty column (quantity to deduct from inventory)
-- Must be NUMERIC to support decimal values like 3.5g
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS tier_qty NUMERIC;

-- Add tier_price column (price for this specific tier)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS tier_price NUMERIC;

-- Add comments for documentation
COMMENT ON COLUMN order_items.tier_qty IS
'Tier quantity to deduct from inventory. Can be decimal (e.g., 3.5 for "3.5g", 28 for "28g", 1 for "1 gram")';

COMMENT ON COLUMN order_items.tier_price IS
'Price for this specific tier (e.g., price for 3.5g, price for 28g)';

-- If columns already exist as INTEGER (from auto-creation), alter their type
-- This is safe because USING clause handles conversion
DO $$
BEGIN
    -- Try to alter tier_qty if it exists with wrong type
    BEGIN
        ALTER TABLE order_items ALTER COLUMN tier_qty TYPE NUMERIC USING tier_qty::NUMERIC;
    EXCEPTION
        WHEN undefined_column THEN
            NULL; -- Column doesn't exist, already handled by ADD COLUMN above
        WHEN others THEN
            RAISE NOTICE 'Could not alter tier_qty type: %', SQLERRM;
    END;

    -- Try to alter tier_price if it exists with wrong type
    BEGIN
        ALTER TABLE order_items ALTER COLUMN tier_price TYPE NUMERIC USING tier_price::NUMERIC;
    EXCEPTION
        WHEN undefined_column THEN
            NULL; -- Column doesn't exist, already handled by ADD COLUMN above
        WHEN others THEN
            RAISE NOTICE 'Could not alter tier_price type: %', SQLERRM;
    END;
END $$;
