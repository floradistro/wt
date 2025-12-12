-- Meta (Facebook/Instagram) Marketing Integration
-- Enables full ads management, analytics, and conversion tracking

-- ============================================================================
-- 1. META INTEGRATIONS (Store credentials per vendor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- App credentials
  app_id TEXT NOT NULL,
  app_secret_encrypted TEXT, -- Store encrypted, or use Supabase Vault

  -- Access tokens
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,

  -- Connected assets
  ad_account_id TEXT, -- format: act_123456789
  pixel_id TEXT,
  page_id TEXT,
  instagram_business_id TEXT,

  -- Business info
  business_id TEXT,
  business_name TEXT,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired', 'error')),
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id)
);

-- ============================================================================
-- 2. META CAMPAIGNS (Synced from Meta Ads Manager)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- Meta IDs
  meta_campaign_id TEXT NOT NULL,
  meta_account_id TEXT NOT NULL,

  -- Campaign info
  name TEXT NOT NULL,
  objective TEXT, -- OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES
  status TEXT, -- ACTIVE, PAUSED, DELETED, ARCHIVED
  effective_status TEXT, -- ACTIVE, PAUSED, DELETED, CAMPAIGN_PAUSED, etc.

  -- Budget
  daily_budget DECIMAL(12,2),
  lifetime_budget DECIMAL(12,2),
  budget_remaining DECIMAL(12,2),

  -- Schedule
  start_time TIMESTAMPTZ,
  stop_time TIMESTAMPTZ,

  -- Cached metrics (updated by sync)
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,

  -- Calculated metrics
  cpc DECIMAL(10,4), -- cost per click
  cpm DECIMAL(10,4), -- cost per 1000 impressions
  ctr DECIMAL(10,6), -- click-through rate
  roas DECIMAL(10,4), -- return on ad spend

  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  raw_insights JSONB, -- Store full insights response

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, meta_campaign_id)
);

-- ============================================================================
-- 3. META AD SETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- Meta IDs
  meta_ad_set_id TEXT NOT NULL,
  meta_campaign_id TEXT NOT NULL,

  -- Ad set info
  name TEXT NOT NULL,
  status TEXT,
  effective_status TEXT,

  -- Targeting
  targeting JSONB, -- Full targeting spec
  optimization_goal TEXT, -- LINK_CLICKS, IMPRESSIONS, CONVERSIONS, etc.
  billing_event TEXT, -- IMPRESSIONS, LINK_CLICKS, etc.
  bid_strategy TEXT,
  bid_amount DECIMAL(12,2),

  -- Budget
  daily_budget DECIMAL(12,2),
  lifetime_budget DECIMAL(12,2),

  -- Schedule
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,

  -- Cached metrics
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,

  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, meta_ad_set_id)
);

-- ============================================================================
-- 4. META ADS
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- Meta IDs
  meta_ad_id TEXT NOT NULL,
  meta_ad_set_id TEXT NOT NULL,

  -- Ad info
  name TEXT NOT NULL,
  status TEXT,
  effective_status TEXT,

  -- Creative
  creative_id TEXT,
  creative JSONB, -- Full creative spec (image, video, copy, etc.)
  preview_url TEXT,

  -- Placements
  placements JSONB, -- facebook_feed, instagram_feed, instagram_stories, etc.

  -- Cached metrics
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,

  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, meta_ad_id)
);

-- ============================================================================
-- 5. META CONVERSION EVENTS (Sent via Conversions API)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- Event info
  event_name TEXT NOT NULL, -- Purchase, Lead, AddToCart, ViewContent, InitiateCheckout
  event_time TIMESTAMPTZ NOT NULL,
  event_id TEXT NOT NULL, -- For deduplication with pixel

  -- Attribution
  order_id UUID REFERENCES orders(id),
  customer_id UUID REFERENCES customers(id),

  -- Event data
  event_source_url TEXT,
  action_source TEXT DEFAULT 'website', -- website, app, phone_call, chat, etc.

  -- Custom data
  value DECIMAL(12,2),
  currency TEXT DEFAULT 'USD',
  content_ids JSONB, -- Product IDs
  content_type TEXT, -- product, product_group
  num_items INTEGER,

  -- User data (hashed before sending to Meta)
  user_email_hash TEXT,
  user_phone_hash TEXT,
  user_external_id TEXT, -- customer_id hashed
  client_ip_address TEXT,
  client_user_agent TEXT,
  fbc TEXT, -- Facebook click ID from cookie
  fbp TEXT, -- Facebook browser ID from cookie

  -- Meta response
  fbtrace_id TEXT,
  events_received INTEGER,
  messages JSONB,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. META CUSTOM AUDIENCES (Synced from customer segments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- Link to our segments
  segment_id UUID REFERENCES customer_segments(id) ON DELETE SET NULL,

  -- Meta audience info
  meta_audience_id TEXT,
  name TEXT NOT NULL,
  description TEXT,

  -- Audience type
  audience_type TEXT DEFAULT 'CUSTOM', -- CUSTOM, LOOKALIKE
  subtype TEXT, -- CUSTOM for uploaded lists

  -- For lookalike audiences
  lookalike_spec JSONB, -- source audience, country, ratio

  -- Stats
  approximate_count INTEGER,
  customer_count INTEGER DEFAULT 0, -- Our count

  -- Sync status
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,

  -- Auto-sync settings
  auto_sync BOOLEAN DEFAULT false,
  sync_frequency_hours INTEGER DEFAULT 24,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. META AUDIENCE MEMBERS (Track which customers are in which audiences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_audience_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id UUID REFERENCES meta_audiences(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

  -- Hash of PII sent to Meta (for deduplication)
  email_hash TEXT,
  phone_hash TEXT,

  added_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(audience_id, customer_id)
);

-- ============================================================================
-- 8. META INSIGHTS SNAPSHOTS (Historical performance data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_insights_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- What this snapshot is for
  object_type TEXT NOT NULL, -- account, campaign, adset, ad
  object_id TEXT NOT NULL,

  -- Time period
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,

  -- Metrics
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,

  -- Engagement
  actions JSONB, -- All action breakdowns
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,

  -- Costs
  cpc DECIMAL(10,4),
  cpm DECIMAL(10,4),
  cpp DECIMAL(10,4), -- cost per purchase

  -- Rates
  ctr DECIMAL(10,6),
  conversion_rate DECIMAL(10,6),

  -- Full response
  raw_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, object_type, object_id, date_start, date_stop)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Meta integrations
CREATE INDEX IF NOT EXISTS idx_meta_integrations_vendor ON meta_integrations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_integrations_status ON meta_integrations(status);

-- Meta campaigns
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_vendor ON meta_campaigns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON meta_campaigns(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_meta_id ON meta_campaigns(meta_campaign_id);

-- Meta ad sets
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_vendor ON meta_ad_sets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_sets_campaign ON meta_ad_sets(meta_campaign_id);

-- Meta ads
CREATE INDEX IF NOT EXISTS idx_meta_ads_vendor ON meta_ads(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_ad_set ON meta_ads(meta_ad_set_id);

-- Conversion events
CREATE INDEX IF NOT EXISTS idx_meta_conversions_vendor ON meta_conversion_events(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_conversions_status ON meta_conversion_events(status);
CREATE INDEX IF NOT EXISTS idx_meta_conversions_event ON meta_conversion_events(vendor_id, event_name, event_time);
CREATE INDEX IF NOT EXISTS idx_meta_conversions_order ON meta_conversion_events(order_id);

-- Audiences
CREATE INDEX IF NOT EXISTS idx_meta_audiences_vendor ON meta_audiences(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_audiences_segment ON meta_audiences(segment_id);

-- Insights snapshots
CREATE INDEX IF NOT EXISTS idx_meta_insights_vendor ON meta_insights_snapshots(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_object ON meta_insights_snapshots(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON meta_insights_snapshots(date_start, date_stop);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE meta_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_audience_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_insights_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for meta_integrations
CREATE POLICY "Users can view their vendor meta integration"
  ON meta_integrations FOR SELECT
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta integration"
  ON meta_integrations FOR ALL
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

-- Policies for meta_campaigns
CREATE POLICY "Users can view their vendor meta campaigns"
  ON meta_campaigns FOR SELECT
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta campaigns"
  ON meta_campaigns FOR ALL
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

-- Policies for meta_ad_sets
CREATE POLICY "Users can view their vendor meta ad sets"
  ON meta_ad_sets FOR SELECT
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta ad sets"
  ON meta_ad_sets FOR ALL
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

-- Policies for meta_ads
CREATE POLICY "Users can view their vendor meta ads"
  ON meta_ads FOR SELECT
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta ads"
  ON meta_ads FOR ALL
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

-- Policies for meta_conversion_events
CREATE POLICY "Users can view their vendor meta conversions"
  ON meta_conversion_events FOR SELECT
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta conversions"
  ON meta_conversion_events FOR ALL
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

-- Policies for meta_audiences
CREATE POLICY "Users can view their vendor meta audiences"
  ON meta_audiences FOR SELECT
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta audiences"
  ON meta_audiences FOR ALL
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

-- Policies for meta_audience_members
CREATE POLICY "Users can view their vendor meta audience members"
  ON meta_audience_members FOR SELECT
  USING (audience_id IN (
    SELECT id FROM meta_audiences
    WHERE vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can manage their vendor meta audience members"
  ON meta_audience_members FOR ALL
  USING (audience_id IN (
    SELECT id FROM meta_audiences
    WHERE vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid())
  ));

-- Policies for meta_insights_snapshots
CREATE POLICY "Users can view their vendor meta insights"
  ON meta_insights_snapshots FOR SELECT
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta insights"
  ON meta_insights_snapshots FOR ALL
  USING (vendor_id IN (SELECT vendor_id FROM vendor_users WHERE user_id = auth.uid()));

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE meta_integrations;
ALTER PUBLICATION supabase_realtime ADD TABLE meta_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE meta_conversion_events;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get Meta integration for a vendor
CREATE OR REPLACE FUNCTION get_meta_integration(p_vendor_id UUID)
RETURNS meta_integrations AS $$
  SELECT * FROM meta_integrations WHERE vendor_id = p_vendor_id AND status = 'active' LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to calculate campaign metrics
CREATE OR REPLACE FUNCTION calculate_meta_campaign_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate derived metrics
  IF NEW.impressions > 0 THEN
    NEW.cpm = (NEW.spend / NEW.impressions) * 1000;
    NEW.ctr = (NEW.clicks::DECIMAL / NEW.impressions) * 100;
  END IF;

  IF NEW.clicks > 0 THEN
    NEW.cpc = NEW.spend / NEW.clicks;
  END IF;

  IF NEW.spend > 0 AND NEW.conversion_value > 0 THEN
    NEW.roas = NEW.conversion_value / NEW.spend;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-calculating metrics
CREATE TRIGGER meta_campaigns_calculate_metrics
  BEFORE INSERT OR UPDATE ON meta_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION calculate_meta_campaign_metrics();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE meta_integrations IS 'Stores Meta (Facebook/Instagram) API credentials and connected assets per vendor';
COMMENT ON TABLE meta_campaigns IS 'Synced Meta ad campaigns with cached performance metrics';
COMMENT ON TABLE meta_ad_sets IS 'Synced Meta ad sets with targeting configuration';
COMMENT ON TABLE meta_ads IS 'Synced Meta individual ads with creative content';
COMMENT ON TABLE meta_conversion_events IS 'Server-side conversion events sent to Meta Conversions API';
COMMENT ON TABLE meta_audiences IS 'Custom audiences created from customer segments for Meta targeting';
COMMENT ON TABLE meta_audience_members IS 'Tracks which customers are synced to which Meta audiences';
COMMENT ON TABLE meta_insights_snapshots IS 'Historical performance data for reporting and trends';
