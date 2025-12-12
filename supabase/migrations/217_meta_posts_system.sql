-- Meta Posts System
-- Store Facebook and Instagram posts synced from Meta

-- ============================================================================
-- META POSTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- Meta IDs
  meta_post_id TEXT NOT NULL,
  meta_page_id TEXT,
  meta_instagram_id TEXT,

  -- Post info
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  post_type TEXT, -- photo, video, link, status, album, reel, story, carousel
  message TEXT,
  story TEXT, -- For link posts, the story/caption

  -- Media
  full_picture TEXT,
  permalink_url TEXT,
  media_url TEXT, -- For Instagram
  thumbnail_url TEXT,
  media_type TEXT, -- IMAGE, VIDEO, CAROUSEL_ALBUM

  -- For video posts
  video_id TEXT,
  video_length DECIMAL(10,2),

  -- Timestamps from Meta
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,

  -- Engagement metrics (cached)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  reactions_count INTEGER DEFAULT 0,

  -- Instagram specific
  ig_likes_count INTEGER DEFAULT 0,
  ig_comments_count INTEGER DEFAULT 0,
  ig_saved_count INTEGER DEFAULT 0,
  ig_reach INTEGER DEFAULT 0,
  ig_impressions INTEGER DEFAULT 0,

  -- Video metrics
  video_views INTEGER DEFAULT 0,
  video_avg_time_watched DECIMAL(10,2),

  -- Status
  is_published BOOLEAN DEFAULT true,
  is_hidden BOOLEAN DEFAULT false,
  scheduled_publish_time TIMESTAMPTZ,

  -- Raw data from API
  raw_data JSONB,

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, meta_post_id)
);

-- ============================================================================
-- META POST INSIGHTS (detailed metrics per post)
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta_post_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES meta_posts(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,

  -- Time period
  date DATE NOT NULL,

  -- Reach & Impressions
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,

  -- Engagement
  engagement INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,

  -- Reactions breakdown
  reactions_like INTEGER DEFAULT 0,
  reactions_love INTEGER DEFAULT 0,
  reactions_wow INTEGER DEFAULT 0,
  reactions_haha INTEGER DEFAULT 0,
  reactions_sorry INTEGER DEFAULT 0,
  reactions_anger INTEGER DEFAULT 0,

  -- Video metrics
  video_views INTEGER DEFAULT 0,
  video_views_10s INTEGER DEFAULT 0,
  video_avg_time_watched INTEGER DEFAULT 0,

  -- Raw insights
  raw_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(post_id, date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_meta_posts_vendor ON meta_posts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meta_posts_platform ON meta_posts(vendor_id, platform);
CREATE INDEX IF NOT EXISTS idx_meta_posts_created ON meta_posts(vendor_id, created_time DESC);
CREATE INDEX IF NOT EXISTS idx_meta_posts_meta_id ON meta_posts(meta_post_id);
CREATE INDEX IF NOT EXISTS idx_meta_post_insights_post ON meta_post_insights(post_id);
CREATE INDEX IF NOT EXISTS idx_meta_post_insights_date ON meta_post_insights(vendor_id, date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE meta_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_post_insights ENABLE ROW LEVEL SECURITY;

-- Policies for meta_posts
CREATE POLICY "Users can view their vendor meta posts"
  ON meta_posts FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta posts"
  ON meta_posts FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- Policies for meta_post_insights
CREATE POLICY "Users can view their vendor meta post insights"
  ON meta_post_insights FOR SELECT
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage their vendor meta post insights"
  ON meta_post_insights FOR ALL
  USING (vendor_id = (SELECT vendor_id FROM users WHERE auth_user_id = auth.uid()));

-- ============================================================================
-- REALTIME
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE meta_posts;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE meta_posts IS 'Facebook and Instagram posts synced from Meta Graph API';
COMMENT ON TABLE meta_post_insights IS 'Daily insights/metrics for each post';
