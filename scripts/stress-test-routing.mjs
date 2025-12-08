#!/usr/bin/env node
/**
 * COMPREHENSIVE STRESS TEST for route_order_to_locations()
 * Tests edge cases, reliability, and consistency with real data
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Test statistics
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  singleLocation: 0,
  multiLocation: 0,
  noInventory: 0,
  errors: [],
  consistencyChecks: { passed: 0, failed: 0 }
}

async function getLocations(vendorId) {
  const { data } = await supabase
    .from('locations')
    .select('id, name')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
  return data || []
}

async function getInventoryMap(vendorId, productIds, locations) {
  // Build a map: productId -> { locationId -> available_quantity }
  const map = {}
  for (const pid of productIds) {
    map[pid] = {}
    for (const loc of locations) {
      const { data } = await supabase
        .from('inventory')
        .select('available_quantity')
        .eq('product_id', pid)
        .eq('location_id', loc.id)
        .eq('vendor_id', vendorId)
        .single()
      map[pid][loc.id] = data?.available_quantity || 0
    }
  }
  return map
}

function canLocationFulfillAll(locationId, items, inventoryMap) {
  for (const item of items) {
    const available = inventoryMap[item.product_id]?.[locationId] || 0
    if (available < item.quantity) return false
  }
  return true
}

function findSingleFulfillmentLocations(items, locations, inventoryMap) {
  return locations.filter(loc => canLocationFulfillAll(loc.id, items, inventoryMap))
}

async function resetOrderItemLocations(orderId) {
  await supabase
    .from('order_items')
    .update({ location_id: null })
    .eq('order_id', orderId)
}

async function runRouting(orderId) {
  const { data, error } = await supabase
    .rpc('route_order_to_locations', { p_order_id: orderId })
  return { data, error }
}

async function verifyOrderLocations(orderId) {
  const { data } = await supabase
    .from('order_locations')
    .select('location_id, item_count, total_quantity')
    .eq('order_id', orderId)
  return data || []
}

async function verifyOrderItems(orderId) {
  const { data } = await supabase
    .from('order_items')
    .select('id, product_id, quantity, location_id')
    .eq('order_id', orderId)
  return data || []
}

// ============================================================================
// TEST CASES
// ============================================================================

async function testOrder(order, locations, testName) {
  stats.total++
  const items = order.order_items || []
  const productIds = items.map(i => i.product_id)

  console.log(`\n${'─'.repeat(70)}`)
  console.log(`TEST: ${testName}`)
  console.log(`Order: #${order.order_number} | Items: ${items.length} | Type: ${order.order_type}`)

  // Get inventory map
  const inventoryMap = await getInventoryMap(order.vendor_id, productIds, locations)

  // Determine expected behavior
  const singleFulfillmentLocs = findSingleFulfillmentLocations(items, locations, inventoryMap)
  const canSingleFulfill = singleFulfillmentLocs.length > 0

  console.log(`Expected: ${canSingleFulfill ? `Single location (${singleFulfillmentLocs.map(l => l.name).join(' or ')})` : 'Multi-location split'}`)

  // Reset and route
  await resetOrderItemLocations(order.id)
  const { data: routingResult, error } = await runRouting(order.id)

  if (error) {
    console.log(`❌ ROUTING ERROR: ${error.message}`)
    stats.failed++
    stats.errors.push({ order: order.order_number, test: testName, error: error.message })
    return false
  }

  // Analyze result
  const uniqueLocations = [...new Set((routingResult || []).map(r => r.result_location_id))]
  const routedToSingle = uniqueLocations.length === 1

  console.log(`Result: ${uniqueLocations.length} location(s)`)
  for (const r of routingResult || []) {
    console.log(`   → ${r.result_location_name}: ${r.result_item_count} items`)
  }

  // Verify correctness
  let passed = true
  let reason = ''

  if (canSingleFulfill && !routedToSingle) {
    passed = false
    reason = 'Should have routed to single location but split'
    stats.failed++
  } else if (canSingleFulfill && routedToSingle) {
    // Verify it picked one of the valid locations
    const pickedValidLocation = singleFulfillmentLocs.some(l => l.id === uniqueLocations[0])
    if (!pickedValidLocation) {
      passed = false
      reason = 'Picked wrong single location'
      stats.failed++
    } else {
      stats.passed++
      stats.singleLocation++
    }
  } else if (!canSingleFulfill) {
    // Multi-location is expected - verify all items got assigned
    const orderItems = await verifyOrderItems(order.id)
    const unassigned = orderItems.filter(i => !i.location_id)
    if (unassigned.length > 0) {
      // Check if items are out of stock everywhere
      const outOfStock = unassigned.filter(item => {
        const inv = inventoryMap[item.product_id] || {}
        return Object.values(inv).every(qty => qty < item.quantity)
      })
      if (outOfStock.length === unassigned.length) {
        stats.noInventory++
        stats.passed++
        console.log(`   ⚠️  ${unassigned.length} items out of stock everywhere (expected)`)
      } else {
        passed = false
        reason = `${unassigned.length} items left unassigned (not out of stock)`
        stats.failed++
      }
    } else {
      stats.passed++
      stats.multiLocation++
    }
  }

  if (passed) {
    console.log(`✅ PASSED`)
  } else {
    console.log(`❌ FAILED: ${reason}`)
    stats.errors.push({ order: order.order_number, test: testName, error: reason })
  }

  return passed
}

async function consistencyTest(order, locations, runs = 3) {
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`CONSISTENCY TEST: Order #${order.order_number} (${runs} runs)`)

  const results = []

  for (let i = 0; i < runs; i++) {
    await resetOrderItemLocations(order.id)
    const { data, error } = await runRouting(order.id)

    if (error) {
      console.log(`   Run ${i + 1}: ERROR - ${error.message}`)
      results.push(null)
    } else {
      const locations = (data || []).map(r => r.result_location_id).sort().join(',')
      results.push(locations)
      console.log(`   Run ${i + 1}: ${(data || []).length} location records`)
    }
  }

  // Check all runs produced same result
  const uniqueResults = [...new Set(results.filter(r => r !== null))]
  if (uniqueResults.length === 1) {
    console.log(`✅ CONSISTENT: Same result across all runs`)
    stats.consistencyChecks.passed++
    return true
  } else {
    console.log(`❌ INCONSISTENT: Different results across runs!`)
    stats.consistencyChecks.failed++
    stats.errors.push({ order: order.order_number, test: 'Consistency', error: 'Results varied between runs' })
    return false
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('═'.repeat(70))
  console.log('  ROUTING FUNCTION STRESS TEST')
  console.log('  Testing with REAL DATA from production database')
  console.log('═'.repeat(70))

  // Get all shipping orders
  const { data: allOrders, error: ordersError } = await supabase
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
    .limit(50)

  if (ordersError) {
    console.error('Failed to fetch orders:', ordersError)
    return
  }

  console.log(`\nLoaded ${allOrders.length} shipping orders for testing\n`)

  // Get vendor's locations (assume first order's vendor)
  const vendorId = allOrders[0]?.vendor_id
  const locations = await getLocations(vendorId)
  console.log(`Active locations: ${locations.map(l => l.name).join(', ')}`)

  // =========================================================================
  // EDGE CASE 1: Single item orders
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('EDGE CASE 1: Single Item Orders')
  console.log('═'.repeat(70))

  const singleItemOrders = allOrders.filter(o => o.order_items?.length === 1).slice(0, 5)
  for (const order of singleItemOrders) {
    await testOrder(order, locations, 'Single Item Order')
  }

  // =========================================================================
  // EDGE CASE 2: 2-3 item orders (common case)
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('EDGE CASE 2: Small Orders (2-3 items)')
  console.log('═'.repeat(70))

  const smallOrders = allOrders.filter(o => o.order_items?.length >= 2 && o.order_items?.length <= 3).slice(0, 5)
  for (const order of smallOrders) {
    await testOrder(order, locations, 'Small Order (2-3 items)')
  }

  // =========================================================================
  // EDGE CASE 3: Large orders (5+ items)
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('EDGE CASE 3: Large Orders (5+ items)')
  console.log('═'.repeat(70))

  const largeOrders = allOrders.filter(o => o.order_items?.length >= 5).slice(0, 5)
  for (const order of largeOrders) {
    await testOrder(order, locations, 'Large Order (5+ items)')
  }

  // =========================================================================
  // EDGE CASE 4: Orders with high quantities
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('EDGE CASE 4: High Quantity Items')
  console.log('═'.repeat(70))

  const highQtyOrders = allOrders.filter(o =>
    o.order_items?.some(i => i.quantity >= 3)
  ).slice(0, 5)
  for (const order of highQtyOrders) {
    await testOrder(order, locations, 'High Quantity Order')
  }

  // =========================================================================
  // EDGE CASE 5: All remaining orders (bulk test)
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('BULK TEST: All Other Orders')
  console.log('═'.repeat(70))

  const testedIds = new Set([
    ...singleItemOrders.map(o => o.id),
    ...smallOrders.map(o => o.id),
    ...largeOrders.map(o => o.id),
    ...highQtyOrders.map(o => o.id)
  ])

  const remainingOrders = allOrders.filter(o => !testedIds.has(o.id)).slice(0, 15)
  for (const order of remainingOrders) {
    await testOrder(order, locations, 'Bulk Test')
  }

  // =========================================================================
  // CONSISTENCY TESTS: Run same order multiple times
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('CONSISTENCY TESTS: Repeated Routing')
  console.log('═'.repeat(70))

  const ordersForConsistency = allOrders.slice(0, 5)
  for (const order of ordersForConsistency) {
    await consistencyTest(order, locations, 5)
  }

  // =========================================================================
  // PICKUP ORDER TESTS
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('PICKUP ORDER TESTS')
  console.log('═'.repeat(70))

  const { data: pickupOrders } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      order_type,
      vendor_id,
      pickup_location_id,
      order_items (id, product_id, quantity, location_id, products (name))
    `)
    .eq('order_type', 'pickup')
    .not('pickup_location_id', 'is', null)
    .limit(5)

  for (const order of pickupOrders || []) {
    stats.total++
    console.log(`\n${'─'.repeat(70)}`)
    console.log(`PICKUP: Order #${order.order_number}`)

    await resetOrderItemLocations(order.id)
    const { data, error } = await runRouting(order.id)

    if (error) {
      console.log(`❌ ERROR: ${error.message}`)
      stats.failed++
      stats.errors.push({ order: order.order_number, test: 'Pickup', error: error.message })
    } else {
      console.log(`Result: ${(data || []).length} location records`)
      for (const r of data || []) {
        console.log(`   → ${r.result_location_name}: ${r.result_item_count} items (${r.result_fulfillment_type})`)
      }
      stats.passed++
      console.log(`✅ PASSED`)
    }
  }

  // =========================================================================
  // FINAL REPORT
  // =========================================================================
  console.log('\n' + '═'.repeat(70))
  console.log('  FINAL TEST REPORT')
  console.log('═'.repeat(70))
  console.log(`
  Total Tests:        ${stats.total}
  ✅ Passed:          ${stats.passed}
  ❌ Failed:          ${stats.failed}

  Single-Location:    ${stats.singleLocation}
  Multi-Location:     ${stats.multiLocation}
  Out of Stock:       ${stats.noInventory}

  Consistency Tests:
    Passed:           ${stats.consistencyChecks.passed}
    Failed:           ${stats.consistencyChecks.failed}
  `)

  if (stats.errors.length > 0) {
    console.log('ERRORS:')
    for (const err of stats.errors) {
      console.log(`  - Order #${err.order} (${err.test}): ${err.error}`)
    }
  }

  const passRate = ((stats.passed / stats.total) * 100).toFixed(1)
  console.log(`\n${'═'.repeat(70)}`)
  if (stats.failed === 0) {
    console.log(`  🎉 ALL TESTS PASSED - ${passRate}% Success Rate`)
  } else {
    console.log(`  ⚠️  ${stats.failed} TESTS FAILED - ${passRate}% Success Rate`)
  }
  console.log('═'.repeat(70))
}

main().catch(console.error)
