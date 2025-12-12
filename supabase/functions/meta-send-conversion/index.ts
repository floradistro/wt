/**
 * Meta Send Conversion Edge Function
 * Sends conversion events to Meta Conversions API (CAPI)
 * This enables server-side tracking for purchases, leads, etc.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.168.0/encoding/hex.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface ConversionRequest {
  vendorId: string
  event_name: 'Purchase' | 'Lead' | 'AddToCart' | 'ViewContent' | 'InitiateCheckout' | 'CompleteRegistration'
  order_id?: string
  customer_id?: string
  value?: number
  currency?: string
  content_ids?: string[]
  content_type?: string
  num_items?: number
  event_source_url?: string
  // Optional user data for matching
  user_email?: string
  user_phone?: string
  client_ip_address?: string
  client_user_agent?: string
  fbc?: string // Facebook click ID
  fbp?: string // Facebook browser ID
}

/**
 * Hash data according to Meta's requirements (SHA256, lowercase, trimmed)
 */
async function hashForMeta(value: string | undefined | null): Promise<string | undefined> {
  if (!value) return undefined

  const normalized = value.toLowerCase().trim()
  const data = new TextEncoder().encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return encodeHex(new Uint8Array(hashBuffer))
}

/**
 * Normalize phone number for hashing
 */
function normalizePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  // Add country code if not present (assume US)
  if (digits.length === 10) {
    return '1' + digits
  }
  return digits
}

serve(async (req) => {
  console.log('meta-send-conversion function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const {
      vendorId,
      event_name,
      order_id,
      customer_id,
      value,
      currency = 'USD',
      content_ids,
      content_type = 'product',
      num_items,
      event_source_url,
      user_email,
      user_phone,
      client_ip_address,
      client_user_agent,
      fbc,
      fbp,
    }: ConversionRequest = await req.json()

    if (!vendorId || !event_name) {
      return new Response(
        JSON.stringify({ error: 'vendorId and event_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Meta integration
    const { data: integration, error: intError } = await supabase
      .from('meta_integrations')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .single()

    if (intError || !integration) {
      console.log('No active Meta integration found, skipping conversion')
      return new Response(
        JSON.stringify({ success: false, message: 'No active Meta integration' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!integration.pixel_id) {
      console.log('No Pixel ID configured, skipping conversion')
      return new Response(
        JSON.stringify({ success: false, message: 'No Pixel ID configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = integration.access_token_encrypted
    const pixelId = integration.pixel_id

    // Get customer data for better matching
    let customerEmail = user_email
    let customerPhone = user_phone

    if (customer_id && (!customerEmail || !customerPhone)) {
      const { data: customer } = await supabase
        .from('customers')
        .select('email, phone')
        .eq('id', customer_id)
        .single()

      if (customer) {
        customerEmail = customerEmail || customer.email
        customerPhone = customerPhone || customer.phone
      }
    }

    // Generate unique event ID for deduplication
    const eventId = order_id
      ? `${event_name}_${order_id}`
      : `${event_name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const eventTime = Math.floor(Date.now() / 1000)

    // Build user_data object with hashed PII
    const userData: Record<string, any> = {}

    if (customerEmail) {
      userData.em = [await hashForMeta(customerEmail)]
    }

    if (customerPhone) {
      userData.ph = [await hashForMeta(normalizePhone(customerPhone))]
    }

    if (customer_id) {
      userData.external_id = [await hashForMeta(customer_id)]
    }

    if (client_ip_address) {
      userData.client_ip_address = client_ip_address
    }

    if (client_user_agent) {
      userData.client_user_agent = client_user_agent
    }

    if (fbc) {
      userData.fbc = fbc
    }

    if (fbp) {
      userData.fbp = fbp
    }

    // Build custom_data object
    const customData: Record<string, any> = {
      currency,
    }

    if (value !== undefined) {
      customData.value = value
    }

    if (content_ids && content_ids.length > 0) {
      customData.content_ids = content_ids
      customData.content_type = content_type
    }

    if (num_items !== undefined) {
      customData.num_items = num_items
    }

    if (order_id) {
      customData.order_id = order_id
    }

    // Build the event payload
    const eventPayload = {
      event_name,
      event_time: eventTime,
      event_id: eventId,
      action_source: 'website',
      event_source_url: event_source_url || undefined,
      user_data: userData,
      custom_data: customData,
    }

    console.log(`Sending ${event_name} event to Meta:`, {
      pixelId,
      eventId,
      value,
      hasEmail: !!customerEmail,
      hasPhone: !!customerPhone,
    })

    // Send to Meta Conversions API
    const response = await fetch(
      `${META_GRAPH_API}/${pixelId}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [eventPayload],
          access_token: accessToken,
        }),
      }
    )

    const responseData = await response.json()

    // Log the conversion event
    const conversionRecord = {
      vendor_id: vendorId,
      event_name,
      event_time: new Date(eventTime * 1000).toISOString(),
      event_id: eventId,
      order_id: order_id || null,
      customer_id: customer_id || null,
      event_source_url: event_source_url || null,
      action_source: 'website',
      value: value || null,
      currency,
      content_ids: content_ids || null,
      content_type,
      num_items: num_items || null,
      user_email_hash: customerEmail ? await hashForMeta(customerEmail) : null,
      user_phone_hash: customerPhone ? await hashForMeta(normalizePhone(customerPhone)) : null,
      user_external_id: customer_id ? await hashForMeta(customer_id) : null,
      client_ip_address: client_ip_address || null,
      client_user_agent: client_user_agent || null,
      fbc: fbc || null,
      fbp: fbp || null,
      fbtrace_id: responseData.fbtrace_id || null,
      events_received: responseData.events_received || null,
      messages: responseData.messages || null,
      status: response.ok ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
      error_message: !response.ok ? (responseData.error?.message || 'Unknown error') : null,
    }

    await supabase
      .from('meta_conversion_events')
      .insert(conversionRecord)

    if (!response.ok) {
      console.error('Meta Conversions API error:', responseData)

      // Check for token expiration
      if (responseData.error?.code === 190) {
        await supabase
          .from('meta_integrations')
          .update({ status: 'expired', last_error: 'Access token expired' })
          .eq('id', integration.id)
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: responseData.error?.message || 'Failed to send conversion',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully sent ${event_name} event to Meta:`, responseData)

    return new Response(
      JSON.stringify({
        success: true,
        events_received: responseData.events_received,
        fbtrace_id: responseData.fbtrace_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-send-conversion error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send conversion' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
