/**
 * Meta Update Ad Set Edge Function
 * Updates ad set status, budget, targeting, and other settings
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface UpdateAdSetRequest {
  vendorId: string
  metaAdSetId: string
  status?: 'ACTIVE' | 'PAUSED' | 'DELETED'
  name?: string
  daily_budget?: number
  lifetime_budget?: number
  start_time?: string
  end_time?: string
  optimization_goal?: string
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

serve(async (req) => {
  console.log('meta-update-adset function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestBody: UpdateAdSetRequest = await req.json()
    const {
      vendorId,
      metaAdSetId,
      status,
      name,
      daily_budget,
      lifetime_budget,
      start_time,
      end_time,
      optimization_goal,
      bid_strategy,
      bid_amount,
      targeting,
    } = requestBody

    if (!vendorId || !metaAdSetId) {
      return new Response(
        JSON.stringify({ error: 'vendorId and metaAdSetId are required' }),
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

    console.log(`Updating ad set ${metaAdSetId}`)

    // Build update parameters
    const updateParams: Record<string, string> = {
      access_token: accessToken,
    }

    if (status) updateParams.status = status
    if (name) updateParams.name = name
    if (daily_budget !== undefined) {
      updateParams.daily_budget = String(Math.round(daily_budget * 100))
    }
    if (lifetime_budget !== undefined) {
      updateParams.lifetime_budget = String(Math.round(lifetime_budget * 100))
    }
    if (start_time) updateParams.start_time = start_time
    if (end_time) updateParams.end_time = end_time
    if (optimization_goal) updateParams.optimization_goal = optimization_goal
    if (bid_strategy) updateParams.bid_strategy = bid_strategy
    if (bid_amount !== undefined) updateParams.bid_amount = String(bid_amount)

    // Update targeting if provided
    if (targeting) {
      updateParams.targeting = JSON.stringify(targeting)
    }

    // Update ad set via Meta API
    const updateResponse = await fetch(
      `${META_GRAPH_API}/${metaAdSetId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(updateParams),
      }
    )

    const responseData = await updateResponse.json()

    if (!updateResponse.ok) {
      console.error('Ad set update error:', responseData)
      const metaError = responseData.error
      throw new Error(metaError?.error_user_msg || metaError?.message || 'Failed to update ad set')
    }

    console.log(`Ad set ${metaAdSetId} updated successfully`)

    // Update local database
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (status) dbUpdates.status = status
    if (name) dbUpdates.name = name
    if (daily_budget !== undefined) dbUpdates.daily_budget = daily_budget
    if (lifetime_budget !== undefined) dbUpdates.lifetime_budget = lifetime_budget
    if (start_time) dbUpdates.start_time = start_time
    if (end_time) dbUpdates.end_time = end_time
    if (optimization_goal) dbUpdates.optimization_goal = optimization_goal
    if (bid_strategy) dbUpdates.bid_strategy = bid_strategy
    if (bid_amount !== undefined) dbUpdates.bid_amount = bid_amount
    if (targeting) dbUpdates.targeting = targeting

    await supabase
      .from('meta_ad_sets')
      .update(dbUpdates)
      .eq('vendor_id', vendorId)
      .eq('meta_ad_set_id', metaAdSetId)

    return new Response(
      JSON.stringify({
        success: true,
        message: status ? `Ad set ${status === 'ACTIVE' ? 'activated' : status === 'PAUSED' ? 'paused' : 'deleted'} successfully` : 'Ad set updated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-update-adset error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update ad set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
