/**
 * EasyPost Create Label Edge Function
 *
 * Creates shipping labels via EasyPost API
 * - Gets from address (location) and to address (order shipping info)
 * - Creates shipment, gets rates, buys cheapest USPS label
 * - Updates order with tracking number and label URL
 * - Registers tracker for live status updates
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// EasyPost API base URL
const EASYPOST_API_URL = 'https://api.easypost.com/v2'

interface CreateLabelRequest {
  orderId: string
  locationId: string
  // Optional overrides
  serviceLevel?: string // e.g., 'Priority', 'First', 'ParcelSelect'
  weight?: number // oz
  length?: number // inches
  width?: number // inches
  height?: number // inches
}

// Map EasyPost status to our status
function mapStatus(status: string): string {
  const statusLower = status?.toLowerCase() || ''
  if (statusLower === 'delivered') return 'delivered'
  if (statusLower === 'out_for_delivery') return 'out_for_delivery'
  if (statusLower === 'in_transit') return 'in_transit'
  if (statusLower === 'pre_transit') return 'pre_transit'
  if (['return_to_sender', 'failure', 'cancelled', 'error'].includes(statusLower)) return 'alert'
  if (statusLower === 'available_for_pickup') return 'out_for_delivery'
  return 'pre_transit'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const EASYPOST_API_KEY = Deno.env.get('EASYPOST_API_KEY')
    if (!EASYPOST_API_KEY) {
      throw new Error('EASYPOST_API_KEY not configured')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: CreateLabelRequest = await req.json()
    const { orderId, locationId, serviceLevel, weight = 16, length = 10, width = 8, height = 4 } = body

    if (!orderId || !locationId) {
      return new Response(
        JSON.stringify({ error: 'orderId and locationId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[EasyPost] Creating label for order ${orderId} from location ${locationId}`)

    // 1. Get order details (TO address)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        vendor_id,
        shipping_name,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_zip,
        shipping_country,
        shipping_phone,
        customers (
          email,
          phone
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`)
    }

    // 2. Get location details (FROM address)
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select(`
        id,
        name,
        address_line1,
        city,
        state,
        postal_code,
        phone,
        vendors (
          store_name
        )
      `)
      .eq('id', locationId)
      .single()

    if (locationError || !location) {
      throw new Error(`Location not found: ${locationError?.message}`)
    }

    // Extract vendor name
    const vendorData = location.vendors as any
    const vendorName = Array.isArray(vendorData)
      ? vendorData[0]?.store_name
      : vendorData?.store_name || location.name

    // 3. Create FROM address with EasyPost
    console.log('[EasyPost] Creating FROM address...')
    const fromAddressResponse = await fetch(`${EASYPOST_API_URL}/addresses`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(EASYPOST_API_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: {
          company: vendorName,
          street1: location.address_line1,
          city: location.city,
          state: location.state,
          zip: location.postal_code,
          country: 'US',
          phone: location.phone,
        }
      })
    })

    if (!fromAddressResponse.ok) {
      const error = await fromAddressResponse.text()
      throw new Error(`Failed to create FROM address: ${error}`)
    }
    const fromAddress = await fromAddressResponse.json()

    // 4. Create TO address with EasyPost
    console.log('[EasyPost] Creating TO address...')
    const customerData = order.customers as any
    const customerPhone = order.shipping_phone ||
      (Array.isArray(customerData) ? customerData[0]?.phone : customerData?.phone)

    const toAddressResponse = await fetch(`${EASYPOST_API_URL}/addresses`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(EASYPOST_API_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: {
          name: order.shipping_name,
          street1: order.shipping_address_line1,
          street2: order.shipping_address_line2 || undefined,
          city: order.shipping_city,
          state: order.shipping_state,
          zip: order.shipping_zip,
          country: order.shipping_country || 'US',
          phone: customerPhone,
        }
      })
    })

    if (!toAddressResponse.ok) {
      const error = await toAddressResponse.text()
      throw new Error(`Failed to create TO address: ${error}`)
    }
    const toAddress = await toAddressResponse.json()

    // 5. Create parcel
    console.log('[EasyPost] Creating parcel...')
    const parcelResponse = await fetch(`${EASYPOST_API_URL}/parcels`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(EASYPOST_API_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcel: {
          length,
          width,
          height,
          weight,
        }
      })
    })

    if (!parcelResponse.ok) {
      const error = await parcelResponse.text()
      throw new Error(`Failed to create parcel: ${error}`)
    }
    const parcel = await parcelResponse.json()

    // 6. Create shipment
    console.log('[EasyPost] Creating shipment...')
    const shipmentResponse = await fetch(`${EASYPOST_API_URL}/shipments`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(EASYPOST_API_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shipment: {
          from_address: { id: fromAddress.id },
          to_address: { id: toAddress.id },
          parcel: { id: parcel.id },
        }
      })
    })

    if (!shipmentResponse.ok) {
      const error = await shipmentResponse.text()
      throw new Error(`Failed to create shipment: ${error}`)
    }
    const shipment = await shipmentResponse.json()

    // 7. Find the best USPS rate
    const uspsRates = shipment.rates?.filter((r: any) => r.carrier === 'USPS') || []

    if (uspsRates.length === 0) {
      throw new Error('No USPS rates available for this shipment')
    }

    // Sort by price and optionally filter by service level
    let selectedRate = uspsRates.sort((a: any, b: any) => parseFloat(a.rate) - parseFloat(b.rate))[0]

    if (serviceLevel) {
      const matchingRate = uspsRates.find((r: any) =>
        r.service?.toLowerCase().includes(serviceLevel.toLowerCase())
      )
      if (matchingRate) {
        selectedRate = matchingRate
      }
    }

    console.log(`[EasyPost] Selected rate: ${selectedRate.service} - $${selectedRate.rate}`)

    // 8. Buy the label
    console.log('[EasyPost] Purchasing label...')
    const buyResponse = await fetch(`${EASYPOST_API_URL}/shipments/${shipment.id}/buy`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(EASYPOST_API_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rate: { id: selectedRate.id }
      })
    })

    if (!buyResponse.ok) {
      const error = await buyResponse.text()
      throw new Error(`Failed to buy label: ${error}`)
    }
    const purchasedShipment = await buyResponse.json()

    const trackingNumber = purchasedShipment.tracking_code
    const labelUrl = purchasedShipment.postage_label?.label_url
    const trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`

    console.log(`[EasyPost] Label created! Tracking: ${trackingNumber}`)

    // 9. Update order with tracking info
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        shipping_label_url: labelUrl,
        shipping_carrier: 'USPS',
        shipping_service: selectedRate.service,
        shipping_cost: parseFloat(selectedRate.rate),
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('[EasyPost] Failed to update order:', updateError)
      // Don't throw - label was created successfully
    }

    // 10. Also update order_shipments if multi-location
    await supabase
      .from('order_shipments')
      .update({
        tracking_number: trackingNumber,
        shipping_carrier: 'USPS',
        shipped_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .eq('location_id', locationId)

    // 11. Create tracker for live updates
    console.log('[EasyPost] Registering tracker...')
    try {
      const trackerResponse = await fetch(`${EASYPOST_API_URL}/trackers`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(EASYPOST_API_KEY + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tracker: {
            tracking_code: trackingNumber,
            carrier: 'USPS',
          }
        })
      })

      if (trackerResponse.ok) {
        const tracker = await trackerResponse.json()

        // Store in shipment_tracking table
        await supabase
          .from('shipment_tracking')
          .upsert({
            tracking_number: trackingNumber,
            order_id: orderId,
            vendor_id: order.vendor_id,
            easypost_tracker_id: tracker.id,
            carrier: 'USPS',
            status: mapStatus(tracker.status || 'pre_transit'),
            status_description: tracker.status_detail || 'Label created',
            estimated_delivery: tracker.est_delivery_date || null,
            events: tracker.tracking_details || [],
          }, {
            onConflict: 'tracking_number'
          })
      }
    } catch (trackerError) {
      console.warn('[EasyPost] Tracker registration failed (non-fatal):', trackerError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        trackingNumber,
        trackingUrl,
        labelUrl,
        carrier: 'USPS',
        service: selectedRate.service,
        cost: parseFloat(selectedRate.rate),
        shipmentId: purchasedShipment.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[EasyPost] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
