/**
 * useCampaigns Hook
 * Campaign/Deal management for Settings screen
 * Steve Jobs vision: Make creating campaigns as simple as sending an email
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import {
  Campaign,
  campaignsService,
  DiscountType,
  ApplyTo,
  LocationScope,
  ScheduleType,
  ApplicationMethod,
  RecurringPattern,
} from '@/services/campaigns.service'

export type { Campaign, DiscountType, ApplyTo, LocationScope, ScheduleType, ApplicationMethod, RecurringPattern }

interface CampaignStats {
  total_campaigns: number
  active_campaigns: number
  total_savings: number
  total_uses: number
}

export function useCampaigns() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState<CampaignStats>({
    total_campaigns: 0,
    active_campaigns: 0,
    total_savings: 0,
    total_uses: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCampaigns = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get vendor ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData || !userData.vendor_id) {
        throw new Error('User vendor not found')
      }

      // Fetch campaigns
      const campaignsData = await campaignsService.getCampaigns(userData.vendor_id)
      setCampaigns(campaignsData)

      // Fetch stats
      const statsData = await campaignsService.getCampaignStats(userData.vendor_id)
      setStats(statsData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load campaigns'
      logger.error('Failed to load campaigns', { error: err })
      setError(errorMessage)
      setCampaigns([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!user?.id) return

    logger.debug('[useCampaigns] Setting up real-time subscription')

    // Subscribe to deals changes (table is called "deals" in DB)
    const channel = supabase
      .channel('campaigns-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'deals',
        },
        (payload) => {
          logger.debug('[useCampaigns] Real-time update:', payload)
          // Reload campaigns when any change occurs
          loadCampaigns()
        }
      )
      .subscribe()

    return () => {
      logger.debug('[useCampaigns] Cleaning up real-time subscription')
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadCampaigns is called inside the subscription callback, doesn't need to be in deps
  }, [user?.id])

  async function createCampaign(campaignData: {
    name: string
    discount_type: DiscountType
    discount_value: number
    apply_to: ApplyTo
    apply_to_ids?: string[]
    location_scope: LocationScope
    location_ids?: string[]
    schedule_type: ScheduleType
    start_date?: string | null
    end_date?: string | null
    recurring_pattern?: RecurringPattern | null
    application_method: ApplicationMethod
    coupon_code?: string | null
    badge_text?: string | null
    badge_color?: string | null
    max_uses_per_customer?: number | null
    max_total_uses?: number | null
  }): Promise<{ success: boolean; error?: string; campaign?: Campaign }> {
    try {
      if (!user?.email) throw new Error('Not authenticated')

      // Get vendor ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData || !userData.vendor_id) {
        throw new Error('User vendor not found')
      }

      // Create campaign
      const newCampaign = await campaignsService.createCampaign({
        vendor_id: userData.vendor_id,
        name: campaignData.name,
        discount_type: campaignData.discount_type,
        discount_value: campaignData.discount_value,
        apply_to: campaignData.apply_to,
        apply_to_ids: campaignData.apply_to_ids || [],
        location_scope: campaignData.location_scope,
        location_ids: campaignData.location_ids || [],
        schedule_type: campaignData.schedule_type,
        start_date: campaignData.start_date || null,
        end_date: campaignData.end_date || null,
        recurring_pattern: campaignData.recurring_pattern || null,
        application_method: campaignData.application_method,
        coupon_code: campaignData.coupon_code || null,
        badge_text: campaignData.badge_text || null,
        badge_color: campaignData.badge_color || null,
        max_uses_per_customer: campaignData.max_uses_per_customer || null,
        max_total_uses: campaignData.max_total_uses || null,
        is_active: true,
      })

      await loadCampaigns()
      return { success: true, campaign: newCampaign }
    } catch (err) {
      logger.error('Failed to create campaign', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create campaign',
      }
    }
  }

  async function updateCampaign(
    campaignId: string,
    updates: Partial<Campaign>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await campaignsService.updateCampaign(campaignId, updates)
      await loadCampaigns()
      return { success: true }
    } catch (err) {
      logger.error('Failed to update campaign', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update campaign',
      }
    }
  }

  async function deleteCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await campaignsService.deleteCampaign(campaignId)
      await loadCampaigns()
      return { success: true }
    } catch (err) {
      logger.error('Failed to delete campaign', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete campaign',
      }
    }
  }

  async function toggleCampaignStatus(
    campaignId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await campaignsService.toggleCampaignStatus(campaignId, isActive)
      await loadCampaigns()
      return { success: true }
    } catch (err) {
      logger.error('Failed to toggle campaign status', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle campaign status',
      }
    }
  }

  return {
    campaigns,
    stats,
    isLoading,
    error,
    reload: loadCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    toggleCampaignStatus,
  }
}
