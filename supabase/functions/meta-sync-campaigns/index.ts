/**
 * Meta Sync Campaigns Edge Function
 * Fetches campaigns, ad sets, and ads from Meta Marketing API and syncs to database
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface SyncRequest {
  vendorId: string
  datePreset?: string // today, yesterday, last_7d, last_30d, etc.
}

interface MetaCampaign {
  id: string
  name: string
  objective: string
  status: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  budget_remaining?: string
  start_time?: string
  stop_time?: string
  insights?: {
    data: Array<{
      impressions: string
      reach: string
      clicks: string
      spend: string
      actions?: Array<{ action_type: string; value: string }>
      action_values?: Array<{ action_type: string; value: string }>
    }>
  }
}

interface MetaAdSet {
  id: string
  name: string
  campaign_id: string
  status: string
  effective_status: string
  targeting?: Record<string, any>
  optimization_goal?: string
  billing_event?: string
  bid_strategy?: string
  bid_amount?: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  end_time?: string
}

interface MetaAd {
  id: string
  name: string
  adset_id: string
  status: string
  effective_status: string
  creative?: {
    id: string
  }
  preview_shareable_link?: string
}

serve(async (req) => {
  console.log('meta-sync-campaigns function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { vendorId, datePreset = 'last_30d' }: SyncRequest = await req.json()

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
      throw new Error('Meta integration not found or not active')
    }

    if (!integration.ad_account_id) {
      throw new Error('No ad account connected')
    }

    const accessToken = integration.access_token_encrypted
    const adAccountId = integration.ad_account_id

    console.log(`Syncing campaigns for ad account: ${adAccountId}`)

    // Fetch campaigns with insights
    const campaignsResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/campaigns?` + new URLSearchParams({
        fields: [
          'id',
          'name',
          'objective',
          'status',
          'effective_status',
          'daily_budget',
          'lifetime_budget',
          'budget_remaining',
          'start_time',
          'stop_time',
          `insights.date_preset(${datePreset}){impressions,reach,clicks,spend,actions,action_values}`,
        ].join(','),
        limit: '100',
        access_token: accessToken,
      })
    )

    if (!campaignsResponse.ok) {
      const error = await campaignsResponse.json()
      console.error('Campaigns fetch error:', error)

      // Check if token expired
      if (error.error?.code === 190) {
        await supabase
          .from('meta_integrations')
          .update({ status: 'expired', last_error: 'Access token expired' })
          .eq('id', integration.id)
        throw new Error('Access token expired. Please reconnect.')
      }

      throw new Error(error.error?.message || 'Failed to fetch campaigns')
    }

    const campaignsData = await campaignsResponse.json()
    const campaigns: MetaCampaign[] = campaignsData.data || []

    console.log(`Fetched ${campaigns.length} campaigns`)

    // Process and upsert campaigns
    const campaignRecords = campaigns.map(campaign => {
      const insights = campaign.insights?.data?.[0]

      // Extract conversion metrics from actions
      let conversions = 0
      let conversionValue = 0

      if (insights?.actions) {
        const purchaseAction = insights.actions.find(
          a => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
        )
        if (purchaseAction) {
          conversions = parseInt(purchaseAction.value) || 0
        }
      }

      if (insights?.action_values) {
        const purchaseValue = insights.action_values.find(
          a => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
        )
        if (purchaseValue) {
          conversionValue = parseFloat(purchaseValue.value) || 0
        }
      }

      return {
        vendor_id: vendorId,
        meta_campaign_id: campaign.id,
        meta_account_id: adAccountId,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        effective_status: campaign.effective_status,
        daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
        lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
        budget_remaining: campaign.budget_remaining ? parseFloat(campaign.budget_remaining) / 100 : null,
        start_time: campaign.start_time || null,
        stop_time: campaign.stop_time || null,
        impressions: parseInt(insights?.impressions || '0'),
        reach: parseInt(insights?.reach || '0'),
        clicks: parseInt(insights?.clicks || '0'),
        spend: parseFloat(insights?.spend || '0'),
        conversions,
        conversion_value: conversionValue,
        raw_insights: insights || null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })

    if (campaignRecords.length > 0) {
      const { error: upsertError } = await supabase
        .from('meta_campaigns')
        .upsert(campaignRecords, {
          onConflict: 'vendor_id,meta_campaign_id',
        })

      if (upsertError) {
        console.error('Campaign upsert error:', upsertError)
        throw new Error('Failed to save campaigns')
      }
    }

    // Fetch and sync ad sets
    const adSetsResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/adsets?` + new URLSearchParams({
        fields: [
          'id',
          'name',
          'campaign_id',
          'status',
          'effective_status',
          'targeting',
          'optimization_goal',
          'billing_event',
          'bid_strategy',
          'bid_amount',
          'daily_budget',
          'lifetime_budget',
          'start_time',
          'end_time',
        ].join(','),
        limit: '200',
        access_token: accessToken,
      })
    )

    if (adSetsResponse.ok) {
      const adSetsData = await adSetsResponse.json()
      const adSets: MetaAdSet[] = adSetsData.data || []

      console.log(`Fetched ${adSets.length} ad sets`)

      const adSetRecords = adSets.map(adSet => ({
        vendor_id: vendorId,
        meta_ad_set_id: adSet.id,
        meta_campaign_id: adSet.campaign_id,
        name: adSet.name,
        status: adSet.status,
        effective_status: adSet.effective_status,
        targeting: adSet.targeting || null,
        optimization_goal: adSet.optimization_goal || null,
        billing_event: adSet.billing_event || null,
        bid_strategy: adSet.bid_strategy || null,
        bid_amount: adSet.bid_amount ? parseFloat(adSet.bid_amount) / 100 : null,
        daily_budget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : null,
        lifetime_budget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : null,
        start_time: adSet.start_time || null,
        end_time: adSet.end_time || null,
        last_synced_at: new Date().toISOString(),
      }))

      if (adSetRecords.length > 0) {
        await supabase
          .from('meta_ad_sets')
          .upsert(adSetRecords, {
            onConflict: 'vendor_id,meta_ad_set_id',
          })
      }
    }

    // Fetch and sync ads
    const adsResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/ads?` + new URLSearchParams({
        fields: [
          'id',
          'name',
          'adset_id',
          'status',
          'effective_status',
          'creative{id}',
          'preview_shareable_link',
        ].join(','),
        limit: '200',
        access_token: accessToken,
      })
    )

    if (adsResponse.ok) {
      const adsData = await adsResponse.json()
      const ads: MetaAd[] = adsData.data || []

      console.log(`Fetched ${ads.length} ads`)

      const adRecords = ads.map(ad => ({
        vendor_id: vendorId,
        meta_ad_id: ad.id,
        meta_ad_set_id: ad.adset_id,
        name: ad.name,
        status: ad.status,
        effective_status: ad.effective_status,
        creative_id: ad.creative?.id || null,
        preview_url: ad.preview_shareable_link || null,
        last_synced_at: new Date().toISOString(),
      }))

      if (adRecords.length > 0) {
        await supabase
          .from('meta_ads')
          .upsert(adRecords, {
            onConflict: 'vendor_id,meta_ad_id',
          })
      }
    }

    // Update integration last sync time
    await supabase
      .from('meta_integrations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', integration.id)

    return new Response(
      JSON.stringify({
        success: true,
        campaigns: campaignRecords.length,
        message: `Synced ${campaignRecords.length} campaigns`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-sync-campaigns error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to sync campaigns' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
