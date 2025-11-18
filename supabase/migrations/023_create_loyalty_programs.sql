-- Create loyalty_programs table
-- Simplified loyalty program configuration for vendors
-- Date: 2025-11-18

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL,

  -- Program configuration
  name TEXT NOT NULL DEFAULT 'Loyalty Rewards',
  points_per_dollar DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  point_value DECIMAL(10,4) NOT NULL DEFAULT 0.01, -- $0.01 per point
  min_redemption_points INTEGER NOT NULL DEFAULT 100,
  points_expiry_days INTEGER, -- NULL = never expires

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for vendor lookups
CREATE INDEX idx_loyalty_programs_vendor ON loyalty_programs(vendor_id);

-- RLS Policies
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

-- Policy: Vendors can view and manage their own loyalty program
CREATE POLICY "vendor_access_loyalty_programs"
  ON loyalty_programs
  FOR ALL
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Grant permissions
GRANT ALL ON loyalty_programs TO authenticated;
GRANT ALL ON loyalty_programs TO service_role;

-- Comment
COMMENT ON TABLE loyalty_programs IS 'Loyalty program configuration for each vendor';
