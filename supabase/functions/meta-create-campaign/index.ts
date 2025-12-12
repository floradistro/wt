/**
 * Meta Create Campaign Edge Function
 * Creates a new campaign in Meta Ads Manager
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface CreateCampaignRequest {
  vendorId: string
  name: string
  objective: string // OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES
  status?: 'ACTIVE' | 'PAUSED'
  // Support both camelCase and snake_case for flexibility
  dailyBudget?: number // in dollars
  daily_budget?: number // in dollars (snake_case from frontend)
  lifetimeBudget?: number // in dollars
  lifetime_budget?: number // in dollars (snake_case from frontend)
  startTime?: string // ISO date
  start_time?: string // ISO date (snake_case from frontend)
  stopTime?: string // ISO date
  stop_time?: string // ISO date (snake_case from frontend)
  specialAdCategories?: string[] // NONE, CREDIT, EMPLOYMENT, HOUSING, etc.
}

serve(async (req) => {
  console.log('meta-create-campaign function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestBody: CreateCampaignRequest = await req.json()
    const {
      vendorId,
      name,
      objective,
      status = 'PAUSED',
      specialAdCategories = ['NONE'],
    } = requestBody

    // Support both camelCase and snake_case
    const dailyBudget = requestBody.dailyBudget || requestBody.daily_budget
    const lifetimeBudget = requestBody.lifetimeBudget || requestBody.lifetime_budget
    const startTime = requestBody.startTime || requestBody.start_time
    const stopTime = requestBody.stopTime || requestBody.stop_time

    if (!vendorId || !name || !objective) {
      return new Response(
        JSON.stringify({ error: 'vendorId, name, and objective are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate objective
    const validObjectives = [
      'OUTCOME_AWARENESS',
      'OUTCOME_TRAFFIC',
      'OUTCOME_ENGAGEMENT',
      'OUTCOME_LEADS',
      'OUTCOME_SALES',
    ]
    if (!validObjectives.includes(objective)) {
      return new Response(
        JSON.stringify({ error: `Invalid objective. Must be one of: ${validObjectives.join(', ')}` }),
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

    if (!integration.ad_account_id) {
      throw new Error('No ad account connected. Please connect an ad account first.')
    }

    const accessToken = integration.access_token_encrypted
    // Ensure ad account ID has act_ prefix
    let adAccountId = integration.ad_account_id
    if (!adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`
    }

    console.log(`Creating campaign for ad account: ${adAccountId}`)
    console.log(`Token length: ${accessToken?.length}, Token preview: ${accessToken?.substring(0, 20)}...`)

    // Build campaign parameters
    const campaignParams: Record<string, string> = {
      name,
      objective,
      status,
      special_ad_categories: JSON.stringify(specialAdCategories),
      access_token: accessToken,
    }

    // Add budget (Meta expects cents)
    // When using campaign-level budget, this enables Campaign Budget Optimization (CBO)
    if (dailyBudget) {
      campaignParams.daily_budget = String(Math.round(dailyBudget * 100))
    }
    if (lifetimeBudget) {
      campaignParams.lifetime_budget = String(Math.round(lifetimeBudget * 100))
    }

    // If no campaign-level budget, we need to specify ad set budget sharing preference
    // This is required by Meta when using ad set level budgets
    if (!dailyBudget && !lifetimeBudget) {
      campaignParams.is_adset_budget_sharing_enabled = 'true'
    }

    // Add schedule
    if (startTime) {
      campaignParams.start_time = startTime
    }
    if (stopTime) {
      campaignParams.stop_time = stopTime
    }

    // Create campaign via Meta API
    const apiUrl = `${META_GRAPH_API}/${adAccountId}/campaigns`
    console.log(`Making request to: ${apiUrl}`)
    console.log(`Campaign params:`, { name, objective, status, dailyBudget })

    const createResponse = await fetch(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(campaignParams),
      }
    )

    const responseData = await createResponse.json()

    if (!createResponse.ok) {
      console.error('Campaign creation error:', JSON.stringify(responseData, null, 2))
      const metaError = responseData.error
      let errorMessage = 'Failed to create campaign'

      if (metaError) {
        // Build detailed error message
        errorMessage = metaError.message || errorMessage
        if (metaError.error_user_title) {
          errorMessage = `${metaError.error_user_title}: ${metaError.error_user_msg || metaError.message}`
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

    const metaCampaignId = responseData.id
    console.log(`Created campaign with ID: ${metaCampaignId}`)

    // Fetch full campaign details
    const campaignResponse = await fetch(
      `${META_GRAPH_API}/${metaCampaignId}?` + new URLSearchParams({
        fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time',
        access_token: accessToken,
      })
    )

    const campaignData = await campaignResponse.json()

    // Save to database
    const campaignRecord = {
      vendor_id: vendorId,
      meta_campaign_id: metaCampaignId,
      meta_account_id: adAccountId,
      name: campaignData.name || name,
      objective: campaignData.objective || objective,
      status: campaignData.status || status,
      effective_status: campaignData.effective_status || status,
      daily_budget: campaignData.daily_budget ? parseFloat(campaignData.daily_budget) / 100 : dailyBudget || null,
      lifetime_budget: campaignData.lifetime_budget ? parseFloat(campaignData.lifetime_budget) / 100 : lifetimeBudget || null,
      start_time: campaignData.start_time || startTime || null,
      stop_time: campaignData.stop_time || stopTime || null,
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      conversion_value: 0,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: savedCampaign, error: saveError } = await supabase
      .from('meta_campaigns')
      .insert(campaignRecord)
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save campaign to DB:', saveError)
      // Don't fail - campaign was created in Meta
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaign: savedCampaign || campaignRecord,
        metaCampaignId,
        message: 'Campaign created successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-create-campaign error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create campaign' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
