#!/usr/bin/env node
/**
 * Test the optimized routing function with real data
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testRouting() {
  console.log('🧪 Testing Optimized Shipping Order Routing\n')
  console.log('='.repeat(60))

  // Step 1: Find shipping orders with multiple items
  console.log('\n📦 Finding shipping orders with 2+ items...\n')

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      order_type,
      vendor_id,
      created_at,
      order_items (
        id,
        product_id,
        quantity,
        location_id,
        products (name)
      )
    `)
    .eq('order_type', 'shipping')
    .order('created_at', { ascending: false })
    .limit(20)

  if (ordersError) {
    console.error('Error fetching orders:', ordersError)
    return
  }

  // Filter to orders with 2+ items
  const multiItemOrders = orders.filter(o => o.order_items?.length >= 2)
  console.log(`Found ${multiItemOrders.length} shipping orders with 2+ items\n`)

  if (multiItemOrders.length === 0) {
    console.log('No multi-item shipping orders found. Creating a test scenario...')
    return
  }

  // Step 2: Get all locations
  const vendorId = multiItemOrders[0]?.vendor_id
  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select('id, name')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)

  if (locError) {
    console.error('Error fetching locations:', locError)
    return
  }

  console.log(`📍 Active locations: ${locations.map(l => l.name).join(', ')}\n`)

  // Step 3: Test with each order
  for (const order of multiItemOrders.slice(0, 3)) {
    console.log('='.repeat(60))
    console.log(`\n🔍 Testing Order #${order.order_number} (${order.id})`)
    console.log(`   Items: ${order.order_items.length}`)

    for (const item of order.order_items) {
      const currentLoc = item.location_id
        ? locations.find(l => l.id === item.location_id)?.name || 'Unknown'
        : 'Not assigned'
      console.log(`   - ${item.products?.name || 'Unknown product'} (qty: ${item.quantity}) → ${currentLoc}`)
    }

    // Check inventory for each item at each location
    console.log('\n   📊 Inventory availability by location:')

    for (const loc of locations) {
      let canFulfillAll = true
      const itemStatus = []

      for (const item of order.order_items) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('available_quantity')
          .eq('product_id', item.product_id)
          .eq('location_id', loc.id)
          .eq('vendor_id', vendorId)
          .single()

        const available = inv?.available_quantity || 0
        const canFulfill = available >= item.quantity
        if (!canFulfill) canFulfillAll = false
        itemStatus.push(canFulfill ? '✅' : '❌')
      }

      const allGood = canFulfillAll ? '🏆 CAN FULFILL ALL' : ''
      console.log(`      ${loc.name}: ${itemStatus.join(' ')} ${allGood}`)
    }

    // Reset location assignments to test routing
    console.log('\n   🔄 Resetting item locations to test routing...')

    const { error: resetError } = await supabase
      .from('order_items')
      .update({ location_id: null })
      .eq('order_id', order.id)

    if (resetError) {
      console.error('   Error resetting:', resetError)
      continue
    }

    // Call the routing function
    console.log('   📞 Calling route_order_to_locations()...')

    const { data: routingResult, error: routingError } = await supabase
      .rpc('route_order_to_locations', { p_order_id: order.id })

    if (routingError) {
      console.error('   Routing error:', routingError)
      continue
    }

    console.log('\n   ✨ ROUTING RESULT:')
    if (routingResult && routingResult.length > 0) {
      const uniqueLocations = [...new Set(routingResult.map(r => r.result_location_name))]
      console.log(`   📍 Routed to ${uniqueLocations.length} location(s):`)

      for (const result of routingResult) {
        console.log(`      - ${result.result_location_name}: ${result.result_item_count} items (${result.result_fulfillment_type})`)
      }

      if (uniqueLocations.length === 1) {
        console.log('\n   🎉 SUCCESS: Single-location fulfillment achieved!')
      } else {
        console.log('\n   ⚠️  Multi-location split (no single location could fulfill all)')
      }
    } else {
      console.log('   No routing results returned')
    }

    console.log('')
  }

  console.log('='.repeat(60))
  console.log('\n✅ Routing tests complete!\n')
}

testRouting().catch(console.error)
