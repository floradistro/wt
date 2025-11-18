-- Add users and user_locations tables for multi-location support
-- Based on whaletools prototype schema
-- Date: 2025-11-17

-- ============================================================================
-- Add missing fields to locations table
-- ============================================================================

-- Add is_primary field to locations if it doesn't exist
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS address_line1 TEXT;

-- Update existing address column to address_line1 if needed
UPDATE locations SET address_line1 = address WHERE address_line1 IS NULL AND address IS NOT NULL;

-- ============================================================================
-- Create users table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Auth reference
  auth_user_id UUID UNIQUE, -- References Supabase Auth user

  -- Basic info
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,

  -- Vendor relationship
  vendor_id UUID NOT NULL, -- References vendors table (to be created)

  -- Role & Permissions
  role TEXT NOT NULL DEFAULT 'pos_staff', -- vendor_owner, vendor_admin, location_manager, pos_staff, inventory_staff, readonly
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive

  -- Employee info
  employee_id TEXT, -- Internal employee ID

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Create user_locations junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_locations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Primary location flag
  is_primary_location BOOLEAN NOT NULL DEFAULT false,

  -- Permissions at this location
  can_sell BOOLEAN NOT NULL DEFAULT true,
  can_manage_inventory BOOLEAN NOT NULL DEFAULT false,
  can_manage BOOLEAN NOT NULL DEFAULT false,
  can_transfer BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite primary key
  PRIMARY KEY (user_id, location_id)
);

-- ============================================================================
-- Create vendors table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Vendor info
  store_name TEXT NOT NULL,
  logo_url TEXT,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Add foreign key constraints (if not exists)
-- ============================================================================

-- Add vendor_id foreign key to locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'locations_vendor_id_fkey'
  ) THEN
    ALTER TABLE locations ADD CONSTRAINT locations_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add vendor_id foreign key to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_vendor_id_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_vendor_id ON users(vendor_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location_id ON user_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_locations_vendor_id ON locations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_locations_is_primary ON locations(is_primary);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Users can read their location assignments
CREATE POLICY "Users can read own location assignments" ON user_locations
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Users can read vendor info for their vendor
CREATE POLICY "Users can read own vendor" ON vendors
  FOR SELECT
  USING (
    id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- Updated_at trigger function (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_locations_updated_at ON user_locations;
CREATE TRIGGER update_user_locations_updated_at
  BEFORE UPDATE ON user_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Sample data for testing (comment out for production)
-- ============================================================================

-- Note: In production, you would populate this via:
-- 1. Vendor signup flow (creates vendor + owner user)
-- 2. Employee management UI (creates users + assigns to locations)
-- 3. Location creation flow (creates locations tied to vendor)
