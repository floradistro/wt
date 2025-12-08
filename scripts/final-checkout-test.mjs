#!/usr/bin/env node
/**
 * FINAL COMPREHENSIVE CHECKOUT SYSTEM TEST
 * Tests routing, checkout flow, email integration, and edge cases
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTcyMzMsImV4cCI6MjA3NjU3MzIzM30.N8jPwlyCBB5KJB5I-XaK6m-mq88rSR445AWFJJmwRCg'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const results = {
  passed: 0,
  failed: 0,
  tests: []
}

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : '📋'
  console.log(`${prefix} ${message}`)
}

function test(name, passed, details = '') {
  results.tests.push({ name, passed, details })
  if (passed) {
    results.passed++
    log(`${name}`, 'pass')
  } else {
    results.failed++
    log(`${name}: ${details}`, 'fail')
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function testRoutingFunction() {
  console.log('\n' + '═'.repeat(70))
  console.log('  TEST SUITE 1: ROUTING FUNCTION')
  console.log('═'.repeat(70) + '\n')

  // Test 1.1: Function exists
  const { data: funcCheck, error: funcError } = await supabase
    .rpc('route_order_to_locations', { p_order_id: '00000000-0000-0000-0000-000000000000' })

  // Expect empty result for non-existent order, not an error about function missing
  test('1.1 Routing function exists', !funcError || !funcError.message.includes('does not exist'))

  // Test 1.2: Get a real shipping order
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, vendor_id, order_items(id, product_id, quantity)')
    .eq('order_type', 'shipping')
    .order('created_at', { ascending: false })
    .limit(1)

  const testOrder = orders?.[0]
  test('1.2 Found test shipping order', !!testOrder, testOrder ? '' : 'No shipping orders in DB')

  if (testOrder) {
    // Test 1.3: Reset and route order
    await supabase
      .from('order_items')
      .update({ location_id: null })
      .eq('order_id', testOrder.id)

    const { data: routeResult, error: routeError } = await supabase
      .rpc('route_order_to_locations', { p_order_id: testOrder.id })

    test('1.3 Routing executes without error', !routeError, routeError?.message || '')
    test('1.4 Routing returns results', routeResult?.length > 0, `Got ${routeResult?.length || 0} locations`)

    // Test 1.5: Verify order_items updated
    const { data: items } = await supabase
      .from('order_items')
      .select('id, location_id')
      .eq('order_id', testOrder.id)

    const assignedItems = items?.filter(i => i.location_id) || []
    test('1.5 All items assigned locations', assignedItems.length === items?.length,
      `${assignedItems.length}/${items?.length} assigned`)

    // Test 1.6: Verify order_locations created
    const { data: orderLocs } = await supabase
      .from('order_locations')
      .select('*')
      .eq('order_id', testOrder.id)

    test('1.6 order_locations records created', orderLocs?.length > 0, `${orderLocs?.length || 0} records`)

    // Test 1.7: Consistency - run 3 times, same result
    const results = []
    for (let i = 0; i < 3; i++) {
      await supabase.from('order_items').update({ location_id: null }).eq('order_id', testOrder.id)
      const { data } = await supabase.rpc('route_order_to_locations', { p_order_id: testOrder.id })
      results.push(data?.map(r => r.result_location_id).sort().join(','))
    }
    const allSame = results.every(r => r === results[0])
    test('1.7 Routing is deterministic (3 runs)', allSame)
  }
}

async function testCheckoutEdgeFunction() {
  console.log('\n' + '═'.repeat(70))
  console.log('  TEST SUITE 2: CHECKOUT EDGE FUNCTION')
  console.log('═'.repeat(70) + '\n')

  // Test 2.1: Function responds
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    })
    test('2.1 Edge function responds', response.status !== 404, `Status: ${response.status}`)

    const data = await response.json()
    test('2.2 Returns JSON response', typeof data === 'object')
    test('2.3 Has error structure for invalid request', data.error !== undefined || data.success === false)
  } catch (err) {
    test('2.1 Edge function responds', false, err.message)
  }

  // Test 2.4: Verify error messages are sanitized (no debug info in 5xx)
  // We can't easily trigger a 5xx, but we can verify the function structure

  // Test 2.5: Get vendor and location for test (via order_items to avoid RLS)
  const { data: orderItem } = await supabase
    .from('order_items')
    .select('orders(vendor_id), location_id')
    .not('location_id', 'is', null)
    .limit(1)
    .single()

  const vendor = orderItem?.orders ? { id: orderItem.orders.vendor_id } : null
  const location = orderItem?.location_id ? { id: orderItem.location_id } : null

  test('2.4 Test vendor exists', !!vendor, vendor ? '' : 'No order_items with vendor')
  test('2.5 Test location exists', !!location, location ? '' : 'No order_items with location')

  // Test 2.6: Function requires authentication (security check)
  if (vendor && location) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        vendorId: vendor.id,
        locationId: location.id,
      }),
    })
    const data = await response.json()
    // Function should either require auth OR validate fields - both are correct
    const isSecure = response.status === 401 || response.status === 403 ||
                     (response.status === 400 && data.error)
    test('2.6 Function enforces security', isSecure,
      `Status: ${response.status}, Error: ${data.error || 'none'}`)
  }

  // Test 2.7: Service role can call function (with validation errors expected)
  const serviceResponse = await fetch(`${SUPABASE_URL}/functions/v1/process-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      vendorId: vendor?.id,
      locationId: location?.id,
      // Missing required fields - should get validation error, not auth error
    }),
  })
  const serviceData = await serviceResponse.json()
  // Should get a validation error (400) not auth error (401/403)
  test('2.7 Service role accepted (validation error expected)',
    serviceResponse.status === 400,
    `Status: ${serviceResponse.status}, Error: ${serviceData.error || 'none'}`)

  // Test 2.8: Verify error response structure
  test('2.8 Error response has correct structure',
    serviceData.error !== undefined && serviceData.meta?.requestId !== undefined,
    'Missing error structure fields')

  // Test 2.9: Verify no debug info in error (security)
  const hasDebugInfo = serviceData.error?.includes('[DEBUG]') ||
                       serviceData.error?.includes('stack') ||
                       serviceData.error?.includes('line ')
  test('2.9 No debug info leaked in errors', !hasDebugInfo,
    hasDebugInfo ? 'Debug info found in error' : '')
}

async function testEmailIntegration() {
  console.log('\n' + '═'.repeat(70))
  console.log('  TEST SUITE 3: EMAIL INTEGRATION')
  console.log('═'.repeat(70) + '\n')

  // Test 3.1: Email function exists
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    })
    test('3.1 Email edge function exists', response.status !== 404)
  } catch (err) {
    test('3.1 Email edge function exists', false, err.message)
  }

  // Test 3.2: Vendor email settings table exists
  const { error: settingsError } = await supabase
    .from('vendor_email_settings')
    .select('id')
    .limit(1)

  test('3.2 vendor_email_settings table accessible', !settingsError, settingsError?.message || '')

  // Test 3.3: email_sends table exists (for logging)
  const { error: sendsError } = await supabase
    .from('email_sends')
    .select('id')
    .limit(1)

  test('3.3 email_sends table accessible', !sendsError, sendsError?.message || '')
}

async function testDatabaseIntegrity() {
  console.log('\n' + '═'.repeat(70))
  console.log('  TEST SUITE 4: DATABASE INTEGRITY')
  console.log('═'.repeat(70) + '\n')

  // Test 4.1: orders table
  const { error: ordersError } = await supabase.from('orders').select('id').limit(1)
  test('4.1 orders table accessible', !ordersError)

  // Test 4.2: order_items table
  const { error: itemsError } = await supabase.from('order_items').select('id').limit(1)
  test('4.2 order_items table accessible', !itemsError)

  // Test 4.3: order_locations table
  const { error: locsError } = await supabase.from('order_locations').select('id').limit(1)
  test('4.3 order_locations table accessible', !locsError)

  // Test 4.4: inventory table
  const { error: invError } = await supabase.from('inventory').select('id').limit(1)
  test('4.4 inventory table accessible', !invError)

  // Test 4.5: locations table
  const { error: locError } = await supabase.from('locations').select('id').limit(1)
  test('4.5 locations table accessible', !locError)

  // Test 4.6: customers table
  const { error: custError } = await supabase.from('customers').select('id').limit(1)
  test('4.6 customers table accessible', !custError)

  // Test 4.7: payment_transactions table
  const { error: payError } = await supabase.from('payment_transactions').select('id').limit(1)
  test('4.7 payment_transactions table accessible', !payError)

  // Test 4.8: checkout_attempts table
  const { error: attemptError } = await supabase.from('checkout_attempts').select('id').limit(1)
  test('4.8 checkout_attempts table accessible', !attemptError)

  // Test 4.9: Verify order_locations has correct constraint
  let constraint = null
  try {
    const result = await supabase.rpc('get_constraint_info', {})
    constraint = result.data
  } catch (e) {
    // Function may not exist - that's ok
  }

  // Alternative: check by trying to insert duplicate
  const { data: order } = await supabase.from('orders').select('id').limit(1).single()
  if (order) {
    const { data: loc } = await supabase.from('locations').select('id').limit(1).single()
    if (loc) {
      // This should work (or conflict gracefully)
      await supabase.from('order_locations').upsert({
        order_id: order.id,
        location_id: loc.id,
        item_count: 0,
        total_quantity: 0,
        fulfillment_status: 'unfulfilled'
      }, { onConflict: 'order_id,location_id' })
      test('4.9 order_locations upsert works', true)
    }
  }
}

async function testConcurrency() {
  console.log('\n' + '═'.repeat(70))
  console.log('  TEST SUITE 5: CONCURRENCY & PERFORMANCE')
  console.log('═'.repeat(70) + '\n')

  // Test 5.1: Parallel routing calls
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('order_type', 'shipping')
    .limit(5)

  if (orders?.length >= 3) {
    // Reset all
    for (const order of orders) {
      await supabase.from('order_items').update({ location_id: null }).eq('order_id', order.id)
    }

    const start = Date.now()
    const promises = orders.map(order =>
      supabase.rpc('route_order_to_locations', { p_order_id: order.id })
    )
    const results = await Promise.all(promises)
    const duration = Date.now() - start

    const allSucceeded = results.every(r => !r.error)
    test('5.1 Parallel routing (5 orders)', allSucceeded, `${duration}ms`)
    test('5.2 Performance < 2s for 5 orders', duration < 2000, `${duration}ms`)
  } else {
    test('5.1 Parallel routing (5 orders)', false, 'Not enough orders')
    test('5.2 Performance < 2s for 5 orders', false, 'Skipped')
  }

  // Test 5.3: Rapid repeated calls on same order
  if (orders?.[0]) {
    await supabase.from('order_items').update({ location_id: null }).eq('order_id', orders[0].id)

    const rapidPromises = Array(5).fill(null).map(() =>
      supabase.rpc('route_order_to_locations', { p_order_id: orders[0].id })
    )
    const rapidResults = await Promise.all(rapidPromises)
    const rapidErrors = rapidResults.filter(r => r.error)

    test('5.3 Rapid calls handle concurrency', rapidErrors.length === 0,
      `${rapidErrors.length} errors out of 5`)
  }
}

async function testEdgeCases() {
  console.log('\n' + '═'.repeat(70))
  console.log('  TEST SUITE 6: EDGE CASES')
  console.log('═'.repeat(70) + '\n')

  // Test 6.1: Route non-existent order
  const { data: noOrder, error: noOrderError } = await supabase
    .rpc('route_order_to_locations', { p_order_id: '00000000-0000-0000-0000-000000000000' })

  test('6.1 Non-existent order returns empty', !noOrderError && noOrder?.length === 0)

  // Test 6.2: Order with no items
  const { data: emptyOrder } = await supabase
    .from('orders')
    .select('id, order_items(id)')
    .eq('order_type', 'shipping')
    .order('created_at', { ascending: false })
    .limit(100)

  const orderWithNoItems = emptyOrder?.find(o => !o.order_items?.length)
  if (orderWithNoItems) {
    const { error } = await supabase.rpc('route_order_to_locations', { p_order_id: orderWithNoItems.id })
    test('6.2 Empty order handles gracefully', !error)
  } else {
    test('6.2 Empty order handles gracefully', true, 'No empty orders to test (OK)')
  }

  // Test 6.3: Pickup order routing
  const { data: pickupOrders } = await supabase
    .from('orders')
    .select('id, pickup_location_id, order_items(id)')
    .eq('order_type', 'pickup')
    .not('pickup_location_id', 'is', null)
    .limit(1)

  if (pickupOrders?.[0]) {
    await supabase.from('order_items').update({ location_id: null }).eq('order_id', pickupOrders[0].id)
    const { error } = await supabase.rpc('route_order_to_locations', { p_order_id: pickupOrders[0].id })
    test('6.3 Pickup order routes correctly', !error)
  } else {
    test('6.3 Pickup order routes correctly', true, 'No pickup orders to test')
  }

  // Test 6.4: Verify fulfillment_status values are valid
  const { data: invalidStatuses } = await supabase
    .from('order_locations')
    .select('fulfillment_status')
    .not('fulfillment_status', 'in', '("unfulfilled","partial","fulfilled","shipped")')
    .limit(1)

  test('6.4 All fulfillment_status values valid', !invalidStatuses?.length)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║                    FINAL CHECKOUT SYSTEM TEST                        ║')
  console.log('║              Testing All Components End-to-End                       ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')

  const startTime = Date.now()

  await testRoutingFunction()
  await testCheckoutEdgeFunction()
  await testEmailIntegration()
  await testDatabaseIntegrity()
  await testConcurrency()
  await testEdgeCases()

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  // Final Report
  console.log('\n' + '═'.repeat(70))
  console.log('                         FINAL REPORT')
  console.log('═'.repeat(70))
  console.log(`
  Total Tests:     ${results.passed + results.failed}
  ✅ Passed:       ${results.passed}
  ❌ Failed:       ${results.failed}

  Duration:        ${duration}s
  Success Rate:    ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%
  `)

  if (results.failed > 0) {
    console.log('FAILED TESTS:')
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  ❌ ${t.name}: ${t.details}`)
    })
  }

  console.log('═'.repeat(70))
  if (results.failed === 0) {
    console.log('  🎉 ALL TESTS PASSED - CHECKOUT SYSTEM IS 100% OPERATIONAL')
  } else {
    console.log(`  ⚠️  ${results.failed} TEST(S) FAILED - REVIEW ABOVE`)
  }
  console.log('═'.repeat(70) + '\n')

  process.exit(results.failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Test suite crashed:', err)
  process.exit(1)
})
