/**
 * Meta Update Ad Edge Function
 * Updates ad status, name, and creative
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface UpdateAdRequest {
  vendorId: string
  metaAdId: string
  status?: 'ACTIVE' | 'PAUSED' | 'DELETED'
  name?: string
  creativeId?: string // Update to use different creative
}

serve(async (req) => {
  console.log('meta-update-ad function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { vendorId, metaAdId, status, name, creativeId }: UpdateAdRequest = await req.json()

    if (!vendorId || !metaAdId) {
      return new Response(
        JSON.stringify({ error: 'vendorId and metaAdId are required' }),
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

    console.log(`Updating ad ${metaAdId}`)

    // Build update parameters
    const updateParams: Record<string, string> = {
      access_token: accessToken,
    }

    if (status) updateParams.status = status
    if (name) updateParams.name = name
    if (creativeId) {
      updateParams.creative = JSON.stringify({ creative_id: creativeId })
    }

    // Update ad via Meta API
    const updateResponse = await fetch(
      `${META_GRAPH_API}/${metaAdId}`,
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
      console.error('Ad update error:', responseData)
      const metaError = responseData.error
      throw new Error(metaError?.error_user_msg || metaError?.message || 'Failed to update ad')
    }

    console.log(`Ad ${metaAdId} updated successfully`)

    // Update local database
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (status) dbUpdates.status = status
    if (name) dbUpdates.name = name
    if (creativeId) dbUpdates.meta_creative_id = creativeId

    await supabase
      .from('meta_ads')
      .update(dbUpdates)
      .eq('vendor_id', vendorId)
      .eq('meta_ad_id', metaAdId)

    return new Response(
      JSON.stringify({
        success: true,
        message: status ? `Ad ${status === 'ACTIVE' ? 'activated' : status === 'PAUSED' ? 'paused' : 'deleted'} successfully` : 'Ad updated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-update-ad error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update ad' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
