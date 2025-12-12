-- Fix Meta RLS policies to use correct users table pattern
-- The original migration used vendor_users which doesn't exist
-- Should use: SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()

-- Drop existing policies (they may have failed to create, but try anyway)
DROP POLICY IF EXISTS "Users can view their vendor meta integration" ON meta_integrations;
DROP POLICY IF EXISTS "Users can manage their vendor meta integration" ON meta_integrations;
DROP POLICY IF EXISTS "Users can view their vendor meta campaigns" ON meta_campaigns;
DROP POLICY IF EXISTS "Users can manage their vendor meta campaigns" ON meta_campaigns;
DROP POLICY IF EXISTS "Users can view their vendor meta ad sets" ON meta_ad_sets;
DROP POLICY IF EXISTS "Users can manage their vendor meta ad sets" ON meta_ad_sets;
DROP POLICY IF EXISTS "Users can view their vendor meta ads" ON meta_ads;
DROP POLICY IF EXISTS "Users can manage their vendor meta ads" ON meta_ads;
DROP POLICY IF EXISTS "Users can view their vendor meta conversions" ON meta_conversion_events;
DROP POLICY IF EXISTS "Users can manage their vendor meta conversions" ON meta_conversion_events;
DROP POLICY IF EXISTS "Users can view their vendor meta audiences" ON meta_audiences;
DROP POLICY IF EXISTS "Users can manage their vendor meta audiences" ON meta_audiences;
DROP POLICY IF EXISTS "Users can view their vendor meta audience members" ON meta_audience_members;
DROP POLICY IF EXISTS "Users can manage their vendor meta audience members" ON meta_audience_members;
DROP POLICY IF EXISTS "Users can view their vendor meta insights" ON meta_insights_snapshots;
DROP POLICY IF EXISTS "Users can manage their vendor meta insights" ON meta_insights_snapshots;

-- ============================================================================
-- Create correct RLS policies using users table pattern
-- ============================================================================

-- Policies for meta_integrations
CREATE POLICY "Users can view their vendor meta integration"
  ON meta_integrations FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta integration"
  ON meta_integrations FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- Policies for meta_campaigns
CREATE POLICY "Users can view their vendor meta campaigns"
  ON meta_campaigns FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta campaigns"
  ON meta_campaigns FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- Policies for meta_ad_sets
CREATE POLICY "Users can view their vendor meta ad sets"
  ON meta_ad_sets FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta ad sets"
  ON meta_ad_sets FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- Policies for meta_ads
CREATE POLICY "Users can view their vendor meta ads"
  ON meta_ads FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta ads"
  ON meta_ads FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- Policies for meta_conversion_events
CREATE POLICY "Users can view their vendor meta conversions"
  ON meta_conversion_events FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta conversions"
  ON meta_conversion_events FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- Policies for meta_audiences
CREATE POLICY "Users can view their vendor meta audiences"
  ON meta_audiences FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta audiences"
  ON meta_audiences FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- Policies for meta_audience_members
CREATE POLICY "Users can view their vendor meta audience members"
  ON meta_audience_members FOR SELECT
  USING (audience_id IN (
    SELECT id FROM meta_audiences
    WHERE vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid())
  ));

CREATE POLICY "Users can manage their vendor meta audience members"
  ON meta_audience_members FOR ALL
  USING (audience_id IN (
    SELECT id FROM meta_audiences
    WHERE vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid())
  ));

-- Policies for meta_insights_snapshots
CREATE POLICY "Users can view their vendor meta insights"
  ON meta_insights_snapshots FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta insights"
  ON meta_insights_snapshots FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));
