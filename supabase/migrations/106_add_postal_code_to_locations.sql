-- Add missing columns to locations table
-- This enables full address and tax information for locations

-- Add postal_code column
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Add tax_name column
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS tax_name TEXT DEFAULT 'Sales Tax';

-- Add comments for documentation
COMMENT ON COLUMN locations.postal_code IS 'ZIP/Postal code for the location address';
COMMENT ON COLUMN locations.tax_name IS 'Display name for the tax (e.g., "Sales Tax", "VAT", "GST")';
