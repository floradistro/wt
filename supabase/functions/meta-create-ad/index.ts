/**
 * Meta Create Ad Edge Function
 * Creates a new ad within an ad set, including creative
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface CreateAdRequest {
  vendorId: string
  adSetId: string // Meta ad set ID
  name: string
  status?: 'ACTIVE' | 'PAUSED'
  // Creative options - either use existing creative or create inline
  creativeId?: string // Use existing creative
  // Or create new creative inline
  creative?: {
    name?: string
    // For link ads (most common)
    link_data?: {
      link: string // URL to promote
      message?: string // Primary text
      name?: string // Headline
      description?: string // Description
      call_to_action?: {
        type: string // LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_TRAVEL, CONTACT_US, etc.
        value?: { link?: string }
      }
      image_hash?: string // Image hash from upload
      image_url?: string // Or direct image URL
      video_id?: string // For video ads
    }
    // For carousel ads
    carousel_data?: {
      link: string
      child_attachments: {
        link: string
        name?: string
        description?: string
        image_hash?: string
        call_to_action?: { type: string }
      }[]
    }
    // Page info (required)
    object_story_spec?: {
      page_id: string
      instagram_actor_id?: string
      link_data?: any
      video_data?: any
    }
  }
  // Tracking
  tracking_specs?: any[]
  conversion_domain?: string
}

serve(async (req) => {
  console.log('meta-create-ad function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestBody: CreateAdRequest = await req.json()
    const {
      vendorId,
      adSetId,
      name,
      status = 'PAUSED',
      creativeId,
      creative,
      tracking_specs,
      conversion_domain,
    } = requestBody

    if (!vendorId || !adSetId || !name) {
      return new Response(
        JSON.stringify({ error: 'vendorId, adSetId, and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!creativeId && !creative) {
      return new Response(
        JSON.stringify({ error: 'Either creativeId or creative object is required' }),
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
    let adAccountId = integration.ad_account_id
    if (!adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`
    }

    console.log(`Creating ad for ad set: ${adSetId}`)

    let finalCreativeId = creativeId

    // If no creativeId provided, create creative first
    if (!finalCreativeId && creative) {
      console.log('Creating ad creative first...')

      const creativeParams: Record<string, string> = {
        access_token: accessToken,
        name: creative.name || `Creative for ${name}`,
      }

      // Build object_story_spec for the creative
      if (creative.object_story_spec) {
        creativeParams.object_story_spec = JSON.stringify(creative.object_story_spec)
      } else if (creative.link_data && integration.page_id) {
        // Auto-build object_story_spec from link_data
        creativeParams.object_story_spec = JSON.stringify({
          page_id: integration.page_id,
          link_data: creative.link_data,
        })
      }

      const creativeResponse = await fetch(
        `${META_GRAPH_API}/${adAccountId}/adcreatives`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(creativeParams),
        }
      )

      const creativeData = await creativeResponse.json()

      if (!creativeResponse.ok) {
        console.error('Creative creation error:', creativeData)
        const metaError = creativeData.error
        throw new Error(metaError?.error_user_msg || metaError?.message || 'Failed to create ad creative')
      }

      finalCreativeId = creativeData.id
      console.log(`Created creative with ID: ${finalCreativeId}`)
    }

    // Now create the ad
    const adParams: Record<string, string> = {
      name,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: finalCreativeId }),
      status,
      access_token: accessToken,
    }

    if (tracking_specs) {
      adParams.tracking_specs = JSON.stringify(tracking_specs)
    }

    if (conversion_domain) {
      adParams.conversion_domain = conversion_domain
    }

    console.log('Creating ad with params:', { name, adSetId, status })

    const createResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/ads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(adParams),
      }
    )

    const responseData = await createResponse.json()

    if (!createResponse.ok) {
      console.error('Ad creation error:', JSON.stringify(responseData, null, 2))
      const metaError = responseData.error
      throw new Error(metaError?.error_user_msg || metaError?.message || 'Failed to create ad')
    }

    const metaAdId = responseData.id
    console.log(`Created ad with ID: ${metaAdId}`)

    // Save to database
    const adRecord = {
      vendor_id: vendorId,
      meta_ad_id: metaAdId,
      meta_ad_set_id: adSetId,
      meta_creative_id: finalCreativeId,
      name,
      status,
      effective_status: status,
      creative_data: creative || null,
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    const { data: savedAd, error: saveError } = await supabase
      .from('meta_ads')
      .insert(adRecord)
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save ad to DB:', saveError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        ad: savedAd || adRecord,
        metaAdId,
        metaCreativeId: finalCreativeId,
        message: 'Ad created successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-create-ad error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create ad' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
