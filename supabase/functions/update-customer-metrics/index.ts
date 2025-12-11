/**
 * Update Customer Metrics - Edge Function
 *
 * Triggered when:
 * 1. New order is completed
 * 2. Order status changes to completed/delivered
 * 3. Manual refresh requested
 *
 * Updates a single customer's metrics in real-time, including:
 * - RFM scoring
 * - Product affinities
 * - Behavioral signals
 * - AI-generated insights (optional)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderPayload {
  type: 'INSERT' | 'UPDATE'
  table: string
  record: {
    id: string
    customer_id: string
    vendor_id: string
    status: string
    total_amount: number
    order_type: string
    created_at: string
  }
  old_record?: {
    status: string
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: OrderPayload | { customer_id: string; vendor_id: string } = await req.json()

    // Determine customer_id and vendor_id
    let customerId: string
    let vendorId: string

    if ('record' in payload) {
      // Webhook trigger from database
      const { record, old_record, type } = payload

      // Only process completed orders
      const completedStatuses = ['completed', 'delivered', 'shipped', 'picked_up']
      const isNowCompleted = completedStatuses.includes(record.status)
      const wasCompleted = old_record && completedStatuses.includes(old_record.status)

      // Skip if not a completion event
      if (type === 'UPDATE' && (wasCompleted || !isNowCompleted)) {
        return new Response(JSON.stringify({ skipped: true, reason: 'Not a completion event' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (type === 'INSERT' && !isNowCompleted) {
        return new Response(JSON.stringify({ skipped: true, reason: 'Order not completed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      customerId = record.customer_id
      vendorId = record.vendor_id
    } else {
      // Manual trigger
      customerId = payload.customer_id
      vendorId = payload.vendor_id
    }

    if (!customerId || !vendorId) {
      throw new Error('Missing customer_id or vendor_id')
    }

    console.log(`Updating metrics for customer ${customerId}`)

    // Fetch customer data
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name, loyalty_points')
      .eq('id', customerId)
      .single()

    if (!customer) {
      throw new Error('Customer not found')
    }

    // Fetch order history
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        id, total_amount, order_type, created_at, status,
        items:order_items(quantity, product_id)
      `)
      .eq('customer_id', customerId)
      .not('status', 'in', '("cancelled","refunded")')
      .order('created_at', { ascending: false })

    // Fetch product data for affinities
    const productIds = [...new Set(
      (orders || []).flatMap(o => o.items?.map((i: any) => i.product_id) || [])
    )]

    const { data: products } = await supabase
      .from('products')
      .select('id, primary_category_id, custom_fields')
      .in('id', productIds)

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')

    // Build lookups
    const productMap = new Map(products?.map(p => [p.id, p]) || [])
    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || [])

    // Calculate metrics
    const orderCount = orders?.length || 0
    const totalSpent = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
    const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0

    const firstOrder = orders?.[orders.length - 1]?.created_at
    const lastOrder = orders?.[0]?.created_at

    const daysSinceFirst = firstOrder
      ? Math.floor((Date.now() - new Date(firstOrder).getTime()) / (1000 * 60 * 60 * 24))
      : null
    const daysSinceLast = lastOrder
      ? Math.floor((Date.now() - new Date(lastOrder).getTime()) / (1000 * 60 * 60 * 24))
      : null

    const orderFrequency = orderCount > 1 && daysSinceFirst
      ? daysSinceFirst / (orderCount - 1)
      : null

    // Channel preference
    const pickupCount = orders?.filter(o => o.order_type === 'pickup').length || 0
    const shippingCount = orders?.filter(o => o.order_type === 'shipping').length || 0
    const preferredChannel = pickupCount > shippingCount ? 'pickup'
      : shippingCount > pickupCount ? 'shipping' : 'mixed'

    // Calculate affinities
    const categoryCount: Record<string, number> = {}
    const strainCount: Record<string, number> = {}
    let totalItems = 0

    for (const order of (orders || [])) {
      for (const item of (order.items || [])) {
        const product = productMap.get(item.product_id)
        if (!product) continue

        totalItems++

        // Category affinity
        const catName = categoryMap.get(product.primary_category_id) || 'Other'
        categoryCount[catName] = (categoryCount[catName] || 0) + 1

        // Strain affinity
        let strain = product.custom_fields?.strain_type
        if (strain) {
          // Normalize: "Indica Hybrid" → "Indica"
          if (strain.includes('Sativa')) strain = 'Sativa'
          else if (strain.includes('Indica')) strain = 'Indica'
          else if (strain.includes('Hybrid')) strain = 'Hybrid'
          strainCount[strain] = (strainCount[strain] || 0) + 1
        }
      }
    }

    // Convert to percentages
    const categoryAffinity: Record<string, number> = {}
    const strainAffinity: Record<string, number> = {}

    if (totalItems > 0) {
      for (const [cat, count] of Object.entries(categoryCount)) {
        categoryAffinity[cat] = Math.round((count / totalItems) * 100) / 100
      }
      for (const [strain, count] of Object.entries(strainCount)) {
        strainAffinity[strain] = Math.round((count / totalItems) * 100) / 100
      }
    }

    // RFM Scores (1-5)
    const recencyScore = daysSinceLast === null ? 1
      : daysSinceLast < 14 ? 5
      : daysSinceLast < 30 ? 4
      : daysSinceLast < 60 ? 3
      : daysSinceLast < 90 ? 2 : 1

    const frequencyScore = orderCount >= 10 ? 5
      : orderCount >= 5 ? 4
      : orderCount >= 3 ? 3
      : orderCount >= 2 ? 2 : 1

    const monetaryScore = totalSpent >= 500 ? 5
      : totalSpent >= 250 ? 4
      : totalSpent >= 100 ? 3
      : totalSpent >= 50 ? 2 : 1

    // RFM Segment
    let rfmSegment: string
    if (orderCount === 0) {
      rfmSegment = 'No Orders'
    } else if (daysSinceLast && daysSinceLast > 90) {
      rfmSegment = totalSpent > 200 ? 'Lost Champions' : 'Lost'
    } else if (daysSinceLast && daysSinceLast > 60) {
      rfmSegment = 'At Risk'
    } else if (daysSinceLast && daysSinceLast > 30) {
      rfmSegment = 'About to Sleep'
    } else if (orderCount >= 5 && totalSpent > 200) {
      rfmSegment = 'Champions'
    } else if (orderCount >= 3) {
      rfmSegment = 'Loyal'
    } else if (orderCount === 1) {
      rfmSegment = 'New'
    } else {
      rfmSegment = 'Promising'
    }

    // Behavioral flags
    const isNewCustomer = orderCount <= 2
    const isAtRisk = daysSinceLast !== null && daysSinceLast >= 45 && daysSinceLast < 90
    const isChurned = daysSinceLast !== null && daysSinceLast >= 90
    const reorderDue = orderFrequency && daysSinceLast
      ? daysSinceLast > orderFrequency * 1.2
      : false

    // Upsert metrics
    const { error: upsertError } = await supabase
      .from('customer_metrics')
      .upsert({
        customer_id: customerId,
        vendor_id: vendorId,
        recency_score: recencyScore,
        frequency_score: frequencyScore,
        monetary_score: monetaryScore,
        rfm_segment: rfmSegment,
        total_orders: orderCount,
        total_spent: totalSpent,
        average_order_value: avgOrderValue,
        days_since_first_order: daysSinceFirst,
        days_since_last_order: daysSinceLast,
        order_frequency_days: orderFrequency,
        category_affinity: categoryAffinity,
        strain_affinity: strainAffinity,
        preferred_channel: preferredChannel,
        pickup_order_count: pickupCount,
        shipping_order_count: shippingCount,
        is_new_customer: isNewCustomer,
        is_at_risk: isAtRisk,
        is_churned: isChurned,
        reorder_due: reorderDue,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_id',
      })

    if (upsertError) {
      throw upsertError
    }

    console.log(`Updated metrics for ${customer.first_name} ${customer.last_name}: ${rfmSegment}`)

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customerId,
        rfm_segment: rfmSegment,
        total_orders: orderCount,
        total_spent: totalSpent,
        category_affinity: categoryAffinity,
        strain_affinity: strainAffinity,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error updating customer metrics:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
