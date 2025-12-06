/**
 * Loyalty & Campaigns Management Store
 * Apple Pattern: Business logic in store (not in components)
 *
 * Consolidated store for loyalty program and campaigns (they're related)
 * Migrated from useLoyalty and useCampaigns hooks
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { campaignsService, Campaign } from '@/services/campaigns.service'

export interface LoyaltyProgram {
  id: string
  vendor_id: string
  name: string
  points_per_dollar: number
  point_value: number
  min_redemption_points: number
  points_expiry_days: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CampaignStats {
  total_campaigns: number
  active_campaigns: number
  total_savings: number
  total_uses: number
}

interface LoyaltyCampaignsState {
  // Loyalty Program
  program: LoyaltyProgram | null
  programLoading: boolean
  programError: string | null

  // Campaigns
  campaigns: Campaign[]
  campaignStats: CampaignStats
  campaignsLoading: boolean
  campaignsError: string | null

  // Actions - Loyalty Program
  loadProgram: (authUserId: string) => Promise<void>
  createProgram: (data: any) => Promise<{ success: boolean; error?: string }>
  updateProgram: (data: any) => Promise<{ success: boolean; error?: string }>
  toggleProgramStatus: (active: boolean) => Promise<{ success: boolean; error?: string }>

  // Actions - Campaigns
  loadCampaigns: (authUserId: string) => Promise<void>
  createCampaign: (data: any) => Promise<{ success: boolean; error?: string }>
  updateCampaign: (id: string, data: any) => Promise<{ success: boolean; error?: string }>
  deleteCampaign: (id: string) => Promise<{ success: boolean; error?: string }>
  toggleCampaignStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>

  reset: () => void
}

const initialState = {
  program: null,
  programLoading: false,
  programError: null,
  campaigns: [],
  campaignStats: {
    total_campaigns: 0,
    active_campaigns: 0,
    total_savings: 0,
    total_uses: 0,
  },
  campaignsLoading: false,
  campaignsError: null,
}

export const useLoyaltyCampaignsStore = create<LoyaltyCampaignsState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadProgram: async (authUserId: string) => {
        set({ programLoading: true, programError: null })

        try {
          // Get vendor ID
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('vendor_id')
            .eq('auth_user_id', authUserId)
            .maybeSingle()

          if (userError || !userData) {
            throw new Error('User record not found')
          }
          if (!userData?.vendor_id) throw new Error('No vendor ID found')

          // Fetch loyalty program (should only be one per vendor)
          const { data, error: programError } = await supabase
            .from('loyalty_programs')
            .select('*')
            .eq('vendor_id', userData.vendor_id)
            .maybeSingle()

          if (programError && programError.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is OK
            throw programError
          }

          set({ program: data || null, programLoading: false })
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load loyalty program'
          logger.error('Failed to load loyalty program', { error: err })
          set({ programError: errorMessage, program: null, programLoading: false })
        }
      },

      createProgram: async (data: any) => {
        try {
          const { program } = get()
          if (program) {
            throw new Error('Loyalty program already exists')
          }

          // Get vendor ID from current user
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')

          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('vendor_id')
            .eq('auth_user_id', user.id)
            .maybeSingle()

          if (userError || !userData) {
            throw new Error('User record not found')
          }

          // Create loyalty program
          const { data: newProgram, error: insertError } = await supabase
            .from('loyalty_programs')
            .insert({
              name: data.name || 'Loyalty Rewards',
              points_per_dollar: data.points_per_dollar,
              point_value: data.point_value,
              min_redemption_points: data.min_redemption_points,
              points_expiry_days: data.points_expiry_days,
              vendor_id: userData.vendor_id,
              is_active: true,
            })
            .select()
            .single()

          if (insertError) throw insertError

          set({ program: newProgram })
          return { success: true }
        } catch (err) {
          logger.error('Failed to create loyalty program', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to create loyalty program',
          }
        }
      },

      updateProgram: async (data: any) => {
        try {
          const { program } = get()
          if (!program?.id) throw new Error('No program to update')

          const { error: updateError } = await supabase
            .from('loyalty_programs')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', program.id)

          if (updateError) throw updateError

          // Reload program
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await get().loadProgram(user.id)
          }

          return { success: true }
        } catch (err) {
          logger.error('Failed to update loyalty program', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update loyalty program',
          }
        }
      },

      toggleProgramStatus: async (active: boolean) => {
        return get().updateProgram({ is_active: active })
      },

      loadCampaigns: async (authUserId: string) => {
        set({ campaignsLoading: true, campaignsError: null })

        try {
          // Get vendor ID
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('vendor_id')
            .eq('auth_user_id', authUserId)
            .maybeSingle()

          if (userError || !userData || !userData.vendor_id) {
            throw new Error('User vendor not found')
          }

          // Fetch campaigns
          const campaignsData = await campaignsService.getCampaigns(userData.vendor_id)

          // Fetch stats
          const statsData = await campaignsService.getCampaignStats(userData.vendor_id)

          set({
            campaigns: campaignsData,
            campaignStats: statsData,
            campaignsLoading: false,
          })
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load campaigns'
          logger.error('Failed to load campaigns', { error: err })
          set({
            campaignsError: errorMessage,
            campaigns: [],
            campaignsLoading: false,
          })
        }
      },

      createCampaign: async (data: any) => {
        try {
          // Get vendor ID from current user
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('Not authenticated')

          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('vendor_id')
            .eq('auth_user_id', user.id)
            .maybeSingle()

          if (userError || !userData || !userData.vendor_id) {
            throw new Error('User vendor not found')
          }

          // Create campaign
          await campaignsService.createCampaign({
            vendor_id: userData.vendor_id,
            name: data.name,
            discount_type: data.discount_type,
            discount_value: data.discount_value,
            apply_to: data.apply_to,
            apply_to_ids: data.apply_to_ids || [],
            location_scope: data.location_scope,
            location_ids: data.location_ids || [],
            schedule_type: data.schedule_type,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            recurring_pattern: data.recurring_pattern || null,
            application_method: data.application_method,
            coupon_code: data.coupon_code || null,
            sales_channel: data.sales_channel || 'both', // 'both', 'in_store', 'online'
            badge_text: data.badge_text || null,
            badge_color: data.badge_color || null,
            max_uses_per_customer: data.max_uses_per_customer || null,
            max_total_uses: data.max_total_uses || null,
            is_active: true,
          })

          // Reload campaigns
          await get().loadCampaigns(user.id)
          return { success: true }
        } catch (err) {
          logger.error('Failed to create campaign', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to create campaign',
          }
        }
      },

      updateCampaign: async (id: string, data: any) => {
        try {
          await campaignsService.updateCampaign(id, data)

          // Reload campaigns
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await get().loadCampaigns(user.id)
          }

          return { success: true }
        } catch (err) {
          logger.error('Failed to update campaign', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update campaign',
          }
        }
      },

      deleteCampaign: async (id: string) => {
        try {
          await campaignsService.deleteCampaign(id)

          // Reload campaigns
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await get().loadCampaigns(user.id)
          }

          return { success: true }
        } catch (err) {
          logger.error('Failed to delete campaign', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to delete campaign',
          }
        }
      },

      toggleCampaignStatus: async (id: string, active: boolean) => {
        try {
          await campaignsService.toggleCampaignStatus(id, active)

          // Reload campaigns
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await get().loadCampaigns(user.id)
          }

          return { success: true }
        } catch (err) {
          logger.error('Failed to toggle campaign status', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to toggle campaign status',
          }
        }
      },

      reset: () => set(initialState),
    }),
    { name: 'LoyaltyCampaignsStore' }
  )
)

// ============================================================================
// FOCUSED SELECTORS
// ============================================================================

export const useLoyaltyProgram = () =>
  useLoyaltyCampaignsStore((state) => state.program)

export const useLoyaltyProgramLoading = () =>
  useLoyaltyCampaignsStore((state) => state.programLoading)

export const useCampaigns = () =>
  useLoyaltyCampaignsStore((state) => state.campaigns)

export const useCampaignStats = () =>
  useLoyaltyCampaignsStore((state) => state.campaignStats)

export const useCampaignsLoading = () =>
  useLoyaltyCampaignsStore((state) => state.campaignsLoading)

export const useLoyaltyActions = () =>
  useLoyaltyCampaignsStore(
    useShallow((state) => ({
      loadProgram: state.loadProgram,
      createProgram: state.createProgram,
      updateProgram: state.updateProgram,
      toggleProgramStatus: state.toggleProgramStatus,
    }))
  )

export const useCampaignActions = () =>
  useLoyaltyCampaignsStore(
    useShallow((state) => ({
      loadCampaigns: state.loadCampaigns,
      createCampaign: state.createCampaign,
      updateCampaign: state.updateCampaign,
      deleteCampaign: state.deleteCampaign,
      toggleCampaignStatus: state.toggleCampaignStatus,
    }))
  )

// ============================================================================
// REALTIME MONITORING
// ============================================================================
let loyaltyRealtimeChannel: any = null
let campaignsRealtimeChannel: any = null

/**
 * Start realtime monitoring for loyalty program and campaigns
 * Components should call this in a useEffect with authUserId as dependency
 */
export function startLoyaltyCampaignsRealtimeMonitoring(authUserId: string) {
  // Clean up existing subscriptions
  stopLoyaltyCampaignsRealtimeMonitoring()

  if (!authUserId) return

  logger.debug('[LoyaltyCampaignsStore] Starting real-time monitoring for user:', authUserId)

  // Subscribe to loyalty_programs changes
  loyaltyRealtimeChannel = supabase
    .channel('loyalty-settings-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'loyalty_programs',
      },
      (payload) => {
        logger.debug('[LoyaltyCampaignsStore] Loyalty program real-time update:', payload)
        useLoyaltyCampaignsStore.getState().loadProgram(authUserId)
      }
    )
    .subscribe()

  // Subscribe to deals (campaigns) changes
  campaignsRealtimeChannel = supabase
    .channel('campaigns-settings-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'deals',
      },
      (payload) => {
        logger.debug('[LoyaltyCampaignsStore] Campaigns real-time update:', payload)
        useLoyaltyCampaignsStore.getState().loadCampaigns(authUserId)
      }
    )
    .subscribe()
}

/**
 * Stop realtime monitoring
 */
export function stopLoyaltyCampaignsRealtimeMonitoring() {
  if (loyaltyRealtimeChannel) {
    logger.debug('[LoyaltyCampaignsStore] Stopping loyalty real-time monitoring')
    supabase.removeChannel(loyaltyRealtimeChannel)
    loyaltyRealtimeChannel = null
  }

  if (campaignsRealtimeChannel) {
    logger.debug('[LoyaltyCampaignsStore] Stopping campaigns real-time monitoring')
    supabase.removeChannel(campaignsRealtimeChannel)
    campaignsRealtimeChannel = null
  }
}
