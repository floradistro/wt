/**
 * Meta Update Campaign Edge Function
 * Updates campaign status (pause/resume) and other settings
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface UpdateCampaignRequest {
  vendorId: string
  metaCampaignId: string
  status?: 'ACTIVE' | 'PAUSED'
  name?: string
  dailyBudget?: number
  lifetimeBudget?: number
}

serve(async (req) => {
  console.log('meta-update-campaign function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const {
      vendorId,
      metaCampaignId,
      status,
      name,
      dailyBudget,
      lifetimeBudget,
    }: UpdateCampaignRequest = await req.json()

    if (!vendorId || !metaCampaignId) {
      return new Response(
        JSON.stringify({ error: 'vendorId and metaCampaignId are required' }),
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

    console.log(`Updating campaign ${metaCampaignId}`)

    // Build update parameters
    const updateParams: Record<string, string> = {
      access_token: accessToken,
    }

    if (status) {
      updateParams.status = status
    }
    if (name) {
      updateParams.name = name
    }
    if (dailyBudget !== undefined) {
      updateParams.daily_budget = String(Math.round(dailyBudget * 100))
    }
    if (lifetimeBudget !== undefined) {
      updateParams.lifetime_budget = String(Math.round(lifetimeBudget * 100))
    }

    // Update campaign via Meta API
    const updateResponse = await fetch(
      `${META_GRAPH_API}/${metaCampaignId}`,
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
      console.error('Campaign update error:', responseData)
      throw new Error(responseData.error?.message || 'Failed to update campaign')
    }

    console.log(`Campaign ${metaCampaignId} updated successfully`)

    // Update local database
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (status) dbUpdates.status = status
    if (name) dbUpdates.name = name
    if (dailyBudget !== undefined) dbUpdates.daily_budget = dailyBudget
    if (lifetimeBudget !== undefined) dbUpdates.lifetime_budget = lifetimeBudget

    await supabase
      .from('meta_campaigns')
      .update(dbUpdates)
      .eq('vendor_id', vendorId)
      .eq('meta_campaign_id', metaCampaignId)

    return new Response(
      JSON.stringify({
        success: true,
        message: status ? `Campaign ${status === 'ACTIVE' ? 'activated' : 'paused'} successfully` : 'Campaign updated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-update-campaign error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update campaign' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
