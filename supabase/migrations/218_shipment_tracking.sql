-- Shipment Tracking Table
-- Stores EasyPost tracker data for live tracking updates

CREATE TABLE IF NOT EXISTS shipment_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,

  -- EasyPost tracker info
  easypost_tracker_id TEXT,
  carrier TEXT DEFAULT 'USPS',

  -- Status info
  status TEXT DEFAULT 'pre_transit', -- delivered, out_for_delivery, in_transit, pre_transit, alert, unknown
  status_category TEXT,
  status_description TEXT,

  -- Delivery info
  estimated_delivery DATE,
  actual_delivery TIMESTAMPTZ,

  -- Location info
  last_location TEXT,
  last_update TIMESTAMPTZ,

  -- Full tracking events (JSON array)
  events JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_tracking_number ON shipment_tracking(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_vendor_id ON shipment_tracking(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_order_id ON shipment_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_status ON shipment_tracking(status);

-- Enable RLS
ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own vendor's tracking data
CREATE POLICY "Users can view own vendor tracking" ON shipment_tracking
  FOR SELECT USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Users can insert tracking for their vendor
CREATE POLICY "Users can insert own vendor tracking" ON shipment_tracking
  FOR INSERT WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Users can update their own vendor's tracking
CREATE POLICY "Users can update own vendor tracking" ON shipment_tracking
  FOR UPDATE USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Service role full access (for webhooks and edge functions)
CREATE POLICY "Service role full access shipment_tracking" ON shipment_tracking
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_shipment_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipment_tracking_updated_at ON shipment_tracking;
CREATE TRIGGER shipment_tracking_updated_at
  BEFORE UPDATE ON shipment_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_tracking_updated_at();

-- Add shipping_label_url to orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_label_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_label_url TEXT;
  END IF;
END $$;

-- Add shipping_service to orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_service'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_service TEXT;
  END IF;
END $$;
