/**
 * EasyPost Webhook Handler
 *
 * Receives tracking updates from EasyPost and updates shipment_tracking table.
 * Updates order status and triggers Apple Wallet push notifications.
 *
 * Flow:
 * 1. EasyPost sends tracking update webhook
 * 2. Update shipment_tracking table
 * 3. Update order status
 * 4. Trigger order-pass-push to notify wallet devices
 * 5. Customer's Apple Wallet pass automatically refreshes with new status
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map EasyPost status to our order status
function mapStatus(status: string): string {
  const statusLower = status?.toLowerCase() || ''
  if (statusLower === 'delivered') return 'delivered'
  if (statusLower === 'out_for_delivery') return 'out_for_delivery'
  if (statusLower === 'in_transit') return 'in_transit'
  if (statusLower === 'pre_transit') return 'pre_transit'
  if (['return_to_sender', 'failure', 'cancelled', 'error'].includes(statusLower)) return 'alert'
  if (statusLower === 'available_for_pickup') return 'out_for_delivery'
  return 'in_transit'
}

// Map tracking status to order status
function mapToOrderStatus(trackingStatus: string): string | null {
  switch (trackingStatus) {
    case 'delivered':
      return 'delivered'
    case 'out_for_delivery':
      return 'shipped' // Keep as shipped but tracking shows out_for_delivery
    case 'in_transit':
      return 'shipped'
    case 'pre_transit':
      return 'shipped' // Label created, waiting for pickup
    case 'alert':
      return null // Don't change order status for alerts
    default:
      return null
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle GET for webhook verification
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'EasyPost webhook endpoint active' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json()

    // EasyPost sends event objects
    // Event types: tracker.created, tracker.updated
    const { description, result } = body

    console.log('[EasyPost Webhook] Received:', description)

    // Only process tracker events
    if (!description?.startsWith('tracker.')) {
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // result contains the Tracker object
    const tracker = result
    if (!tracker?.tracking_code) {
      console.error('[EasyPost Webhook] No tracking code')
      return new Response(
        JSON.stringify({ error: 'No tracking code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const trackingNumber = tracker.tracking_code
    const status = mapStatus(tracker.status || '')

    // Parse tracking events
    const events = (tracker.tracking_details || []).map((detail: any) => ({
      eventTimestamp: detail.datetime || '',
      eventType: detail.message || detail.status || '',
      eventCity: detail.tracking_location?.city || '',
      eventState: detail.tracking_location?.state || '',
      eventZIPCode: detail.tracking_location?.zip || '',
      eventCountry: detail.tracking_location?.country || 'US',
    }))

    // Get latest event info
    const latestEvent = events[0]
    const lastLocation = latestEvent
      ? [latestEvent.eventCity, latestEvent.eventState].filter(Boolean).join(', ')
      : ''

    console.log(`[EasyPost Webhook] Updating ${trackingNumber}: ${status}`)

    // Update shipment_tracking table
    const { error: trackingError } = await supabase
      .from('shipment_tracking')
      .upsert({
        tracking_number: trackingNumber,
        easypost_tracker_id: tracker.id,
        carrier: tracker.carrier || 'USPS',
        status: status,
        status_category: tracker.status || '',
        status_description: tracker.status_detail || tracker.status || '',
        estimated_delivery: tracker.est_delivery_date || null,
        actual_delivery: status === 'delivered' ? latestEvent?.eventTimestamp : null,
        last_location: lastLocation,
        last_update: latestEvent?.eventTimestamp || new Date().toISOString(),
        events: events,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tracking_number'
      })

    if (trackingError) {
      console.error('[EasyPost Webhook] Failed to update tracking:', trackingError)
    }

    // Find the order by tracking number
    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('tracking_number', trackingNumber)
      .single()

    if (order) {
      const newOrderStatus = mapToOrderStatus(status)
      const statusChanged = newOrderStatus && newOrderStatus !== order.status

      // Update order status if it changed
      if (statusChanged) {
        await supabase
          .from('orders')
          .update({
            status: newOrderStatus,
            ...(newOrderStatus === 'delivered' && { delivered_at: new Date().toISOString() }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        console.log(`[EasyPost Webhook] Order ${order.id} status: ${order.status} → ${newOrderStatus}`)
      }

      // Always trigger wallet pass push for ANY tracking update
      // This ensures customer sees live tracking status in their Apple Wallet
      try {
        const pushUrl = `${supabaseUrl}/functions/v1/order-pass-push`
        const pushResponse = await fetch(pushUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_id: order.id }),
        })

        if (pushResponse.ok) {
          const pushResult = await pushResponse.json()
          console.log(`[EasyPost Webhook] Wallet push triggered:`, pushResult)
        } else {
          console.warn(`[EasyPost Webhook] Wallet push failed:`, pushResponse.status)
        }
      } catch (pushError) {
        // Don't fail the webhook for push errors - tracking update is more important
        console.warn('[EasyPost Webhook] Wallet push error (non-fatal):', pushError)
      }
    } else {
      // Try order_shipments table for multi-location orders
      const { data: shipment } = await supabase
        .from('order_shipments')
        .select('order_id')
        .eq('tracking_number', trackingNumber)
        .single()

      if (shipment) {
        console.log(`[EasyPost Webhook] Found in order_shipments: ${shipment.order_id}`)

        // Trigger wallet push for shipment orders too
        try {
          const pushUrl = `${supabaseUrl}/functions/v1/order-pass-push`
          await fetch(pushUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ order_id: shipment.order_id }),
          })
        } catch {
          // Non-fatal
        }
      }
    }

    // Return 200 quickly (EasyPost requires response within 7 seconds)
    return new Response(
      JSON.stringify({ received: true, tracking_number: trackingNumber, status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[EasyPost Webhook] Error:', error)
    // Return 200 to prevent retries for parse errors
    return new Response(
      JSON.stringify({ received: true, error: 'Parse error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
