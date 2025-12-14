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
  access_token?: string // For direct API calls (read-only operations)
  created_at: string
  updated_at: string
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

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

  // Campaign Drafts
  saveCampaignDraft: (vendorId: string, draft: CampaignDraftParams) => Promise<void>
  deleteCampaignDraft: (draftId: string) => Promise<void>

  // Ad Sets
  loadAdSets: (vendorId: string, campaignId?: string) => Promise<void>
  createAdSet: (vendorId: string, adSet: CreateAdSetParams) => Promise<MetaAdSet | null>
  updateAdSet: (vendorId: string, metaAdSetId: string, updates: UpdateAdSetParams) => Promise<boolean>
  updateAdSetStatus: (vendorId: string, metaAdSetId: string, status: 'ACTIVE' | 'PAUSED') => Promise<boolean>

  // Ads
  loadAds: (vendorId: string, adSetId?: string) => Promise<void>
  createAd: (vendorId: string, ad: CreateAdParams) => Promise<MetaAd | null>
  updateAd: (vendorId: string, metaAdId: string, updates: UpdateAdParams) => Promise<boolean>
  updateAdStatus: (vendorId: string, metaAdId: string, status: 'ACTIVE' | 'PAUSED') => Promise<boolean>

  // Creative
  uploadImage: (vendorId: string, imageData: string, filename?: string) => Promise<{ imageHash: string; url?: string } | null>
  searchTargeting: (vendorId: string, type: string, query: string) => Promise<any[]>

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
  status?: 'ACTIVE' | 'PAUSED'
  daily_budget?: number
  lifetime_budget?: number
  start_time?: string
  stop_time?: string
}

interface CampaignDraftParams {
  id?: string
  name: string
  objective: string
  daily_budget?: number
  lifetime_budget?: number
  status: 'DRAFT'
}

interface CreateAdSetParams {
  campaignId: string
  name: string
  status?: 'ACTIVE' | 'PAUSED'
  daily_budget?: number
  lifetime_budget?: number
  start_time?: string
  end_time?: string
  optimization_goal?: string
  billing_event?: string
  bid_strategy?: string
  bid_amount?: number
  targeting?: {
    geo_locations?: {
      countries?: string[]
      cities?: { key: string; radius?: number; distance_unit?: string }[]
      regions?: { key: string }[]
    }
    age_min?: number
    age_max?: number
    genders?: number[]
    interests?: { id: string; name: string }[]
    behaviors?: { id: string; name: string }[]
    custom_audiences?: { id: string }[]
    excluded_custom_audiences?: { id: string }[]
    publisher_platforms?: string[]
    facebook_positions?: string[]
    instagram_positions?: string[]
  }
}

interface UpdateAdSetParams {
  name?: string
  status?: 'ACTIVE' | 'PAUSED' | 'DELETED'
  daily_budget?: number
  lifetime_budget?: number
  start_time?: string
  end_time?: string
  optimization_goal?: string
  bid_strategy?: string
  bid_amount?: number
  targeting?: CreateAdSetParams['targeting']
}

interface CreateAdParams {
  adSetId: string
  name: string
  status?: 'ACTIVE' | 'PAUSED'
  creativeId?: string
  creative?: {
    name?: string
    link_data?: {
      link: string
      message?: string
      name?: string
      description?: string
      call_to_action?: { type: string; value?: { link?: string } }
      image_hash?: string
      image_url?: string
      video_id?: string
    }
    object_story_spec?: {
      page_id: string
      instagram_actor_id?: string
      link_data?: any
      video_data?: any
    }
  }
  tracking_specs?: any[]
  conversion_domain?: string
}

interface UpdateAdParams {
  name?: string
  status?: 'ACTIVE' | 'PAUSED' | 'DELETED'
  creativeId?: string
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
// HELPERS
// ============================================================================

function calculateFallbackEstimate(targeting: any) {
  // Base US audience ~250M
  let estimate = 250000000

  // Age range reduction
  const ageRange = (targeting?.age_max || 65) - (targeting?.age_min || 18)
  const ageMultiplier = ageRange / 52 // 52 year range (13-65)
  estimate *= ageMultiplier

  // Gender reduction
  if (targeting?.genders?.length === 1) {
    estimate *= 0.5
  }

  // Interests narrow the audience
  if (targeting?.interests?.length > 0) {
    estimate *= Math.max(0.1, 1 - (targeting.interests.length * 0.15))
  }

  // Platform reduction
  if (targeting?.publisher_platforms?.length === 1) {
    estimate *= 0.6
  }

  const lowerBound = Math.round(estimate * 0.7)
  const upperBound = Math.round(estimate * 1.3)

  return {
    users_lower_bound: lowerBound,
    users_upper_bound: upperBound,
  }
}

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
        .select('*, access_token_encrypted')
        .eq('vendor_id', vendorId)
        .maybeSingle()

      if (error) throw error

      const isConnected = data?.status === 'active'
      // Map access_token_encrypted to access_token for direct API calls
      const integration = data ? {
        ...data,
        access_token: data.access_token_encrypted,
      } : null
      set({ integration, isConnected })

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
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      // Fetch campaigns directly from Meta
      const fields = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time'
      const params = new URLSearchParams({
        fields,
        limit: '100',
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/campaigns?${params}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message || 'Failed to sync campaigns')
      }

      // Upsert campaigns to database
      const campaigns = data.data || []
      for (const campaign of campaigns) {
        await supabase.from('meta_campaigns').upsert({
          vendor_id: vendorId,
          meta_campaign_id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          effective_status: campaign.effective_status,
          objective: campaign.objective,
          daily_budget: campaign.daily_budget ? parseInt(campaign.daily_budget) / 100 : null,
          lifetime_budget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget) / 100 : null,
          start_time: campaign.start_time,
          end_time: campaign.stop_time,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'meta_campaign_id' })
      }

      // Reload campaigns from DB
      await get().loadCampaigns(vendorId)

      set({ isSyncing: false })
      logger.info('[MetaStore] Campaigns synced successfully', { count: campaigns.length })
      return true
    } catch (err) {
      logger.error('[MetaStore] Sync campaigns error:', err)
      set({ isSyncing: false })
      return false
    }
  },

  createCampaign: async (vendorId: string, campaign: CreateCampaignParams) => {
    try {
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      // Create campaign directly via Meta API
      const params = new URLSearchParams({
        name: campaign.name,
        objective: campaign.objective || 'OUTCOME_TRAFFIC',
        status: campaign.status || 'PAUSED',
        special_ad_categories: '[]',
        access_token: integration.access_token,
      })

      if (campaign.daily_budget) {
        params.append('daily_budget', String(Math.round(campaign.daily_budget * 100)))
      }
      if (campaign.lifetime_budget) {
        params.append('lifetime_budget', String(Math.round(campaign.lifetime_budget * 100)))
      }

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.error_user_msg || data.error.message || 'Failed to create campaign')
      }

      // Save to database
      const newCampaign = {
        vendor_id: vendorId,
        meta_campaign_id: data.id,
        name: campaign.name,
        status: campaign.status || 'PAUSED',
        effective_status: campaign.status || 'PAUSED',
        objective: campaign.objective || 'OUTCOME_TRAFFIC',
        daily_budget: campaign.daily_budget,
        lifetime_budget: campaign.lifetime_budget,
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      const { data: savedCampaign } = await supabase
        .from('meta_campaigns')
        .insert(newCampaign)
        .select()
        .single()

      if (savedCampaign) {
        set(state => ({ campaigns: [savedCampaign, ...state.campaigns] }))
      }

      logger.info('[MetaStore] Campaign created:', data.id)
      return savedCampaign || newCampaign
    } catch (err: any) {
      logger.error('[MetaStore] Create campaign error:', err)
      throw err
    }
  },

  updateCampaignStatus: async (_vendorId: string, metaCampaignId: string, status: 'ACTIVE' | 'PAUSED') => {
    try {
      const { integration } = get()
      if (!integration?.access_token) {
        throw new Error('Not connected to Meta')
      }

      // Update directly via Meta API
      const params = new URLSearchParams({
        status,
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${metaCampaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to update campaign status')
      }

      // Update local state
      set(state => ({
        campaigns: state.campaigns.map(c =>
          c.meta_campaign_id === metaCampaignId ? { ...c, status } : c
        ),
      }))

      // Update in database
      await supabase
        .from('meta_campaigns')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('meta_campaign_id', metaCampaignId)

      return true
    } catch (err) {
      logger.error('[MetaStore] Update campaign status error:', err)
      return false
    }
  },

  // ============================================================================
  // CAMPAIGN DRAFTS
  // ============================================================================

  saveCampaignDraft: async (vendorId: string, draft: CampaignDraftParams) => {
    try {
      const draftData = {
        vendor_id: vendorId,
        name: draft.name,
        objective: draft.objective,
        daily_budget: draft.daily_budget || null,
        lifetime_budget: draft.lifetime_budget || null,
        status: 'DRAFT',
        meta_campaign_id: `draft_${Date.now()}`, // Placeholder ID for drafts
        meta_account_id: 'draft',
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        conversion_value: 0,
        updated_at: new Date().toISOString(),
      }

      if (draft.id) {
        // Update existing draft
        const { error } = await supabase
          .from('meta_campaigns')
          .update(draftData)
          .eq('id', draft.id)

        if (error) throw error
        logger.info('[MetaStore] Draft updated:', draft.id)
      } else {
        // Insert new draft
        const { error } = await supabase
          .from('meta_campaigns')
          .insert({
            ...draftData,
            created_at: new Date().toISOString(),
          })

        if (error) throw error
        logger.info('[MetaStore] Draft saved')
      }

      // Reload campaigns to show the draft
      await get().loadCampaigns(vendorId)
    } catch (err) {
      logger.error('[MetaStore] Save draft error:', err)
      throw err
    }
  },

  deleteCampaignDraft: async (draftId: string) => {
    try {
      const { error } = await supabase
        .from('meta_campaigns')
        .delete()
        .eq('id', draftId)

      if (error) throw error

      // Remove from local state
      set(state => ({
        campaigns: state.campaigns.filter(c => c.id !== draftId),
      }))

      logger.info('[MetaStore] Draft deleted:', draftId)
    } catch (err) {
      logger.error('[MetaStore] Delete draft error:', err)
      throw err
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

  createAdSet: async (vendorId: string, adSet: CreateAdSetParams) => {
    try {
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      // Build targeting spec
      const targetingSpec: Record<string, any> = {}
      if (adSet.targeting?.geo_locations) {
        targetingSpec.geo_locations = adSet.targeting.geo_locations
      } else {
        targetingSpec.geo_locations = { countries: ['US'] }
      }
      if (adSet.targeting?.age_min) targetingSpec.age_min = adSet.targeting.age_min
      if (adSet.targeting?.age_max) targetingSpec.age_max = adSet.targeting.age_max
      if (adSet.targeting?.genders) targetingSpec.genders = adSet.targeting.genders
      if (adSet.targeting?.interests?.length) {
        targetingSpec.flexible_spec = [{ interests: adSet.targeting.interests }]
      }
      if (adSet.targeting?.publisher_platforms) {
        targetingSpec.publisher_platforms = adSet.targeting.publisher_platforms
      }

      // Create ad set directly via Meta API
      const params = new URLSearchParams({
        name: adSet.name,
        campaign_id: adSet.campaignId,
        status: adSet.status || 'PAUSED',
        optimization_goal: adSet.optimization_goal || 'LINK_CLICKS',
        billing_event: adSet.billing_event || 'IMPRESSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: JSON.stringify(targetingSpec),
        access_token: integration.access_token,
      })

      if (adSet.daily_budget) {
        params.append('daily_budget', String(Math.round(adSet.daily_budget * 100)))
      }

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/adsets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.error_user_msg || data.error.message || 'Failed to create ad set')
      }

      // Save to database
      const newAdSet = {
        vendor_id: vendorId,
        meta_ad_set_id: data.id,
        meta_campaign_id: adSet.campaignId,
        name: adSet.name,
        status: adSet.status || 'PAUSED',
        effective_status: adSet.status || 'PAUSED',
        optimization_goal: adSet.optimization_goal || 'LINK_CLICKS',
        billing_event: adSet.billing_event || 'IMPRESSIONS',
        daily_budget: adSet.daily_budget,
        targeting: targetingSpec,
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      const { data: savedAdSet } = await supabase
        .from('meta_ad_sets')
        .insert(newAdSet)
        .select()
        .single()

      if (savedAdSet) {
        set(state => ({ adSets: [savedAdSet, ...state.adSets] }))
      }

      logger.info('[MetaStore] Ad set created:', data.id)
      return savedAdSet || newAdSet
    } catch (err: any) {
      logger.error('[MetaStore] Create ad set error:', err)
      throw err
    }
  },

  updateAdSet: async (_vendorId: string, metaAdSetId: string, updates: UpdateAdSetParams) => {
    try {
      const { integration } = get()
      if (!integration?.access_token) {
        throw new Error('Not connected to Meta')
      }

      const params = new URLSearchParams({ access_token: integration.access_token })
      if (updates.name) params.append('name', updates.name)
      if (updates.status) params.append('status', updates.status)
      if (updates.daily_budget) params.append('daily_budget', String(Math.round(updates.daily_budget * 100)))

      const response = await fetch(`${META_GRAPH_API}/${metaAdSetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to update ad set')
      }

      // Update local state
      set(state => ({
        adSets: state.adSets.map(a =>
          a.meta_ad_set_id === metaAdSetId ? { ...a, ...updates } : a
        ),
      }))

      // Update in database
      await supabase
        .from('meta_ad_sets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('meta_ad_set_id', metaAdSetId)

      logger.info('[MetaStore] Ad set updated:', metaAdSetId)
      return true
    } catch (err: any) {
      logger.error('[MetaStore] Update ad set error:', err)
      throw err
    }
  },

  updateAdSetStatus: async (_vendorId: string, metaAdSetId: string, status: 'ACTIVE' | 'PAUSED') => {
    try {
      const { integration } = get()
      if (!integration?.access_token) {
        throw new Error('Not connected to Meta')
      }

      const params = new URLSearchParams({
        status,
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${metaAdSetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to update ad set status')
      }

      set(state => ({
        adSets: state.adSets.map(a =>
          a.meta_ad_set_id === metaAdSetId ? { ...a, status } : a
        ),
      }))

      await supabase
        .from('meta_ad_sets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('meta_ad_set_id', metaAdSetId)

      return true
    } catch (err) {
      logger.error('[MetaStore] Update ad set status error:', err)
      return false
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

  createAd: async (vendorId: string, ad: CreateAdParams) => {
    try {
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      // First, create the ad creative
      const creativeData: Record<string, any> = {
        name: `${ad.name} Creative`,
        object_story_spec: {
          page_id: integration.page_id,
          link_data: {
            link: ad.websiteUrl || 'https://example.com',
            message: ad.primaryText || '',
            name: ad.headline || ad.name,
            call_to_action: { type: ad.callToAction || 'LEARN_MORE' },
          },
        },
      }

      if (ad.imageHash) {
        creativeData.object_story_spec.link_data.image_hash = ad.imageHash
      }

      const creativeParams = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(creativeData).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v])
        ),
        access_token: integration.access_token,
      })

      const creativeResponse = await fetch(`${META_GRAPH_API}/${adAccountId}/adcreatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: creativeParams,
      })

      const creativeResult = await creativeResponse.json()
      if (creativeResult.error) {
        throw new Error(creativeResult.error.error_user_msg || creativeResult.error.message || 'Failed to create creative')
      }

      // Now create the ad
      const adParams = new URLSearchParams({
        name: ad.name,
        adset_id: ad.adSetId,
        creative: JSON.stringify({ creative_id: creativeResult.id }),
        status: ad.status || 'PAUSED',
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: adParams,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.error_user_msg || data.error.message || 'Failed to create ad')
      }

      // Save to database
      const newAd = {
        vendor_id: vendorId,
        meta_ad_id: data.id,
        meta_ad_set_id: ad.adSetId,
        name: ad.name,
        status: ad.status || 'PAUSED',
        effective_status: ad.status || 'PAUSED',
        creative_id: creativeResult.id,
        headline: ad.headline,
        primary_text: ad.primaryText,
        website_url: ad.websiteUrl,
        call_to_action: ad.callToAction,
        image_hash: ad.imageHash,
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      const { data: savedAd } = await supabase
        .from('meta_ads')
        .insert(newAd)
        .select()
        .single()

      if (savedAd) {
        set(state => ({ ads: [savedAd, ...state.ads] }))
      }

      logger.info('[MetaStore] Ad created:', data.id)
      return savedAd || newAd
    } catch (err: any) {
      logger.error('[MetaStore] Create ad error:', err)
      throw err
    }
  },

  updateAd: async (_vendorId: string, metaAdId: string, updates: UpdateAdParams) => {
    try {
      const { integration } = get()
      if (!integration?.access_token) {
        throw new Error('Not connected to Meta')
      }

      const params = new URLSearchParams({ access_token: integration.access_token })
      if (updates.name) params.append('name', updates.name)
      if (updates.status) params.append('status', updates.status)

      const response = await fetch(`${META_GRAPH_API}/${metaAdId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to update ad')
      }

      set(state => ({
        ads: state.ads.map(a =>
          a.meta_ad_id === metaAdId ? { ...a, ...updates } : a
        ),
      }))

      await supabase
        .from('meta_ads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('meta_ad_id', metaAdId)

      logger.info('[MetaStore] Ad updated:', metaAdId)
      return true
    } catch (err: any) {
      logger.error('[MetaStore] Update ad error:', err)
      throw err
    }
  },

  updateAdStatus: async (_vendorId: string, metaAdId: string, status: 'ACTIVE' | 'PAUSED') => {
    try {
      const { integration } = get()
      if (!integration?.access_token) {
        throw new Error('Not connected to Meta')
      }

      const params = new URLSearchParams({
        status,
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${metaAdId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to update ad status')
      }

      set(state => ({
        ads: state.ads.map(a =>
          a.meta_ad_id === metaAdId ? { ...a, status } : a
        ),
      }))

      await supabase
        .from('meta_ads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('meta_ad_id', metaAdId)

      return true
    } catch (err) {
      logger.error('[MetaStore] Update ad status error:', err)
      return false
    }
  },

  // Reach Estimation - Live audience size
  getReachEstimate: async (_vendorId: string, targeting: any, optimization_goal: string = 'LINK_CLICKS') => {
    try {
      // Get access token and ad account from store for direct Meta API call
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        logger.warn('[MetaStore] No access token or ad account for reach estimate')
        return null
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) {
        adAccountId = `act_${adAccountId}`
      }

      // Build targeting spec
      const targetingSpec: Record<string, any> = {}
      if (targeting?.geo_locations) {
        targetingSpec.geo_locations = targeting.geo_locations
      } else {
        targetingSpec.geo_locations = { countries: ['US'] }
      }
      if (targeting?.age_min) targetingSpec.age_min = targeting.age_min
      if (targeting?.age_max) targetingSpec.age_max = targeting.age_max
      if (targeting?.genders?.length > 0) targetingSpec.genders = targeting.genders
      if (targeting?.interests?.length > 0) {
        targetingSpec.flexible_spec = [{ interests: targeting.interests }]
      }
      if (targeting?.publisher_platforms?.length > 0) {
        targetingSpec.publisher_platforms = targeting.publisher_platforms
      }

      // Call Meta directly - delivery_estimate endpoint
      const params = new URLSearchParams({
        targeting_spec: JSON.stringify(targetingSpec),
        optimization_goal,
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/delivery_estimate?${params}`)
      const data = await response.json()

      if (data.error) {
        logger.warn('[MetaStore] Meta delivery_estimate error:', data.error.message)
        // Return fallback estimate
        return calculateFallbackEstimate(targeting)
      }

      if (data.data && data.data.length > 0) {
        const estimate = data.data[0]
        return {
          users_lower_bound: estimate.estimate_dau || estimate.estimate_mau_lower_bound || 100000,
          users_upper_bound: estimate.estimate_mau || estimate.estimate_mau_upper_bound || 1000000,
        }
      }

      return calculateFallbackEstimate(targeting)
    } catch (err) {
      logger.error('[MetaStore] Reach estimate error:', err)
      return calculateFallbackEstimate(targeting)
    }
  },

  // Creative & Targeting
  uploadImage: async (_vendorId: string, imageData: string, _filename?: string) => {
    try {
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      // Upload image to Meta directly
      const formData = new FormData()
      formData.append('bytes', imageData)
      formData.append('access_token', integration.access_token)

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/adimages`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to upload image')
      }

      // Get the image hash from response
      const images = data.images || {}
      const imageHash = Object.keys(images)[0] ? images[Object.keys(images)[0]].hash : null

      if (!imageHash) {
        throw new Error('No image hash returned')
      }

      logger.info('[MetaStore] Image uploaded:', imageHash)
      return { imageHash, url: images[Object.keys(images)[0]]?.url }
    } catch (err: any) {
      logger.error('[MetaStore] Upload image error:', err)
      return null
    }
  },

  searchTargeting: (() => {
    // Simple in-memory cache for fast repeated searches
    const cache = new Map<string, { data: any[]; timestamp: number }>()
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

    return async (_vendorId: string, type: string, query: string) => {
      const cacheKey = `${type}:${query.toLowerCase()}`
      const cached = cache.get(cacheKey)

      // Return cached result if fresh
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data
      }

      try {
        // Get access token from store for direct Meta API call (FAST!)
        const { integration } = get()
        if (!integration?.access_token) {
          logger.warn('[MetaStore] No access token for direct API call')
          return []
        }

        // Map type to Meta's search type
        let searchType = 'adinterest'
        if (type === 'behaviors') searchType = 'adbehavior'
        if (type === 'demographics') searchType = 'adTargetingCategory'

        // Call Meta directly - no edge function overhead!
        const params = new URLSearchParams({
          type: searchType,
          q: query,
          limit: '25',
          access_token: integration.access_token,
        })

        const response = await fetch(`${META_GRAPH_API}/search?${params}`)
        const data = await response.json()

        if (data.error) {
          logger.error('[MetaStore] Meta API error:', data.error)
          return []
        }

        const results = data.data || []

        // Cache the results
        cache.set(cacheKey, { data: results, timestamp: Date.now() })

        // Clean old cache entries (keep last 50)
        if (cache.size > 50) {
          const oldestKey = cache.keys().next().value
          if (oldestKey) cache.delete(oldestKey)
        }

        return results
      } catch (err) {
        logger.error('[MetaStore] Search targeting error:', err)
        return []
      }
    }
  })(),

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
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      // Get customers from segment
      const { data: customers, error } = await supabase
        .from('customer_segments')
        .select('customers(email, phone)')
        .eq('segment_id', segmentId)
        .limit(10000)

      if (error) throw error

      // Create custom audience
      const params = new URLSearchParams({
        name,
        subtype: 'CUSTOM',
        description: `Synced from segment: ${segmentId}`,
        customer_file_source: 'USER_PROVIDED_ONLY',
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/customaudiences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to create audience')
      }

      // Save to database
      const audience = {
        vendor_id: vendorId,
        meta_audience_id: data.id,
        name,
        segment_id: segmentId,
        type: 'custom',
        size: customers?.length || 0,
        status: 'ready',
        created_at: new Date().toISOString(),
      }

      await supabase.from('meta_audiences').upsert(audience, { onConflict: 'meta_audience_id' })

      set(state => ({
        audiences: [audience as any, ...state.audiences.filter(a => a.meta_audience_id !== data.id)],
      }))

      logger.info('[MetaStore] Audience synced:', data.id)
      return audience
    } catch (err) {
      logger.error('[MetaStore] Sync audience error:', err)
      return null
    }
  },

  createLookalikeAudience: async (vendorId: string, sourceAudienceId: string, country: string, ratio: number) => {
    try {
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      const params = new URLSearchParams({
        name: `Lookalike - ${ratio}% - ${country}`,
        subtype: 'LOOKALIKE',
        origin_audience_id: sourceAudienceId,
        lookalike_spec: JSON.stringify({
          type: 'similarity',
          country,
          ratio: ratio / 100,
        }),
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/customaudiences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to create lookalike')
      }

      const audience = {
        vendor_id: vendorId,
        meta_audience_id: data.id,
        name: `Lookalike - ${ratio}% - ${country}`,
        type: 'lookalike',
        source_audience_id: sourceAudienceId,
        country,
        ratio,
        status: 'ready',
        created_at: new Date().toISOString(),
      }

      await supabase.from('meta_audiences').insert(audience)

      set(state => ({
        audiences: [audience as any, ...state.audiences],
      }))

      logger.info('[MetaStore] Lookalike created:', data.id)
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
      const { integration } = get()
      if (!integration?.access_token || !integration?.pixel_id) {
        throw new Error('Not connected to Meta or no Pixel configured')
      }

      // Send via Conversions API
      const eventData = {
        event_name: event.event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: {
          em: event.email ? [event.email] : undefined,
          ph: event.phone ? [event.phone] : undefined,
          client_ip_address: event.client_ip,
          client_user_agent: event.user_agent,
          external_id: event.external_id ? [event.external_id] : undefined,
        },
        custom_data: {
          currency: event.currency || 'USD',
          value: event.value,
          content_ids: event.content_ids,
          content_type: 'product',
        },
        event_source_url: event.event_source_url,
      }

      const params = new URLSearchParams({
        data: JSON.stringify([eventData]),
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${integration.pixel_id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message || 'Failed to send conversion')
      }

      // Log to database
      await supabase.from('meta_conversion_events').insert({
        vendor_id: vendorId,
        event_name: event.event_name,
        event_time: new Date().toISOString(),
        value: event.value,
        currency: event.currency || 'USD',
        status: 'sent',
        events_received: data.events_received,
      })

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

  loadAccountInsights: async (_vendorId: string, dateStart: string, dateStop: string) => {
    set({ isLoadingInsights: true })

    try {
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      const fields = 'impressions,reach,clicks,spend,cpc,cpm,ctr'
      const params = new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since: dateStart, until: dateStop }),
        access_token: integration.access_token,
      })

      const response = await fetch(`${META_GRAPH_API}/${adAccountId}/insights?${params}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message || 'Failed to load insights')
      }

      set({ accountInsights: data.data?.[0] || {}, isLoadingInsights: false })
    } catch (err) {
      logger.error('[MetaStore] Load insights error:', err)
      set({ isLoadingInsights: false })
    }
  },

  loadFullInsights: async (_vendorId: string, dateStart?: string, dateEnd?: string, breakdown: 'day' | 'week' | 'month' = 'day') => {
    set({ isLoadingInsights: true })

    try {
      const { integration } = get()
      if (!integration?.access_token || !integration?.ad_account_id) {
        throw new Error('Not connected to Meta')
      }

      let adAccountId = integration.ad_account_id
      if (!adAccountId.startsWith('act_')) adAccountId = `act_${adAccountId}`

      // Default date range: last 30 days
      const end = dateEnd || new Date().toISOString().split('T')[0]
      const start = dateStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Fetch account insights with breakdown
      const fields = 'impressions,reach,clicks,spend,cpc,cpm,ctr,actions,conversions'
      const params = new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since: start, until: end }),
        time_increment: breakdown === 'day' ? '1' : breakdown === 'week' ? '7' : '28',
        access_token: integration.access_token,
      })

      const [summaryRes, dailyRes, campaignsRes] = await Promise.all([
        fetch(`${META_GRAPH_API}/${adAccountId}/insights?${new URLSearchParams({
          fields,
          time_range: JSON.stringify({ since: start, until: end }),
          access_token: integration.access_token,
        })}`),
        fetch(`${META_GRAPH_API}/${adAccountId}/insights?${params}`),
        fetch(`${META_GRAPH_API}/${adAccountId}/campaigns?${new URLSearchParams({
          fields: 'id,name,status,insights.time_range({"since":"' + start + '","until":"' + end + '"}){impressions,reach,clicks,spend}',
          limit: '50',
          access_token: integration.access_token,
        })}`),
      ])

      const [summaryData, dailyData, campaignsData] = await Promise.all([
        summaryRes.json(),
        dailyRes.json(),
        campaignsRes.json(),
      ])

      const insights: MetaFullInsights = {
        summary: summaryData.data?.[0] || {},
        daily: dailyData.data || [],
        campaigns: (campaignsData.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          ...c.insights?.data?.[0],
        })),
      }

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
      const { integration } = get()
      if (!integration?.access_token) {
        throw new Error('Not connected to Meta')
      }

      const posts: any[] = []

      // Fetch Facebook posts
      if ((platform === 'all' || platform === 'facebook') && integration.page_id) {
        const fbParams = new URLSearchParams({
          fields: 'id,message,created_time,permalink_url,full_picture,shares,reactions.summary(total_count),comments.summary(total_count)',
          limit: '50',
          access_token: integration.access_token,
        })

        const fbResponse = await fetch(`${META_GRAPH_API}/${integration.page_id}/posts?${fbParams}`)
        const fbData = await fbResponse.json()

        if (fbData.data) {
          for (const post of fbData.data) {
            posts.push({
              vendor_id: vendorId,
              post_id: post.id,
              platform: 'facebook',
              message: post.message,
              created_time: post.created_time,
              permalink: post.permalink_url,
              image_url: post.full_picture,
              shares: post.shares?.count || 0,
              reactions: post.reactions?.summary?.total_count || 0,
              comments: post.comments?.summary?.total_count || 0,
            })
          }
        }
      }

      // Fetch Instagram posts
      if ((platform === 'all' || platform === 'instagram') && integration.instagram_business_id) {
        const igParams = new URLSearchParams({
          fields: 'id,caption,timestamp,permalink,media_url,media_type,like_count,comments_count',
          limit: '50',
          access_token: integration.access_token,
        })

        const igResponse = await fetch(`${META_GRAPH_API}/${integration.instagram_business_id}/media?${igParams}`)
        const igData = await igResponse.json()

        if (igData.data) {
          for (const post of igData.data) {
            posts.push({
              vendor_id: vendorId,
              post_id: post.id,
              platform: 'instagram',
              message: post.caption,
              created_time: post.timestamp,
              permalink: post.permalink,
              image_url: post.media_url,
              media_type: post.media_type,
              reactions: post.like_count || 0,
              comments: post.comments_count || 0,
            })
          }
        }
      }

      // Upsert posts to database
      if (posts.length > 0) {
        for (const post of posts) {
          await supabase.from('meta_posts').upsert(post, { onConflict: 'post_id' })
        }
      }

      logger.info('[MetaStore] Posts synced:', { count: posts.length })

      // Reload posts from DB
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
    saveCampaignDraft: state.saveCampaignDraft,
    deleteCampaignDraft: state.deleteCampaignDraft,
    loadAdSets: state.loadAdSets,
    createAdSet: state.createAdSet,
    updateAdSet: state.updateAdSet,
    updateAdSetStatus: state.updateAdSetStatus,
    loadAds: state.loadAds,
    createAd: state.createAd,
    updateAd: state.updateAd,
    updateAdStatus: state.updateAdStatus,
    uploadImage: state.uploadImage,
    searchTargeting: state.searchTargeting,
    getReachEstimate: state.getReachEstimate,
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
