-- Marketing System Tables
-- Campaign management, sends tracking, and analytics

-- Marketing Campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Campaign content
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT, -- Email preview/preheader text
  content_json JSONB NOT NULL DEFAULT '{}', -- Structured content from AI
  html_content TEXT, -- Rendered HTML (cached)

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),

  -- Audience
  audience_type TEXT NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'segment', 'custom')),
  audience_filter JSONB DEFAULT '{}', -- Filter criteria for segments
  recipient_count INTEGER DEFAULT 0,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Analytics (aggregated)
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  complained_count INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual email sends (for tracking)
CREATE TABLE IF NOT EXISTS marketing_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Resend tracking
  resend_email_id TEXT, -- ID from Resend API

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),

  -- Event timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,

  -- Click tracking
  click_count INTEGER DEFAULT 0,
  clicked_links JSONB DEFAULT '[]', -- Array of clicked URLs

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, customer_id)
);

-- Resend webhook events (raw event log)
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References (nullable for flexibility)
  marketing_send_id UUID REFERENCES marketing_sends(id) ON DELETE SET NULL,
  resend_email_id TEXT,

  -- Event data
  event_type TEXT NOT NULL, -- email.sent, email.delivered, email.opened, email.clicked, etc.
  link_url TEXT, -- For click events
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer segments (predefined audiences)
CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Filter criteria (JSON query structure)
  filter_criteria JSONB NOT NULL DEFAULT '{}',

  -- Cached count (refreshed periodically)
  customer_count INTEGER DEFAULT 0,
  last_count_at TIMESTAMPTZ,

  -- System vs custom
  is_system BOOLEAN DEFAULT FALSE, -- System segments can't be deleted

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_vendor ON marketing_campaigns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created ON marketing_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_sends_campaign ON marketing_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_customer ON marketing_sends(customer_id);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_status ON marketing_sends(status);
CREATE INDEX IF NOT EXISTS idx_marketing_sends_resend ON marketing_sends(resend_email_id);

CREATE INDEX IF NOT EXISTS idx_email_events_resend ON email_events(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_segments_vendor ON customer_segments(vendor_id);

-- RLS Policies
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;

-- Campaigns: Vendor access
CREATE POLICY "Vendors can manage their campaigns"
  ON marketing_campaigns
  FOR ALL
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Sends: Vendor access through campaign
CREATE POLICY "Vendors can view their sends"
  ON marketing_sends
  FOR ALL
  USING (
    campaign_id IN (
      SELECT id FROM marketing_campaigns WHERE vendor_id IN (
        SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Email events: Allow insert from edge functions (service role)
CREATE POLICY "Service role can insert events"
  ON email_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Vendors can view their events"
  ON email_events
  FOR SELECT
  USING (
    marketing_send_id IN (
      SELECT id FROM marketing_sends WHERE campaign_id IN (
        SELECT id FROM marketing_campaigns WHERE vendor_id IN (
          SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

-- Segments: Vendor access
CREATE POLICY "Vendors can manage their segments"
  ON customer_segments
  FOR ALL
  USING (
    vendor_id IN (
      SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Insert default segments for existing vendors
INSERT INTO customer_segments (vendor_id, name, description, filter_criteria, is_system)
SELECT
  v.id,
  'All Customers',
  'Every customer in your database',
  '{"type": "all"}',
  true
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs
  WHERE cs.vendor_id = v.id AND cs.name = 'All Customers'
);

INSERT INTO customer_segments (vendor_id, name, description, filter_criteria, is_system)
SELECT
  v.id,
  'Loyalty Members',
  'Customers with 500+ loyalty points',
  '{"type": "loyalty", "min_points": 500}',
  true
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs
  WHERE cs.vendor_id = v.id AND cs.name = 'Loyalty Members'
);

INSERT INTO customer_segments (vendor_id, name, description, filter_criteria, is_system)
SELECT
  v.id,
  'Recent Purchasers',
  'Customers who ordered in the last 30 days',
  '{"type": "recent_order", "days": 30}',
  true
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs
  WHERE cs.vendor_id = v.id AND cs.name = 'Recent Purchasers'
);

INSERT INTO customer_segments (vendor_id, name, description, filter_criteria, is_system)
SELECT
  v.id,
  'Inactive Customers',
  'Customers who haven''t ordered in 90+ days',
  '{"type": "inactive", "days": 90}',
  true
FROM vendors v
WHERE NOT EXISTS (
  SELECT 1 FROM customer_segments cs
  WHERE cs.vendor_id = v.id AND cs.name = 'Inactive Customers'
);

-- Trigger to update campaign analytics
CREATE OR REPLACE FUNCTION update_campaign_analytics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketing_campaigns
  SET
    sent_count = (SELECT COUNT(*) FROM marketing_sends WHERE campaign_id = NEW.campaign_id AND status != 'pending'),
    delivered_count = (SELECT COUNT(*) FROM marketing_sends WHERE campaign_id = NEW.campaign_id AND status IN ('delivered', 'opened', 'clicked')),
    opened_count = (SELECT COUNT(*) FROM marketing_sends WHERE campaign_id = NEW.campaign_id AND status IN ('opened', 'clicked')),
    clicked_count = (SELECT COUNT(*) FROM marketing_sends WHERE campaign_id = NEW.campaign_id AND status = 'clicked'),
    bounced_count = (SELECT COUNT(*) FROM marketing_sends WHERE campaign_id = NEW.campaign_id AND status = 'bounced'),
    complained_count = (SELECT COUNT(*) FROM marketing_sends WHERE campaign_id = NEW.campaign_id AND status = 'complained'),
    updated_at = NOW()
  WHERE id = NEW.campaign_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_analytics
  AFTER INSERT OR UPDATE ON marketing_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_analytics();

-- Enable realtime for campaigns
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_campaigns;
