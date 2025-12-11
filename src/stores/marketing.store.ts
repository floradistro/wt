/**
 * Marketing Store - Campaign and Email Marketing State
 * Apple-quality state management for the Marketing Hub
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// Track active subscription
let realtimeChannel: RealtimeChannel | null = null

// Types
export interface Campaign {
  id: string
  vendor_id: string
  name: string
  subject: string
  preview_text?: string
  content_json: Record<string, any>
  html_content?: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  audience_type: 'all' | 'segment' | 'custom'
  audience_filter: Record<string, any>
  recipient_count: number
  scheduled_at?: string
  sent_at?: string
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  complained_count: number
  created_at: string
  updated_at: string
  // Linked discount code
  discount_code_id?: string
  discount_code?: string
}

export interface DiscountCode {
  id: string
  vendor_id: string
  coupon_code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  usage_limit?: number
  used_count: number
  expires_at?: string
  is_active: boolean
  created_at: string
}

export interface CustomerSegment {
  id: string
  vendor_id: string
  name: string
  description?: string
  filter_criteria: Record<string, any>
  segment_rules: Record<string, any>
  customer_count: number
  is_system: boolean
  is_dynamic: boolean
  is_active: boolean
  priority: number
  color: string
  icon: string
  ai_description?: string
  targeting_tips: string[]
}

export interface CustomerMetrics {
  id: string
  customer_id: string
  vendor_id: string
  // RFM Scoring
  recency_score: number
  frequency_score: number
  monetary_score: number
  rfm_segment: string
  // Core Metrics
  total_orders: number
  total_spent: number
  average_order_value: number
  days_since_first_order: number | null
  days_since_last_order: number | null
  order_frequency_days: number | null
  // Product Affinities
  category_affinity: Record<string, number>
  strain_affinity: Record<string, number>
  effect_affinity: Record<string, number>
  // Channel Behavior
  preferred_channel: 'pickup' | 'shipping' | 'mixed'
  pickup_order_count: number
  shipping_order_count: number
  // Behavioral Signals
  is_new_customer: boolean
  is_vip_customer: boolean
  is_at_risk: boolean
  is_churned: boolean
  reorder_due: boolean
  // AI Tags
  ai_tags: string[]
  ai_next_best_action?: string
}

// RFM segment distribution for analytics
export interface SegmentDistribution {
  segment: string
  count: number
  color: string
}

// Contact reachability metrics for marketing
export interface ContactReachability {
  total: number
  email_only: number
  phone_only: number
  email_and_phone: number
  no_contact: number
  email_reachable: number  // email_only + email_and_phone
  sms_reachable: number    // phone_only + email_and_phone
  any_reachable: number    // total - no_contact
  unreachable: number      // no_contact
  // Wallet pass channel
  wallet_pass_total: number      // Total customers with loyalty passes
  wallet_pass_active: number     // Customers with pass on device
  wallet_pass_push_enabled: number // Customers who can receive push notifications
}

export type CreatorStep = 'prompt' | 'preview' | 'audience' | 'confirm'

interface MarketingState {
  // Campaigns list
  campaigns: Campaign[]
  isLoading: boolean
  error: string | null

  // Segments
  segments: CustomerSegment[]

  // RFM Analytics
  rfmDistribution: SegmentDistribution[]
  totalCustomersWithMetrics: number
  isLoadingRfm: boolean

  // Contact Reachability
  contactReachability: ContactReachability | null
  isLoadingReachability: boolean

  // Campaign creator state
  creatorStep: CreatorStep
  draftCampaign: Partial<Campaign> | null
  generatedHtml: string | null
  isGenerating: boolean
  selectedSegmentId: string | null

  // Discount code state
  discountCode: DiscountCode | null
  isCreatingDiscount: boolean

  // UI State
  selectedCampaignId: string | null
}

interface MarketingActions {
  // Data loading & realtime
  loadCampaigns: (vendorId: string) => Promise<void>
  loadSegments: (vendorId: string) => Promise<void>
  loadRfmDistribution: (vendorId: string) => Promise<void>
  loadContactReachability: (vendorId: string) => Promise<void>
  subscribeToRealtime: (vendorId: string) => void
  unsubscribeFromRealtime: () => void
  refreshSegmentCount: (segmentId: string) => Promise<number>

  // Campaign CRUD
  createCampaign: (campaign: Partial<Campaign>) => Promise<Campaign | null>
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  saveDraft: (vendorId: string, campaign: Partial<Campaign>) => Promise<Campaign | null>

  // AI Generation
  generateEmail: (prompt: string, vendorId: string) => Promise<void>

  // Creator flow
  setCreatorStep: (step: CreatorStep) => void
  setDraftCampaign: (draft: Partial<Campaign> | null) => void
  setGeneratedHtml: (html: string | null) => void
  setSelectedSegment: (segmentId: string | null) => void
  resetCreator: () => void

  // Discount codes
  createDiscountCode: (vendorId: string, code: string, discountType: 'percentage' | 'fixed', discountValue: number) => Promise<DiscountCode | null>
  clearDiscountCode: () => void

  // Sending
  sendCampaign: (campaignId: string) => Promise<boolean>
  sendTestEmail: (vendorId: string, toEmail: string, subject: string, htmlContent: string) => Promise<boolean>
  getAudienceCount: (segmentId: string | null, vendorId: string) => Promise<number>

  // UI
  selectCampaign: (id: string | null) => void
}

type MarketingStore = MarketingState & MarketingActions

// RFM segment colors for consistent visualization
const RFM_SEGMENT_COLORS: Record<string, string> = {
  'Champions': '#10B981',      // Green - best customers
  'Loyal': '#3B82F6',          // Blue - consistent customers
  'Promising': '#8B5CF6',      // Purple - growing potential
  'New': '#06B6D4',            // Cyan - just started
  'About to Sleep': '#F59E0B', // Amber - need attention
  'At Risk': '#EF4444',        // Red - danger zone
  'Lost Champions': '#DC2626', // Dark red - lost high value
  'Lost': '#6B7280',           // Gray - churned
  'No Orders': '#D1D5DB',      // Light gray - never ordered
}

export const useMarketingStore = create<MarketingStore>((set, get) => ({
  // Initial state
  campaigns: [],
  isLoading: false,
  error: null,
  segments: [],
  rfmDistribution: [],
  totalCustomersWithMetrics: 0,
  isLoadingRfm: false,
  contactReachability: null,
  isLoadingReachability: false,
  creatorStep: 'prompt',
  draftCampaign: null,
  generatedHtml: null,
  isGenerating: false,
  selectedSegmentId: null,
  discountCode: null,
  isCreatingDiscount: false,
  selectedCampaignId: null,

  // Load campaigns
  loadCampaigns: async (vendorId: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ campaigns: data || [], isLoading: false })
    } catch (err) {
      logger.error('[MarketingStore] Load campaigns error:', err)
      set({ error: 'Failed to load campaigns', isLoading: false })
    }
  },

  // Load segments (sorted by priority, then name)
  loadSegments: async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_segments')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('name', { ascending: true })

      if (error) throw error
      set({ segments: data || [] })
    } catch (err) {
      logger.error('[MarketingStore] Load segments error:', err)
    }
  },

  // Load RFM distribution for analytics
  loadRfmDistribution: async (vendorId: string) => {
    set({ isLoadingRfm: true })
    try {
      // Get total count first (no row limit)
      const { count: totalCount, error: countError } = await supabase
        .from('customer_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)

      if (countError) throw countError

      // Get RFM segment counts using a raw aggregation query
      // We need to fetch ALL rows to aggregate, so use pagination
      const allRows: { rfm_segment: string | null }[] = []
      const pageSize = 1000
      let page = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('customer_metrics')
          .select('rfm_segment')
          .eq('vendor_id', vendorId)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allRows.push(...data)
          page++
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }

      // Aggregate counts by segment
      const segmentCounts: Record<string, number> = {}
      for (const row of allRows) {
        const segment = row.rfm_segment || 'Unknown'
        segmentCounts[segment] = (segmentCounts[segment] || 0) + 1
      }

      // Convert to distribution array with colors
      const distribution: SegmentDistribution[] = Object.entries(segmentCounts)
        .map(([segment, count]) => ({
          segment,
          count,
          color: RFM_SEGMENT_COLORS[segment] || '#6B7280',
        }))
        .sort((a, b) => b.count - a.count) // Sort by count descending

      set({
        rfmDistribution: distribution,
        totalCustomersWithMetrics: totalCount || 0,
        isLoadingRfm: false,
      })
    } catch (err) {
      logger.error('[MarketingStore] Load RFM distribution error:', err)
      set({ isLoadingRfm: false })
    }
  },

  // Load contact reachability metrics for marketing
  loadContactReachability: async (vendorId: string) => {
    set({ isLoadingReachability: true })
    try {
      // Paginate through ALL customers (Supabase default limit is 1000)
      const allCustomers: { email: string | null; phone: string | null }[] = []
      const pageSize = 1000
      let page = 0
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('email, phone')
          .eq('vendor_id', vendorId)
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allCustomers.push(...data)
          page++
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
      }

      // Categorize customers by contact method
      let email_only = 0
      let phone_only = 0
      let email_and_phone = 0
      let no_contact = 0

      for (const customer of allCustomers) {
        const hasEmail = customer.email && customer.email.trim().length > 0
        const hasPhone = customer.phone && customer.phone.trim().length > 0

        if (hasEmail && hasPhone) {
          email_and_phone++
        } else if (hasEmail) {
          email_only++
        } else if (hasPhone) {
          phone_only++
        } else {
          no_contact++
        }
      }

      const total = allCustomers.length
      const email_reachable = email_only + email_and_phone
      const sms_reachable = phone_only + email_and_phone
      const any_reachable = total - no_contact

      // Fetch wallet pass stats
      let wallet_pass_total = 0
      let wallet_pass_active = 0
      let wallet_pass_push_enabled = 0

      try {
        const { data: walletStats } = await supabase
          .from('customer_wallet_pass_stats')
          .select('*')
          .eq('vendor_id', vendorId)
          .maybeSingle()

        if (walletStats) {
          wallet_pass_total = walletStats.total_passes || 0
          wallet_pass_active = walletStats.active_passes || 0
          wallet_pass_push_enabled = walletStats.push_enabled || 0
        }
      } catch (walletErr) {
        logger.warn('[MarketingStore] Wallet pass stats not available:', walletErr)
      }

      logger.info(`[MarketingStore] Contact reachability loaded: ${total} customers, ${wallet_pass_total} wallet passes`)

      set({
        contactReachability: {
          total,
          email_only,
          phone_only,
          email_and_phone,
          no_contact,
          email_reachable,
          sms_reachable,
          any_reachable,
          unreachable: no_contact,
          wallet_pass_total,
          wallet_pass_active,
          wallet_pass_push_enabled,
        },
        isLoadingReachability: false,
      })
    } catch (err) {
      logger.error('[MarketingStore] Load contact reachability error:', err)
      set({ isLoadingReachability: false })
    }
  },

  // Refresh segment count using database function
  refreshSegmentCount: async (segmentId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('refresh_segment_count', { p_segment_id: segmentId })

      if (error) throw error

      // Update local segment with new count
      set(state => ({
        segments: state.segments.map(s =>
          s.id === segmentId ? { ...s, customer_count: data } : s
        )
      }))

      return data as number
    } catch (err) {
      logger.error('[MarketingStore] Refresh segment count error:', err)
      return 0
    }
  },

  // Subscribe to realtime campaign updates (live analytics!)
  subscribeToRealtime: (vendorId: string) => {
    // Unsubscribe from existing channel first
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }

    logger.info('[MarketingStore] 🔴 Subscribing to realtime updates for vendor:', vendorId)

    realtimeChannel = supabase
      .channel(`marketing-campaigns-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'marketing_campaigns',
        },
        (payload) => {
          logger.info('[MarketingStore] 🟢 Realtime event received:', payload.eventType, payload)

          // Filter by vendor_id client-side (more reliable than server filter)
          const record = (payload.new || payload.old) as Campaign
          if (record?.vendor_id !== vendorId) {
            logger.info('[MarketingStore] Ignoring event for different vendor')
            return
          }

          if (payload.eventType === 'UPDATE') {
            const updatedCampaign = payload.new as Campaign
            set(state => ({
              campaigns: state.campaigns.map(c =>
                c.id === updatedCampaign.id ? updatedCampaign : c
              )
            }))
          } else if (payload.eventType === 'INSERT') {
            const newCampaign = payload.new as Campaign
            set(state => ({
              campaigns: [newCampaign, ...state.campaigns.filter(c => c.id !== newCampaign.id)]
            }))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            set(state => ({
              campaigns: state.campaigns.filter(c => c.id !== deletedId)
            }))
          }
        }
      )
      .subscribe((status, err) => {
        logger.info('[MarketingStore] 🔵 Realtime subscription status:', status)
        if (err) {
          logger.error('[MarketingStore] ❌ Realtime subscription error:', err)
        }
        if (status === 'SUBSCRIBED') {
          logger.info('[MarketingStore] ✅ Successfully subscribed to realtime!')
        }
      })
  },

  // Unsubscribe from realtime updates
  unsubscribeFromRealtime: () => {
    if (realtimeChannel) {
      logger.info('[MarketingStore] Unsubscribing from realtime')
      supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
  },

  // Create campaign
  createCampaign: async (campaign: Partial<Campaign>) => {
    try {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert(campaign)
        .select()
        .single()

      if (error) throw error

      set(state => ({
        campaigns: [data, ...state.campaigns]
      }))

      return data
    } catch (err) {
      logger.error('[MarketingStore] Create campaign error:', err)
      return null
    }
  },

  // Update campaign
  updateCampaign: async (id: string, updates: Partial<Campaign>) => {
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      set(state => ({
        campaigns: state.campaigns.map(c =>
          c.id === id ? { ...c, ...updates } : c
        )
      }))
    } catch (err) {
      logger.error('[MarketingStore] Update campaign error:', err)
    }
  },

  // Delete campaign
  deleteCampaign: async (id: string) => {
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .delete()
        .eq('id', id)

      if (error) throw error

      set(state => ({
        campaigns: state.campaigns.filter(c => c.id !== id),
        selectedCampaignId: state.selectedCampaignId === id ? null : state.selectedCampaignId
      }))
    } catch (err) {
      logger.error('[MarketingStore] Delete campaign error:', err)
    }
  },

  // Generate email with AI
  generateEmail: async (prompt: string, vendorId: string) => {
    set({ isGenerating: true, error: null })

    try {
      // Call edge function that uses Claude to generate email
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-marketing-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ prompt, vendorId }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to generate email')
      }

      const { subject, previewText, html, contentJson } = await response.json()

      set({
        isGenerating: false,
        generatedHtml: html,
        draftCampaign: {
          subject,
          preview_text: previewText,
          content_json: contentJson,
          html_content: html,
        },
        creatorStep: 'preview',
      })
    } catch (err) {
      logger.error('[MarketingStore] Generate email error:', err)
      set({
        isGenerating: false,
        error: 'Failed to generate email. Please try again.',
      })
    }
  },

  // Creator flow
  setCreatorStep: (step) => set({ creatorStep: step }),
  setDraftCampaign: (draft) => set({ draftCampaign: draft }),
  setGeneratedHtml: (html) => set({ generatedHtml: html }),
  setSelectedSegment: (segmentId) => set({ selectedSegmentId: segmentId }),

  resetCreator: () => set({
    creatorStep: 'prompt',
    draftCampaign: null,
    generatedHtml: null,
    isGenerating: false,
    selectedSegmentId: null,
    discountCode: null,
    isCreatingDiscount: false,
    error: null,
  }),

  // Create discount code (uses existing deals table)
  createDiscountCode: async (vendorId: string, code: string, discountType: 'percentage' | 'fixed', discountValue: number) => {
    set({ isCreatingDiscount: true })
    try {
      // Generate a unique code if not provided
      const couponCode = code.toUpperCase().replace(/\s/g, '') || `SAVE${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      const { data, error } = await supabase
        .from('deals')
        .insert({
          vendor_id: vendorId,
          name: `Campaign Code: ${couponCode}`,
          discount_type: discountType,
          discount_value: discountValue,
          coupon_code: couponCode,
          // Required fields with sensible defaults
          apply_to: 'all',
          location_scope: 'all',
          schedule_type: 'always',
          application_method: 'code',
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      const discountCode: DiscountCode = {
        id: data.id,
        vendor_id: data.vendor_id,
        coupon_code: data.coupon_code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        usage_limit: data.max_uses_per_customer,
        used_count: data.current_uses || 0,
        expires_at: data.end_date,
        is_active: data.is_active,
        created_at: data.created_at,
      }

      set({ discountCode, isCreatingDiscount: false })
      return discountCode
    } catch (err) {
      logger.error('[MarketingStore] Create discount code error:', err)
      set({ isCreatingDiscount: false })
      return null
    }
  },

  clearDiscountCode: () => set({ discountCode: null }),

  // Save campaign as draft
  saveDraft: async (vendorId: string, campaign: Partial<Campaign>) => {
    try {
      const discountCode = get().discountCode

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert({
          vendor_id: vendorId,
          name: campaign.name || campaign.subject || 'Untitled Campaign',
          subject: campaign.subject || '',
          preview_text: campaign.preview_text,
          content_json: campaign.content_json || {},
          html_content: campaign.html_content,
          audience_type: campaign.audience_type || 'all',
          audience_filter: campaign.audience_filter || {},
          recipient_count: campaign.recipient_count || 0,
          status: 'draft',
          // Include discount code if created
          ...(discountCode && {
            discount_code_id: discountCode.id,
            discount_code: discountCode.coupon_code,
          }),
        })
        .select()
        .single()

      if (error) throw error

      set(state => ({
        campaigns: [data, ...state.campaigns]
      }))

      return data
    } catch (err) {
      logger.error('[MarketingStore] Save draft error:', err)
      return null
    }
  },

  // Get audience count for a segment (or all customers if no segment)
  getAudienceCount: async (segmentId: string | null, vendorId: string) => {
    try {
      if (segmentId) {
        // Use the database function to count segment customers
        const { data, error } = await supabase
          .rpc('get_segment_customers', { p_segment_id: segmentId }, { count: 'exact', head: true })

        if (error) {
          // Fallback: try to get count from segment itself
          const segment = get().segments.find(s => s.id === segmentId)
          if (segment?.customer_count) {
            return segment.customer_count
          }
          throw error
        }
        return data?.length || 0
      }

      // No segment selected - get all active customers with email (exact count, no row limit)
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .not('email', 'is', null)

      if (error) throw error
      return count || 0
    } catch (err) {
      logger.error('[MarketingStore] Get audience count error:', err)
      return 0
    }
  },

  // Send campaign
  sendCampaign: async (campaignId: string) => {
    try {
      const campaign = get().campaigns.find(c => c.id === campaignId)
      if (!campaign) return false

      // Call edge function to send
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-marketing-campaign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ campaignId }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to send campaign')
      }

      // Update local state
      set(state => ({
        campaigns: state.campaigns.map(c =>
          c.id === campaignId ? { ...c, status: 'sending' as const } : c
        )
      }))

      return true
    } catch (err) {
      logger.error('[MarketingStore] Send campaign error:', err)
      return false
    }
  },

  // Send test email
  sendTestEmail: async (vendorId: string, toEmail: string, subject: string, htmlContent: string) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-test-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ vendorId, toEmail, subject, htmlContent }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send test email')
      }

      return true
    } catch (err) {
      logger.error('[MarketingStore] Send test email error:', err)
      return false
    }
  },

  // UI
  selectCampaign: (id) => set({ selectedCampaignId: id }),
}))

// Selector hooks for performance
export const useCampaigns = () => useMarketingStore(state => state.campaigns)
export const useIsLoading = () => useMarketingStore(state => state.isLoading)
export const useSegments = () => useMarketingStore(state => state.segments)
export const useRfmDistribution = () => useMarketingStore(state => state.rfmDistribution)
export const useTotalCustomersWithMetrics = () => useMarketingStore(state => state.totalCustomersWithMetrics)
export const useIsLoadingRfm = () => useMarketingStore(state => state.isLoadingRfm)
export const useContactReachability = () => useMarketingStore(state => state.contactReachability)
export const useIsLoadingReachability = () => useMarketingStore(state => state.isLoadingReachability)
export const useCreatorStep = () => useMarketingStore(state => state.creatorStep)
export const useDraftCampaign = () => useMarketingStore(state => state.draftCampaign)
export const useGeneratedHtml = () => useMarketingStore(state => state.generatedHtml)
export const useIsGenerating = () => useMarketingStore(state => state.isGenerating)
export const useSelectedSegmentId = () => useMarketingStore(state => state.selectedSegmentId)
export const useDiscountCode = () => useMarketingStore(state => state.discountCode)
export const useIsCreatingDiscount = () => useMarketingStore(state => state.isCreatingDiscount)
export const useMarketingActions = () => useMarketingStore(
  useShallow(state => ({
    loadCampaigns: state.loadCampaigns,
    loadSegments: state.loadSegments,
    loadRfmDistribution: state.loadRfmDistribution,
    loadContactReachability: state.loadContactReachability,
    refreshSegmentCount: state.refreshSegmentCount,
    subscribeToRealtime: state.subscribeToRealtime,
    unsubscribeFromRealtime: state.unsubscribeFromRealtime,
    createCampaign: state.createCampaign,
    updateCampaign: state.updateCampaign,
    deleteCampaign: state.deleteCampaign,
    saveDraft: state.saveDraft,
    generateEmail: state.generateEmail,
    setCreatorStep: state.setCreatorStep,
    setDraftCampaign: state.setDraftCampaign,
    setGeneratedHtml: state.setGeneratedHtml,
    setSelectedSegment: state.setSelectedSegment,
    resetCreator: state.resetCreator,
    createDiscountCode: state.createDiscountCode,
    clearDiscountCode: state.clearDiscountCode,
    sendCampaign: state.sendCampaign,
    sendTestEmail: state.sendTestEmail,
    getAudienceCount: state.getAudienceCount,
    selectCampaign: state.selectCampaign,
  }))
)
