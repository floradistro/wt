/**
 * Meta Create Ad Set Edge Function
 * Creates a new ad set within a campaign
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface CreateAdSetRequest {
  vendorId: string
  campaignId: string // Meta campaign ID
  name: string
  status?: 'ACTIVE' | 'PAUSED'
  // Budget (only if campaign doesn't have CBO)
  daily_budget?: number
  lifetime_budget?: number
  // Schedule
  start_time?: string
  end_time?: string
  // Optimization
  optimization_goal?: string // LINK_CLICKS, LANDING_PAGE_VIEWS, IMPRESSIONS, REACH, CONVERSIONS, etc.
  billing_event?: string // IMPRESSIONS, LINK_CLICKS, etc.
  bid_strategy?: string // LOWEST_COST_WITHOUT_CAP, LOWEST_COST_WITH_BID_CAP, COST_CAP
  bid_amount?: number // in cents
  // Targeting
  targeting?: {
    geo_locations?: {
      countries?: string[]
      cities?: { key: string; radius?: number; distance_unit?: string }[]
      regions?: { key: string }[]
    }
    age_min?: number
    age_max?: number
    genders?: number[] // 1 = male, 2 = female
    interests?: { id: string; name: string }[]
    behaviors?: { id: string; name: string }[]
    custom_audiences?: { id: string }[]
    excluded_custom_audiences?: { id: string }[]
    publisher_platforms?: string[] // facebook, instagram, audience_network, messenger
    facebook_positions?: string[] // feed, right_hand_column, instant_article, etc.
    instagram_positions?: string[] // stream, story, explore, reels
  }
}

serve(async (req) => {
  console.log('meta-create-adset function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestBody: CreateAdSetRequest = await req.json()
    const {
      vendorId,
      campaignId,
      name,
      status = 'PAUSED',
      daily_budget,
      lifetime_budget,
      start_time,
      end_time,
      optimization_goal = 'LINK_CLICKS',
      billing_event = 'IMPRESSIONS',
      bid_strategy = 'LOWEST_COST_WITHOUT_CAP',
      bid_amount,
      targeting,
    } = requestBody

    if (!vendorId || !campaignId || !name) {
      return new Response(
        JSON.stringify({ error: 'vendorId, campaignId, and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the Meta integration for this vendor
    const { data: integration, error: intError } = await supabase
      .from('meta_integrations')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .single()

    if (intError || !integration) {
      throw new Error('Meta integration not found or not active')
    }

    const accessToken = integration.access_token_encrypted

    // Ensure ad account ID has act_ prefix
    let adAccountId = integration.ad_account_id
    if (!adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`
    }

    console.log(`Creating ad set for campaign: ${campaignId}, ad account: ${adAccountId}`)

    // Build ad set parameters
    const adSetParams: Record<string, string> = {
      name,
      campaign_id: campaignId,
      status,
      optimization_goal,
      billing_event,
      bid_strategy,
      access_token: accessToken,
    }

    // Add budget (Meta expects cents)
    if (daily_budget) {
      adSetParams.daily_budget = String(Math.round(daily_budget * 100))
    }
    if (lifetime_budget) {
      adSetParams.lifetime_budget = String(Math.round(lifetime_budget * 100))
    }

    // Add bid amount if specified
    if (bid_amount) {
      adSetParams.bid_amount = String(bid_amount)
    }

    // Add schedule
    if (start_time) {
      adSetParams.start_time = start_time
    }
    if (end_time) {
      adSetParams.end_time = end_time
    }

    // Build targeting spec
    const targetingSpec: Record<string, any> = {}

    if (targeting) {
      if (targeting.geo_locations) {
        targetingSpec.geo_locations = targeting.geo_locations
      } else {
        // Default to US if no geo targeting specified
        targetingSpec.geo_locations = { countries: ['US'] }
      }

      if (targeting.age_min) targetingSpec.age_min = targeting.age_min
      if (targeting.age_max) targetingSpec.age_max = targeting.age_max
      if (targeting.genders) targetingSpec.genders = targeting.genders

      // Detailed targeting (interests, behaviors) - wrapped in flexible_spec for OR logic
      if (targeting.interests && targeting.interests.length > 0) {
        targetingSpec.flexible_spec = targetingSpec.flexible_spec || []
        targetingSpec.flexible_spec.push({ interests: targeting.interests })
      }
      if (targeting.behaviors && targeting.behaviors.length > 0) {
        targetingSpec.flexible_spec = targetingSpec.flexible_spec || []
        targetingSpec.flexible_spec.push({ behaviors: targeting.behaviors })
      }

      if (targeting.custom_audiences) targetingSpec.custom_audiences = targeting.custom_audiences
      if (targeting.excluded_custom_audiences) targetingSpec.excluded_custom_audiences = targeting.excluded_custom_audiences
      if (targeting.publisher_platforms) targetingSpec.publisher_platforms = targeting.publisher_platforms
      if (targeting.facebook_positions) targetingSpec.facebook_positions = targeting.facebook_positions
      if (targeting.instagram_positions) targetingSpec.instagram_positions = targeting.instagram_positions
    } else {
      // Default targeting
      targetingSpec.geo_locations = { countries: ['US'] }
    }

    adSetParams.targeting = JSON.stringify(targetingSpec)

    console.log('Ad set params:', { name, campaignId, status, optimization_goal, targeting: targetingSpec })

    // Create ad set via Meta API
    const createResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/adsets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(adSetParams),
      }
    )

    const responseData = await createResponse.json()

    if (!createResponse.ok) {
      console.error('Ad set creation error:', JSON.stringify(responseData, null, 2))
      const metaError = responseData.error
      let errorMessage = 'Failed to create ad set'

      if (metaError) {
        // Build detailed error message
        if (metaError.error_user_title && metaError.error_user_msg) {
          errorMessage = `${metaError.error_user_title}: ${metaError.error_user_msg}`
        } else if (metaError.error_user_msg) {
          errorMessage = metaError.error_user_msg
        } else if (metaError.message) {
          errorMessage = metaError.message
        }

        // Log additional debug info
        console.error('Meta API Error Details:', {
          code: metaError.code,
          type: metaError.type,
          fbtrace_id: metaError.fbtrace_id,
          error_subcode: metaError.error_subcode,
        })
      }

      throw new Error(errorMessage)
    }

    const metaAdSetId = responseData.id
    console.log(`Created ad set with ID: ${metaAdSetId}`)

    // Save to database
    const adSetRecord = {
      vendor_id: vendorId,
      meta_ad_set_id: metaAdSetId,
      meta_campaign_id: campaignId,
      name,
      status,
      effective_status: status,
      optimization_goal,
      billing_event,
      bid_strategy,
      bid_amount: bid_amount || null,
      daily_budget: daily_budget || null,
      lifetime_budget: lifetime_budget || null,
      targeting: targetingSpec,
      start_time: start_time || null,
      end_time: end_time || null,
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    const { data: savedAdSet, error: saveError } = await supabase
      .from('meta_ad_sets')
      .insert(adSetRecord)
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save ad set to DB:', saveError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        adSet: savedAdSet || adSetRecord,
        metaAdSetId,
        message: 'Ad set created successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-create-adset error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create ad set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
