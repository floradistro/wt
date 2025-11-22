/**
 * Campaigns Service (Deals/Promotions)
 *
 * Handles all campaign operations using Supabase directly.
 * Integrates with loyalty system for unified discount management.
 *
 * Steve Jobs principle: Every campaign should be simple to create,
 * understand, and apply. No complexity, just results.
 */

import { supabase } from '@/lib/supabase/client'

export type DiscountType = 'percentage' | 'fixed' | 'bogo'
export type ApplyTo = 'all' | 'categories' | 'products'
export type LocationScope = 'all' | 'specific'
export type ScheduleType = 'always' | 'date_range' | 'recurring'
export type ApplicationMethod = 'auto' | 'manual' | 'code'

export interface RecurringPattern {
  days?: number[] // 0-6 (Sun-Sat)
  start_time?: string // "16:00"
  end_time?: string // "18:00"
}

export interface Campaign {
  id: string
  vendor_id: string
  name: string

  // Discount configuration
  discount_type: DiscountType
  discount_value: number // 20 for 20%, 5 for $5, etc.

  // Targeting
  apply_to: ApplyTo
  apply_to_ids: string[] // category IDs or product IDs

  // Location scope
  location_scope: LocationScope
  location_ids: string[]

  // Scheduling
  schedule_type: ScheduleType
  start_date?: string | null
  end_date?: string | null
  recurring_pattern?: RecurringPattern | null

  // Application method
  application_method: ApplicationMethod
  coupon_code?: string | null

  // Visual
  badge_text?: string | null
  badge_color?: string | null

  // Usage limits
  max_uses_per_customer?: number | null
  max_total_uses?: number | null
  current_uses: number

  // Status
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignUsage {
  id: string
  campaign_id: string
  order_id: string
  customer_id?: string | null
  discount_amount: number
  created_at: string
}

/**
 * Get all campaigns for a vendor
 */
export async function getCampaigns(vendorId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load campaigns: ${error.message}`)
  }

  return data || []
}

/**
 * Get active campaigns only
 */
export async function getActiveCampaigns(vendorId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load active campaigns: ${error.message}`)
  }

  return data || []
}

/**
 * Get campaign by ID
 */
export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load campaign: ${error.message}`)
  }

  return data
}

/**
 * Create a new campaign
 */
export async function createCampaign(
  campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'current_uses'>
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('deals')
    .insert({
      ...campaign,
      current_uses: 0,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create campaign: ${error.message}`)
  }

  return data
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(
  campaignId: string,
  updates: Partial<Campaign>
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('deals')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update campaign: ${error.message}`)
  }

  return data
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  // Delete usage records first
  await supabase.from('deal_usage').delete().eq('deal_id', campaignId)

  // Delete the campaign
  const { error } = await supabase.from('deals').delete().eq('id', campaignId)

  if (error) {
    throw new Error(`Failed to delete campaign: ${error.message}`)
  }
}

/**
 * Toggle campaign active status
 */
export async function toggleCampaignStatus(campaignId: string, isActive: boolean): Promise<Campaign> {
  return updateCampaign(campaignId, { is_active: isActive })
}

/**
 * Check if a campaign is currently active (considering schedule)
 */
export function isCampaignActive(campaign: Campaign): boolean {
  if (!campaign.is_active) return false

  const now = new Date()

  // Check date range
  if (campaign.schedule_type === 'date_range') {
    if (campaign.start_date && now < new Date(campaign.start_date)) return false
    if (campaign.end_date && now > new Date(campaign.end_date)) return false
  }

  // Check recurring schedule
  if (campaign.schedule_type === 'recurring' && campaign.recurring_pattern) {
    const pattern = campaign.recurring_pattern
    const currentDay = now.getDay() // 0-6
    const currentTime = now.toTimeString().slice(0, 5) // "HH:MM"

    // Check day of week
    if (pattern.days && !pattern.days.includes(currentDay)) return false

    // Check time range
    if (pattern.start_time && currentTime < pattern.start_time) return false
    if (pattern.end_time && currentTime > pattern.end_time) return false
  }

  // Check usage limits
  if (campaign.max_total_uses && campaign.current_uses >= campaign.max_total_uses) {
    return false
  }

  return true
}

/**
 * Calculate discount amount for a cart item
 */
export function calculateCampaignDiscount(
  campaign: Campaign,
  itemPrice: number,
  quantity: number
): number {
  if (!isCampaignActive(campaign)) return 0

  let discount = 0

  if (campaign.discount_type === 'percentage') {
    discount = itemPrice * quantity * (campaign.discount_value / 100)
  } else if (campaign.discount_type === 'fixed') {
    discount = campaign.discount_value * quantity
  }

  // Ensure discount doesn't exceed item price
  return Math.min(discount, itemPrice * quantity)
}

/**
 * Get applicable campaigns for POS checkout
 * Filters by location, schedule, and product targeting
 */
export async function getApplicableCampaigns(params: {
  vendorId: string
  locationId?: string
  productIds: string[]
  categoryIds: string[]
}): Promise<Campaign[]> {
  const { vendorId, locationId, productIds, categoryIds } = params

  // Get all active campaigns
  const campaigns = await getActiveCampaigns(vendorId)

  // Filter by location
  const locationFiltered = campaigns.filter((c) => {
    if (c.location_scope === 'all') return true
    if (!locationId) return false
    return c.location_ids.includes(locationId)
  })

  // Filter by schedule and product targeting
  return locationFiltered.filter((campaign) => {
    // Check if campaign is active right now
    if (!isCampaignActive(campaign)) return false

    // Check product/category targeting
    if (campaign.apply_to === 'all') return true

    if (campaign.apply_to === 'categories') {
      return campaign.apply_to_ids.some((id) => categoryIds.includes(id))
    }

    if (campaign.apply_to === 'products') {
      return campaign.apply_to_ids.some((id) => productIds.includes(id))
    }

    return false
  })
}

/**
 * Get manual (staff-applied) campaigns
 */
export async function getManualCampaigns(
  vendorId: string,
  locationId?: string
): Promise<Campaign[]> {
  const campaigns = await getActiveCampaigns(vendorId)

  return campaigns.filter((c) => {
    if (c.application_method !== 'manual') return false
    if (!isCampaignActive(c)) return false

    // Check location
    if (c.location_scope === 'specific' && locationId) {
      return c.location_ids.includes(locationId)
    }

    return true
  })
}

/**
 * Record campaign usage after order completion
 */
export async function recordCampaignUsage(params: {
  campaignId: string
  orderId: string
  customerId?: string
  discountAmount: number
}): Promise<void> {
  const { campaignId, orderId, customerId, discountAmount } = params

  // Insert usage record
  const { error } = await supabase.from('deal_usage').insert({
    deal_id: campaignId,
    order_id: orderId,
    customer_id: customerId || null,
    discount_amount: discountAmount,
  })

  if (error) {
    throw new Error(`Failed to record campaign usage: ${error.message}`)
  }

  // Increment campaign usage counter
  const { error: updateError } = await supabase.rpc('increment', {
    table_name: 'deals',
    row_id: campaignId,
    column_name: 'current_uses',
  })

  if (updateError) {
    console.warn('Failed to increment campaign usage:', updateError.message)
  }
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats(vendorId: string) {
  const campaigns = await getCampaigns(vendorId)

  // Get usage data
  const campaignIds = campaigns.map((c) => c.id)
  const { data: usage } = await supabase
    .from('deal_usage')
    .select('discount_amount')
    .in('deal_id', campaignIds)

  const totalSavings = usage?.reduce((sum, u) => sum + u.discount_amount, 0) || 0
  const totalUses = usage?.length || 0

  return {
    total_campaigns: campaigns.length,
    active_campaigns: campaigns.filter((c) => c.is_active).length,
    total_savings: totalSavings,
    total_uses: totalUses,
  }
}

/**
 * Export default service object
 */
export const campaignsService = {
  getCampaigns,
  getActiveCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaignStatus,
  isCampaignActive,
  calculateCampaignDiscount,
  getApplicableCampaigns,
  getManualCampaigns,
  recordCampaignUsage,
  getCampaignStats,
}
