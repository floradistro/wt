-- Migration: Add shipping settings to VENDORS table (company-wide, not per-location)
-- Description: Adds free_shipping_enabled, free_shipping_threshold, and default_shipping_cost columns
-- to allow company-wide shipping configuration

-- Add shipping settings columns to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS free_shipping_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric(10,2) DEFAULT 35.00,
ADD COLUMN IF NOT EXISTS default_shipping_cost numeric(10,2) DEFAULT 5.99;

-- Add comments for documentation
COMMENT ON COLUMN vendors.free_shipping_enabled IS 'Whether free shipping is enabled for this vendor';
COMMENT ON COLUMN vendors.free_shipping_threshold IS 'Order subtotal threshold for free shipping eligibility (in dollars)';
COMMENT ON COLUMN vendors.default_shipping_cost IS 'Default shipping cost when order is below free shipping threshold (in dollars)';

-- Remove columns from locations table if they exist (cleanup from earlier migration)
ALTER TABLE locations
DROP COLUMN IF EXISTS free_shipping_enabled,
DROP COLUMN IF EXISTS free_shipping_threshold,
DROP COLUMN IF EXISTS default_shipping_cost;

-- Drop index from locations if exists
DROP INDEX IF EXISTS idx_locations_shipping_settings;
