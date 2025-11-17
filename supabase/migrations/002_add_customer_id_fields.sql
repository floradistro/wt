-- Add ID scanning fields to customers table
-- Date: 2025-11-16
-- Purpose: Support driver's license scanning and customer matching

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS drivers_license_number TEXT,
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Create index for fast license number lookups
CREATE INDEX IF NOT EXISTS idx_customers_license ON customers(drivers_license_number) WHERE drivers_license_number IS NOT NULL;

-- Create index for fast name + DOB lookups
CREATE INDEX IF NOT EXISTS idx_customers_name_dob ON customers(first_name, last_name, date_of_birth) WHERE date_of_birth IS NOT NULL;

-- Create index for DOB-only lookups (for fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_customers_dob ON customers(date_of_birth) WHERE date_of_birth IS NOT NULL;

COMMENT ON COLUMN customers.drivers_license_number IS 'Driver''s license number from ID scan - used for exact matching';
COMMENT ON COLUMN customers.date_of_birth IS 'Date of birth from ID scan - used for matching';
COMMENT ON COLUMN customers.display_name IS 'Optional display name (nickname or preferred name)';
