/**
 * Meta Connect Edge Function
 * Validates access token and creates/updates Meta integration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface ConnectRequest {
  vendorId: string
  accessToken: string
  adAccountId?: string
  pixelId?: string
}

interface MetaUser {
  id: string
  name: string
}

interface MetaAdAccount {
  id: string
  account_id: string
  name: string
  account_status: number
  currency: string
  business?: {
    id: string
    name: string
  }
}

interface MetaPage {
  id: string
  name: string
  instagram_business_account?: {
    id: string
  }
}

serve(async (req) => {
  console.log('meta-connect function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the Meta App credentials from environment
    const metaAppId = Deno.env.get('META_APP_ID')
    const metaAppSecret = Deno.env.get('META_APP_SECRET')

    if (!metaAppId || !metaAppSecret) {
      throw new Error('META_APP_ID and META_APP_SECRET environment variables are required')
    }

    const { vendorId, accessToken, adAccountId, pixelId }: ConnectRequest = await req.json()

    if (!vendorId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'vendorId and accessToken are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Connecting Meta for vendor: ${vendorId}`)

    // Step 1: Validate the access token and get user info
    const meResponse = await fetch(
      `${META_GRAPH_API}/me?fields=id,name&access_token=${accessToken}`
    )

    if (!meResponse.ok) {
      const error = await meResponse.json()
      console.error('Meta /me error:', error)
      throw new Error(error.error?.message || 'Invalid access token')
    }

    const meData: MetaUser = await meResponse.json()
    console.log('Meta user:', meData.name)

    // Step 2: Get ad accounts the user has access to
    let selectedAdAccountId = adAccountId
    let businessId: string | null = null
    let businessName: string | null = null

    if (!selectedAdAccountId) {
      const adAccountsResponse = await fetch(
        `${META_GRAPH_API}/me/adaccounts?fields=id,account_id,name,account_status,currency,business{id,name}&access_token=${accessToken}`
      )

      if (adAccountsResponse.ok) {
        const adAccountsData = await adAccountsResponse.json()
        const adAccounts: MetaAdAccount[] = adAccountsData.data || []

        console.log(`Found ${adAccounts.length} ad accounts`)

        // Select the first active ad account
        const activeAccount = adAccounts.find(acc => acc.account_status === 1)
        if (activeAccount) {
          selectedAdAccountId = `act_${activeAccount.account_id}`
          if (activeAccount.business) {
            businessId = activeAccount.business.id
            businessName = activeAccount.business.name
          }
          console.log(`Selected ad account: ${selectedAdAccountId}`)
        }
      }
    } else {
      // If ad account was provided, format it correctly
      if (!selectedAdAccountId.startsWith('act_')) {
        selectedAdAccountId = `act_${selectedAdAccountId}`
      }
    }

    // Step 3: Get Facebook Pages and linked Instagram accounts
    let pageId: string | null = null
    let instagramBusinessId: string | null = null

    const pagesResponse = await fetch(
      `${META_GRAPH_API}/me/accounts?fields=id,name,instagram_business_account{id}&access_token=${accessToken}`
    )

    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json()
      const pages: MetaPage[] = pagesData.data || []

      console.log(`Found ${pages.length} pages`)

      if (pages.length > 0) {
        pageId = pages[0].id
        if (pages[0].instagram_business_account) {
          instagramBusinessId = pages[0].instagram_business_account.id
        }
      }
    }

    // Step 4: Exchange for a long-lived token (if short-lived)
    let longLivedToken = accessToken
    let tokenExpiresAt: string | null = null

    try {
      const tokenResponse = await fetch(
        `${META_GRAPH_API}/oauth/access_token?` + new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: metaAppId,
          client_secret: metaAppSecret,
          fb_exchange_token: accessToken,
        })
      )

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()
        if (tokenData.access_token) {
          longLivedToken = tokenData.access_token
          // Long-lived tokens are valid for about 60 days
          const expiresIn = tokenData.expires_in || 5184000 // default 60 days
          tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
          console.log('Exchanged for long-lived token')
        }
      }
    } catch (tokenError) {
      console.warn('Could not exchange for long-lived token:', tokenError)
    }

    // Step 5: Store/update the integration
    const integrationData = {
      vendor_id: vendorId,
      app_id: metaAppId,
      access_token_encrypted: longLivedToken, // In production, encrypt this!
      token_expires_at: tokenExpiresAt,
      ad_account_id: selectedAdAccountId,
      pixel_id: pixelId || null,
      page_id: pageId,
      instagram_business_id: instagramBusinessId,
      business_id: businessId,
      business_name: businessName,
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    }

    // Upsert the integration
    const { data: integration, error: upsertError } = await supabase
      .from('meta_integrations')
      .upsert(integrationData, {
        onConflict: 'vendor_id',
      })
      .select()
      .single()

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      throw new Error('Failed to save integration')
    }

    console.log('Meta integration saved successfully')

    // Return integration info (without the token for security)
    const safeIntegration = {
      ...integration,
      access_token_encrypted: undefined,
    }

    return new Response(
      JSON.stringify(safeIntegration),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-connect error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to connect to Meta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
