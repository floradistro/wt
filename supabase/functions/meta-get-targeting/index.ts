/**
 * Meta Get Targeting Options Edge Function
 * Searches for interests, behaviors, demographics for ad targeting
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface TargetingSearchRequest {
  vendorId: string
  type: 'interests' | 'behaviors' | 'demographics' | 'locales' | 'education_schools' | 'education_majors' | 'work_employers' | 'work_positions'
  query: string
  limit?: number
}

interface GeoSearchRequest {
  vendorId: string
  type: 'countries' | 'regions' | 'cities' | 'zips'
  query?: string
  country_code?: string // For regions/cities search
}

serve(async (req) => {
  console.log('meta-get-targeting function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const requestBody = await req.json()
    const { vendorId, type, query, limit = 25 } = requestBody

    if (!vendorId || !type) {
      return new Response(
        JSON.stringify({ error: 'vendorId and type are required' }),
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

    let endpoint: string
    const params: Record<string, string> = {
      access_token: accessToken,
      limit: String(limit),
    }

    // Handle different targeting types
    if (['countries', 'regions', 'cities', 'zips'].includes(type)) {
      // Geo location search
      endpoint = `${META_GRAPH_API}/search`
      params.type = 'adgeolocation'
      params.location_types = `["${type === 'countries' ? 'country' : type === 'regions' ? 'region' : type === 'cities' ? 'city' : 'zip'}"]`
      if (query) params.q = query
      if (requestBody.country_code) params.country_code = requestBody.country_code
    } else if (['interests', 'behaviors', 'demographics'].includes(type)) {
      // Interest/behavior search
      endpoint = `${META_GRAPH_API}/search`
      params.type = 'adinterest'
      if (type === 'behaviors') params.type = 'adbehavior'
      if (type === 'demographics') params.type = 'adTargetingCategory'
      if (query) params.q = query
    } else if (['education_schools', 'education_majors', 'work_employers', 'work_positions'].includes(type)) {
      // Education/work targeting
      endpoint = `${META_GRAPH_API}/search`
      if (type === 'education_schools') params.type = 'adeducationschool'
      if (type === 'education_majors') params.type = 'adeducationmajor'
      if (type === 'work_employers') params.type = 'adworkemployer'
      if (type === 'work_positions') params.type = 'adworkposition'
      if (query) params.q = query
    } else if (type === 'locales') {
      // Locale search
      endpoint = `${META_GRAPH_API}/search`
      params.type = 'adlocale'
      if (query) params.q = query
    } else {
      throw new Error(`Invalid targeting type: ${type}`)
    }

    console.log(`Searching ${type} with query: ${query}`)

    const searchResponse = await fetch(
      `${endpoint}?${new URLSearchParams(params)}`
    )

    const responseData = await searchResponse.json()

    if (!searchResponse.ok) {
      console.error('Targeting search error:', responseData)
      const metaError = responseData.error
      throw new Error(metaError?.message || 'Failed to search targeting options')
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData.data || [],
        paging: responseData.paging,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-get-targeting error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to search targeting options' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
