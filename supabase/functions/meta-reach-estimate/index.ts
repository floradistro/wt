/**
 * Meta Reach Estimate Edge Function
 * Gets real-time audience size estimates based on targeting
 * Uses Meta's delivery_estimate endpoint for accurate reach data
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface ReachEstimateRequest {
  vendorId: string
  targeting: {
    geo_locations?: {
      countries?: string[]
      cities?: { key: string }[]
      regions?: { key: string }[]
    }
    age_min?: number
    age_max?: number
    genders?: number[]
    interests?: { id: string; name: string }[]
    behaviors?: { id: string; name: string }[]
    publisher_platforms?: string[]
  }
  optimization_goal?: string
}

serve(async (req) => {
  console.log('meta-reach-estimate invoked')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { vendorId, targeting, optimization_goal = 'LINK_CLICKS' }: ReachEstimateRequest = await req.json()
    console.log('Request:', { vendorId, targeting, optimization_goal })

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: 'vendorId is required' }),
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
      console.error('Integration not found:', intError)
      throw new Error('Meta integration not found')
    }

    const accessToken = integration.access_token_encrypted
    let adAccountId = integration.ad_account_id
    if (adAccountId && !adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`
    }

    console.log('Using ad account:', adAccountId)

    // Build targeting spec for reach estimate
    const targetingSpec: Record<string, any> = {}

    if (targeting?.geo_locations) {
      targetingSpec.geo_locations = targeting.geo_locations
    } else {
      targetingSpec.geo_locations = { countries: ['US'] }
    }

    if (targeting?.age_min) targetingSpec.age_min = targeting.age_min
    if (targeting?.age_max) targetingSpec.age_max = targeting.age_max
    if (targeting?.genders && targeting.genders.length > 0) {
      targetingSpec.genders = targeting.genders
    }

    // Add interests via flexible_spec
    if (targeting?.interests && targeting.interests.length > 0) {
      targetingSpec.flexible_spec = [{ interests: targeting.interests }]
    }

    if (targeting?.publisher_platforms && targeting.publisher_platforms.length > 0) {
      targetingSpec.publisher_platforms = targeting.publisher_platforms
    }

    console.log('Targeting spec:', JSON.stringify(targetingSpec))

    // Try delivery_estimate first (newer, more accurate)
    const deliveryUrl = `${META_GRAPH_API}/${adAccountId}/delivery_estimate?` + new URLSearchParams({
      targeting_spec: JSON.stringify(targetingSpec),
      optimization_goal,
      access_token: accessToken,
    })

    console.log('Calling delivery_estimate API...')
    const deliveryResponse = await fetch(deliveryUrl)
    const deliveryData = await deliveryResponse.json()
    console.log('Delivery estimate response:', JSON.stringify(deliveryData))

    if (deliveryResponse.ok && deliveryData.data && deliveryData.data.length > 0) {
      const estimate = deliveryData.data[0]
      return new Response(
        JSON.stringify({
          success: true,
          estimate: {
            users_lower_bound: estimate.estimate_dau || estimate.estimate_mau_lower_bound || 100000,
            users_upper_bound: estimate.estimate_mau || estimate.estimate_mau_upper_bound || 1000000,
            estimate_dau: estimate.estimate_dau,
            estimate_mau: estimate.estimate_mau,
            estimate_ready: true,
          },
          isFallback: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fallback to reachestimate endpoint
    console.log('Trying reachestimate fallback...')
    const reachUrl = `${META_GRAPH_API}/${adAccountId}/reachestimate?` + new URLSearchParams({
      targeting_spec: JSON.stringify(targetingSpec),
      optimization_goal,
      access_token: accessToken,
    })

    const reachResponse = await fetch(reachUrl)
    const reachData = await reachResponse.json()
    console.log('Reach estimate response:', JSON.stringify(reachData))

    if (reachResponse.ok && (reachData.users_lower_bound || reachData.data?.users_lower_bound)) {
      return new Response(
        JSON.stringify({
          success: true,
          estimate: {
            users_lower_bound: reachData.data?.users_lower_bound || reachData.users_lower_bound || 0,
            users_upper_bound: reachData.data?.users_upper_bound || reachData.users_upper_bound || 0,
            estimate_dau: reachData.data?.estimate_dau || reachData.estimate_dau,
            estimate_mau: reachData.data?.estimate_mau || reachData.estimate_mau,
            estimate_ready: true,
          },
          isFallback: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If both fail, return calculated fallback
    console.log('Both APIs failed, using calculated fallback')
    const fallbackEstimate = calculateFallbackEstimate(targeting)
    return new Response(
      JSON.stringify({
        success: true,
        estimate: fallbackEstimate,
        isFallback: true,
        apiError: deliveryData.error?.message || reachData.error?.message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-reach-estimate error:', error)

    return new Response(
      JSON.stringify({
        success: true,
        estimate: { users_lower_bound: 100000, users_upper_bound: 1000000 },
        isFallback: true,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateFallbackEstimate(targeting: ReachEstimateRequest['targeting']) {
  // Base US audience ~250M
  let estimate = 250000000

  // Age range reduction
  const ageRange = (targeting.age_max || 65) - (targeting.age_min || 18)
  const ageMultiplier = ageRange / 52 // 52 year range (13-65)
  estimate *= ageMultiplier

  // Gender reduction
  if (targeting.genders && targeting.genders.length === 1) {
    estimate *= 0.5
  }

  // Interests narrow the audience
  if (targeting.interests && targeting.interests.length > 0) {
    estimate *= Math.max(0.1, 1 - (targeting.interests.length * 0.15))
  }

  // Platform reduction
  if (targeting.publisher_platforms) {
    if (targeting.publisher_platforms.length === 1) {
      estimate *= 0.6
    }
  }

  const lowerBound = Math.round(estimate * 0.7)
  const upperBound = Math.round(estimate * 1.3)

  return {
    users_lower_bound: lowerBound,
    users_upper_bound: upperBound,
  }
}
