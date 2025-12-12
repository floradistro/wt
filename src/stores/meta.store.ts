/**
 * Meta (Facebook/Instagram) Marketing Store
 * State management for Meta Ads, Audiences, and Conversions API
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// Track active subscription
let realtimeChannel: RealtimeChannel | null = null

// ============================================================================
// TYPES
// ============================================================================

export interface MetaIntegration {
  id: string
  vendor_id: string
  app_id: string
  ad_account_id: string | null
  pixel_id: string | null
  page_id: string | null
  instagram_business_id: string | null
  business_id: string | null
  business_name: string | null
  status: 'active' | 'disconnected' | 'expired' | 'error'
  last_error: string | null
  token_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface MetaCampaign {
  id: string
  vendor_id: string
  meta_campaign_id: string
  meta_account_id: string
  name: string
  objective: string | null
  status: string | null
  effective_status: string | null
  daily_budget: number | null
  lifetime_budget: number | null
  budget_remaining: number | null
  start_time: string | null
  stop_time: string | null
  // Metrics
  impressions: number
  reach: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  cpc: number | null
  cpm: number | null
  ctr: number | null
  roas: number | null
  last_synced_at: string | null
  raw_insights: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface MetaAdSet {
  id: string
  vendor_id: string
  meta_ad_set_id: string
  meta_campaign_id: string
  name: string
  status: string | null
  effective_status: string | null
  targeting: Record<string, any> | null
  optimization_goal: string | null
  billing_event: string | null
  bid_strategy: string | null
  bid_amount: number | null
  daily_budget: number | null
  lifetime_budget: number | null
  start_time: string | null
  end_time: string | null
  impressions: number
  reach: number
  clicks: number
  spend: number
  conversions: number
  last_synced_at: string | null
  created_at: string
}

export interface MetaAd {
  id: string
  vendor_id: string
  meta_ad_id: string
  meta_ad_set_id: string
  name: string
  status: string | null
  effective_status: string | null
  creative_id: string | null
  creative: Record<string, any> | null
  preview_url: string | null
  placements: Record<string, any> | null
  impressions: number
  reach: number
  clicks: number
  spend: number
  conversions: number
  last_synced_at: string | null
  created_at: string
}

export interface MetaAudience {
  id: string
  vendor_id: string
  segment_id: string | null
  meta_audience_id: string | null
  name: string
  description: string | null
  audience_type: 'CUSTOM' | 'LOOKALIKE'
  subtype: string | null
  lookalike_spec: Record<string, any> | null
  approximate_count: number | null
  customer_count: number
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed'
  last_synced_at: string | null
  sync_error: string | null
  auto_sync: boolean
  sync_frequency_hours: number
  created_at: string
  updated_at: string
}

export interface MetaConversionEvent {
  id: string
  vendor_id: string
  event_name: string
  event_time: string
  event_id: string
  order_id: string | null
  customer_id: string | null
  event_source_url: string | null
  action_source: string
  value: number | null
  currency: string
  content_ids: string[] | null
  content_type: string | null
  num_items: number | null
  status: 'pending' | 'sent' | 'failed'
  sent_at: string | null
  error_message: string | null
  retry_count: number
  created_at: string
}

export interface MetaAccountInsights {
  impressions: number
  reach: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  cpc: number
  cpm: number
  ctr: number
  roas: number
  date_start: string
  date_stop: string
}

export interface MetaInsightsSummary {
  impressions: number
  reach: number
  clicks: number
  spend: number
  cpc: number
  cpm: number
  ctr: number
  purchases: number
  purchaseValue: number
  roas: number
  dateStart: string
  dateEnd: string
}

export interface MetaDailyInsight {
  date: string
  impressions: number
  reach: number
  clicks: number
  spend: number
  purchases: number
  purchaseValue: number
}

export interface MetaCampaignInsight {
  campaignId: string
  campaignName: string
  impressions: number
  reach: number
  clicks: number
  spend: number
  cpc: number
  ctr: number
  purchases: number
  purchaseValue: number
  roas: number
}

export interface MetaPageInsights {
  impressions: number
  reach: number
  engagedUsers: number
  postEngagements: number
  totalFollowers: number
  newFollowers: number
  pageViews?: number
  websiteClicks?: number
  reactions?: number
  consumptions?: number
}

export interface MetaInstagramInsights {
  impressions: number
  reach: number
  profileViews: number
  followers: number
  newFollowers?: number
  websiteClicks?: number
  emailContacts?: number
  phoneClicks?: number
  textClicks?: number
  directionsClicks?: number
}

export interface MetaFullInsights {
  success: boolean
  summary: MetaInsightsSummary | null
  daily: MetaDailyInsight[]
  campaigns: MetaCampaignInsight[]
  page: MetaPageInsights | null
  instagram: MetaInstagramInsights | null
  dateRange: { start: string; end: string }
}

export interface MetaPost {
  id: string
  vendor_id: string
  meta_post_id: string
  meta_page_id: string | null
  meta_instagram_id: string | null
  platform: 'facebook' | 'instagram'
  post_type: string | null
  message: string | null
  story: string | null
  full_picture: string | null
  permalink_url: string | null
  media_url: string | null
  thumbnail_url: string | null
  media_type: string | null
  created_time: string | null
  updated_time: string | null
  // Facebook metrics
  likes_count: number
  comments_count: number
  shares_count: number
  reactions_count: number
  // Instagram metrics
  ig_likes_count: number
  ig_comments_count: number
  ig_saved_count: number
  ig_reach: number
  ig_impressions: number
  // Video metrics
  video_views: number
  video_avg_time_watched: number | null
  // Status
  is_published: boolean
  is_hidden: boolean
  scheduled_publish_time: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

// Campaign objective options
export const CAMPAIGN_OBJECTIVES = [
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', description: 'Show ads to people most likely to remember them' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', description: 'Send people to your website or app' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', description: 'Get more messages, video views, or engagement' },
  { value: 'OUTCOME_LEADS', label: 'Leads', description: 'Collect leads for your business' },
  { value: 'OUTCOME_SALES', label: 'Sales', description: 'Find people likely to purchase your products' },
] as const

// Campaign status options
export const CAMPAIGN_STATUSES = {
  ACTIVE: { label: 'Active', color: '#10B981' },
  PAUSED: { label: 'Paused', color: '#F59E0B' },
  DELETED: { label: 'Deleted', color: '#EF4444' },
  ARCHIVED: { label: 'Archived', color: '#6B7280' },
} as const

// ============================================================================
// STATE & ACTIONS
// ============================================================================

interface MetaState {
  // Integration
  integration: MetaIntegration | null
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null

  // Campaigns
  campaigns: MetaCampaign[]
  adSets: MetaAdSet[]
  ads: MetaAd[]
  isLoadingCampaigns: boolean
  isSyncing: boolean

  // Audiences
  audiences: MetaAudience[]
  isLoadingAudiences: boolean

  // Conversion events
  conversionEvents: MetaConversionEvent[]
  isLoadingEvents: boolean

  // Account-level insights
  accountInsights: MetaAccountInsights | null
  fullInsights: MetaFullInsights | null
  isLoadingInsights: boolean

  // Posts
  posts: MetaPost[]
  isLoadingPosts: boolean
  isSyncingPosts: boolean

  // UI State
  selectedCampaignId: string | null
  selectedAdSetId: string | null
  selectedPostId: string | null
  postsFilter: 'all' | 'facebook' | 'instagram'
  dateRange: { start: Date; end: Date }
}

interface MetaActions {
  // Connection
  loadIntegration: (vendorId: string) => Promise<void>
  connect: (vendorId: string, accessToken: string, adAccountId?: string, pixelId?: string) => Promise<boolean>
  disconnect: (vendorId: string) => Promise<void>
  updateIntegration: (vendorId: string, updates: Partial<MetaIntegration>) => Promise<void>

  // Campaigns
  loadCampaigns: (vendorId: string) => Promise<void>
  syncCampaigns: (vendorId: string) => Promise<boolean>
  createCampaign: (vendorId: string, campaign: CreateCampaignParams) => Promise<MetaCampaign | null>
  updateCampaignStatus: (vendorId: string, metaCampaignId: string, status: 'ACTIVE' | 'PAUSED') => Promise<boolean>

  // Ad Sets
  loadAdSets: (vendorId: string, campaignId?: string) => Promise<void>

  // Ads
  loadAds: (vendorId: string, adSetId?: string) => Promise<void>

  // Audiences
  loadAudiences: (vendorId: string) => Promise<void>
  syncAudienceFromSegment: (vendorId: string, segmentId: string, name: string) => Promise<MetaAudience | null>
  createLookalikeAudience: (vendorId: string, sourceAudienceId: string, country: string, ratio: number) => Promise<MetaAudience | null>

  // Conversions
  loadConversionEvents: (vendorId: string, limit?: number) => Promise<void>
  sendConversionEvent: (vendorId: string, event: SendConversionParams) => Promise<boolean>

  // Insights
  loadAccountInsights: (vendorId: string, dateStart: string, dateStop: string) => Promise<void>
  loadFullInsights: (vendorId: string, dateStart?: string, dateEnd?: string, breakdown?: 'day' | 'week' | 'month') => Promise<void>

  // Posts
  loadPosts: (vendorId: string, platform?: 'all' | 'facebook' | 'instagram') => Promise<void>
  syncPosts: (vendorId: string, platform?: 'all' | 'facebook' | 'instagram') => Promise<boolean>

  // Realtime
  subscribeToRealtime: (vendorId: string) => void
  unsubscribeFromRealtime: () => void

  // UI
  selectCampaign: (id: string | null) => void
  selectAdSet: (id: string | null) => void
  selectPost: (id: string | null) => void
  setPostsFilter: (filter: 'all' | 'facebook' | 'instagram') => void
  setDateRange: (start: Date, end: Date) => void
}

interface CreateCampaignParams {
  name: string
  objective: string
  daily_budget?: number
  lifetime_budget?: number
  start_time?: string
  stop_time?: string
}

interface SendConversionParams {
  event_name: 'Purchase' | 'Lead' | 'AddToCart' | 'ViewContent' | 'InitiateCheckout' | 'CompleteRegistration'
  order_id?: string
  customer_id?: string
  value?: number
  currency?: string
  content_ids?: string[]
  event_source_url?: string
}

type MetaStore = MetaState & MetaActions

// ============================================================================
// STORE
// ============================================================================

export const useMetaStore = create<MetaStore>((set, get) => ({
  // Initial state
  integration: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,

  campaigns: [],
  adSets: [],
  ads: [],
  isLoadingCampaigns: false,
  isSyncing: false,

  audiences: [],
  isLoadingAudiences: false,

  conversionEvents: [],
  isLoadingEvents: false,

  accountInsights: null,
  fullInsights: null,
  isLoadingInsights: false,

  posts: [],
  isLoadingPosts: false,
  isSyncingPosts: false,

  selectedCampaignId: null,
  selectedAdSetId: null,
  selectedPostId: null,
  postsFilter: 'all',
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  },

  // ============================================================================
  // CONNECTION
  // ============================================================================

  loadIntegration: async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('meta_integrations')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle()

      if (error) throw error

      const isConnected = data?.status === 'active'
      set({ integration: data, isConnected })

      logger.info('[MetaStore] Integration loaded:', { vendorId, isConnected })
    } catch (err) {
      logger.error('[MetaStore] Load integration error:', err)
      set({ integration: null, isConnected: false })
    }
  },

  connect: async (vendorId: string, accessToken: string, adAccountId?: string, pixelId?: string) => {
    set({ isConnecting: true, connectionError: null })

    try {
      // Call edge function to validate token and get account info
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-connect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            vendorId,
            accessToken,
            adAccountId,
            pixelId,
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to connect to Meta')
      }

      const integration = await response.json()

      set({
        integration,
        isConnected: true,
        isConnecting: false,
      })

      logger.info('[MetaStore] Connected to Meta successfully')
      return true
    } catch (err: any) {
      logger.error('[MetaStore] Connect error:', err)
      set({
        isConnecting: false,
        connectionError: err.message || 'Failed to connect',
      })
      return false
    }
  },

  disconnect: async (vendorId: string) => {
    try {
      const { error } = await supabase
        .from('meta_integrations')
        .update({ status: 'disconnected' })
        .eq('vendor_id', vendorId)

      if (error) throw error

      set({
        integration: null,
        isConnected: false,
        campaigns: [],
        adSets: [],
        ads: [],
        audiences: [],
      })

      logger.info('[MetaStore] Disconnected from Meta')
    } catch (err) {
      logger.error('[MetaStore] Disconnect error:', err)
    }
  },

  updateIntegration: async (vendorId: string, updates: Partial<MetaIntegration>) => {
    try {
      const { data, error } = await supabase
        .from('meta_integrations')
        .update(updates)
        .eq('vendor_id', vendorId)
        .select()
        .single()

      if (error) throw error

      set({ integration: data })
    } catch (err) {
      logger.error('[MetaStore] Update integration error:', err)
    }
  },

  // ============================================================================
  // CAMPAIGNS
  // ============================================================================

  loadCampaigns: async (vendorId: string) => {
    set({ isLoadingCampaigns: true })

    try {
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ campaigns: data || [], isLoadingCampaigns: false })
    } catch (err) {
      logger.error('[MetaStore] Load campaigns error:', err)
      set({ isLoadingCampaigns: false })
    }
  },

  syncCampaigns: async (vendorId: string) => {
    set({ isSyncing: true })

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-sync-campaigns`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync campaigns')
      }

      // Reload campaigns after sync
      await get().loadCampaigns(vendorId)

      set({ isSyncing: false })
      logger.info('[MetaStore] Campaigns synced successfully')
      return true
    } catch (err) {
      logger.error('[MetaStore] Sync campaigns error:', err)
      set({ isSyncing: false })
      return false
    }
  },

  createCampaign: async (vendorId: string, campaign: CreateCampaignParams) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-create-campaign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, ...campaign }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create campaign')
      }

      const newCampaign = await response.json()

      set(state => ({
        campaigns: [newCampaign, ...state.campaigns],
      }))

      return newCampaign
    } catch (err) {
      logger.error('[MetaStore] Create campaign error:', err)
      return null
    }
  },

  updateCampaignStatus: async (vendorId: string, metaCampaignId: string, status: 'ACTIVE' | 'PAUSED') => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-update-campaign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, metaCampaignId, status }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update campaign status')
      }

      // Update local state
      set(state => ({
        campaigns: state.campaigns.map(c =>
          c.meta_campaign_id === metaCampaignId ? { ...c, status } : c
        ),
      }))

      return true
    } catch (err) {
      logger.error('[MetaStore] Update campaign status error:', err)
      return false
    }
  },

  // ============================================================================
  // AD SETS
  // ============================================================================

  loadAdSets: async (vendorId: string, campaignId?: string) => {
    try {
      let query = supabase
        .from('meta_ad_sets')
        .select('*')
        .eq('vendor_id', vendorId)

      if (campaignId) {
        query = query.eq('meta_campaign_id', campaignId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      set({ adSets: data || [] })
    } catch (err) {
      logger.error('[MetaStore] Load ad sets error:', err)
    }
  },

  // ============================================================================
  // ADS
  // ============================================================================

  loadAds: async (vendorId: string, adSetId?: string) => {
    try {
      let query = supabase
        .from('meta_ads')
        .select('*')
        .eq('vendor_id', vendorId)

      if (adSetId) {
        query = query.eq('meta_ad_set_id', adSetId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      set({ ads: data || [] })
    } catch (err) {
      logger.error('[MetaStore] Load ads error:', err)
    }
  },

  // ============================================================================
  // AUDIENCES
  // ============================================================================

  loadAudiences: async (vendorId: string) => {
    set({ isLoadingAudiences: true })

    try {
      const { data, error } = await supabase
        .from('meta_audiences')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ audiences: data || [], isLoadingAudiences: false })
    } catch (err) {
      logger.error('[MetaStore] Load audiences error:', err)
      set({ isLoadingAudiences: false })
    }
  },

  syncAudienceFromSegment: async (vendorId: string, segmentId: string, name: string) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-sync-audience`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, segmentId, name }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to sync audience')
      }

      const audience = await response.json()

      set(state => ({
        audiences: [audience, ...state.audiences.filter(a => a.id !== audience.id)],
      }))

      return audience
    } catch (err) {
      logger.error('[MetaStore] Sync audience error:', err)
      return null
    }
  },

  createLookalikeAudience: async (vendorId: string, sourceAudienceId: string, country: string, ratio: number) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-create-lookalike`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, sourceAudienceId, country, ratio }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to create lookalike audience')
      }

      const audience = await response.json()

      set(state => ({
        audiences: [audience, ...state.audiences],
      }))

      return audience
    } catch (err) {
      logger.error('[MetaStore] Create lookalike error:', err)
      return null
    }
  },

  // ============================================================================
  // CONVERSIONS
  // ============================================================================

  loadConversionEvents: async (vendorId: string, limit = 100) => {
    set({ isLoadingEvents: true })

    try {
      const { data, error } = await supabase
        .from('meta_conversion_events')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('event_time', { ascending: false })
        .limit(limit)

      if (error) throw error

      set({ conversionEvents: data || [], isLoadingEvents: false })
    } catch (err) {
      logger.error('[MetaStore] Load conversion events error:', err)
      set({ isLoadingEvents: false })
    }
  },

  sendConversionEvent: async (vendorId: string, event: SendConversionParams) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-send-conversion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, ...event }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to send conversion event')
      }

      logger.info('[MetaStore] Conversion event sent:', event.event_name)
      return true
    } catch (err) {
      logger.error('[MetaStore] Send conversion error:', err)
      return false
    }
  },

  // ============================================================================
  // INSIGHTS
  // ============================================================================

  loadAccountInsights: async (vendorId: string, dateStart: string, dateStop: string) => {
    set({ isLoadingInsights: true })

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-get-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, dateStart, dateStop }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load insights')
      }

      const insights = await response.json()
      set({ accountInsights: insights, isLoadingInsights: false })
    } catch (err) {
      logger.error('[MetaStore] Load insights error:', err)
      set({ isLoadingInsights: false })
    }
  },

  loadFullInsights: async (vendorId: string, dateStart?: string, dateEnd?: string, breakdown: 'day' | 'week' | 'month' = 'day') => {
    set({ isLoadingInsights: true })

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-get-insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, dateStart, dateEnd, breakdown }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load insights')
      }

      const insights: MetaFullInsights = await response.json()
      set({ fullInsights: insights, isLoadingInsights: false })
      logger.info('[MetaStore] Full insights loaded:', {
        hasSummary: !!insights.summary,
        dailyCount: insights.daily?.length || 0,
        campaignCount: insights.campaigns?.length || 0
      })
    } catch (err) {
      logger.error('[MetaStore] Load full insights error:', err)
      set({ isLoadingInsights: false })
    }
  },

  // ============================================================================
  // POSTS
  // ============================================================================

  loadPosts: async (vendorId: string, platform: 'all' | 'facebook' | 'instagram' = 'all') => {
    set({ isLoadingPosts: true })

    try {
      let query = supabase
        .from('meta_posts')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_time', { ascending: false })

      if (platform !== 'all') {
        query = query.eq('platform', platform)
      }

      const { data, error } = await query.limit(100)

      if (error) throw error

      set({ posts: data || [], isLoadingPosts: false })
      logger.info('[MetaStore] Posts loaded:', { count: data?.length || 0 })
    } catch (err) {
      logger.error('[MetaStore] Load posts error:', err)
      set({ isLoadingPosts: false })
    }
  },

  syncPosts: async (vendorId: string, platform: 'all' | 'facebook' | 'instagram' = 'all') => {
    set({ isSyncingPosts: true })

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/meta-fetch-posts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, platform }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to sync posts')
      }

      const result = await response.json()
      logger.info('[MetaStore] Posts synced:', result)

      // Reload posts after sync
      await get().loadPosts(vendorId, platform)

      set({ isSyncingPosts: false })
      return true
    } catch (err) {
      logger.error('[MetaStore] Sync posts error:', err)
      set({ isSyncingPosts: false })
      return false
    }
  },

  // ============================================================================
  // REALTIME
  // ============================================================================

  subscribeToRealtime: (vendorId: string) => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }

    logger.info('[MetaStore] Subscribing to realtime updates')

    realtimeChannel = supabase
      .channel(`meta-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meta_campaigns',
        },
        (payload) => {
          const record = (payload.new || payload.old) as MetaCampaign
          if (record?.vendor_id !== vendorId) return

          if (payload.eventType === 'UPDATE') {
            set(state => ({
              campaigns: state.campaigns.map(c =>
                c.id === record.id ? record : c
              ),
            }))
          } else if (payload.eventType === 'INSERT') {
            set(state => ({
              campaigns: [record, ...state.campaigns.filter(c => c.id !== record.id)],
            }))
          } else if (payload.eventType === 'DELETE') {
            set(state => ({
              campaigns: state.campaigns.filter(c => c.id !== (payload.old as { id: string }).id),
            }))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meta_integrations',
        },
        (payload) => {
          const record = (payload.new || payload.old) as MetaIntegration
          if (record?.vendor_id !== vendorId) return

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            set({
              integration: record,
              isConnected: record.status === 'active',
            })
          }
        }
      )
      .subscribe((status) => {
        logger.info('[MetaStore] Realtime subscription status:', status)
      })
  },

  unsubscribeFromRealtime: () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  },

  // ============================================================================
  // UI
  // ============================================================================

  selectCampaign: (id) => set({ selectedCampaignId: id }),
  selectAdSet: (id) => set({ selectedAdSetId: id }),
  selectPost: (id) => set({ selectedPostId: id }),
  setPostsFilter: (filter) => set({ postsFilter: filter }),
  setDateRange: (start, end) => set({ dateRange: { start, end } }),
}))

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export const useMetaIntegration = () => useMetaStore(state => state.integration)
export const useIsMetaConnected = () => useMetaStore(state => state.isConnected)
export const useIsMetaConnecting = () => useMetaStore(state => state.isConnecting)
export const useMetaConnectionError = () => useMetaStore(state => state.connectionError)

export const useMetaCampaigns = () => useMetaStore(state => state.campaigns)
export const useMetaAdSets = () => useMetaStore(state => state.adSets)
export const useMetaAds = () => useMetaStore(state => state.ads)
export const useIsLoadingMetaCampaigns = () => useMetaStore(state => state.isLoadingCampaigns)
export const useIsMetaSyncing = () => useMetaStore(state => state.isSyncing)

export const useMetaAudiences = () => useMetaStore(state => state.audiences)
export const useIsLoadingMetaAudiences = () => useMetaStore(state => state.isLoadingAudiences)

export const useMetaConversionEvents = () => useMetaStore(state => state.conversionEvents)

export const useMetaAccountInsights = () => useMetaStore(state => state.accountInsights)
export const useMetaFullInsights = () => useMetaStore(state => state.fullInsights)
export const useIsLoadingMetaInsights = () => useMetaStore(state => state.isLoadingInsights)

export const useMetaPosts = () => useMetaStore(state => state.posts)
export const useIsLoadingMetaPosts = () => useMetaStore(state => state.isLoadingPosts)
export const useIsSyncingMetaPosts = () => useMetaStore(state => state.isSyncingPosts)
export const useMetaPostsFilter = () => useMetaStore(state => state.postsFilter)
export const useSelectedMetaPostId = () => useMetaStore(state => state.selectedPostId)

export const useSelectedMetaCampaignId = () => useMetaStore(state => state.selectedCampaignId)
export const useMetaDateRange = () => useMetaStore(state => state.dateRange)

export const useMetaActions = () => useMetaStore(
  useShallow(state => ({
    loadIntegration: state.loadIntegration,
    connect: state.connect,
    disconnect: state.disconnect,
    updateIntegration: state.updateIntegration,
    loadCampaigns: state.loadCampaigns,
    syncCampaigns: state.syncCampaigns,
    createCampaign: state.createCampaign,
    updateCampaignStatus: state.updateCampaignStatus,
    loadAdSets: state.loadAdSets,
    loadAds: state.loadAds,
    loadAudiences: state.loadAudiences,
    syncAudienceFromSegment: state.syncAudienceFromSegment,
    createLookalikeAudience: state.createLookalikeAudience,
    loadConversionEvents: state.loadConversionEvents,
    sendConversionEvent: state.sendConversionEvent,
    loadAccountInsights: state.loadAccountInsights,
    loadFullInsights: state.loadFullInsights,
    loadPosts: state.loadPosts,
    syncPosts: state.syncPosts,
    subscribeToRealtime: state.subscribeToRealtime,
    unsubscribeFromRealtime: state.unsubscribeFromRealtime,
    selectCampaign: state.selectCampaign,
    selectAdSet: state.selectAdSet,
    selectPost: state.selectPost,
    setPostsFilter: state.setPostsFilter,
    setDateRange: state.setDateRange,
  }))
)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format currency for Meta spend values
 */
export const formatMetaSpend = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Format large numbers for impressions/reach
 */
export const formatMetaNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}

/**
 * Calculate ROAS from spend and conversion value
 */
export const calculateROAS = (spend: number, conversionValue: number): number => {
  if (spend === 0) return 0
  return conversionValue / spend
}
