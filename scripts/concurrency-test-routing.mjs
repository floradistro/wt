#!/usr/bin/env node
/**
 * CONCURRENCY TEST for route_order_to_locations()
 * Tests parallel routing calls to ensure no race conditions
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  console.log('═'.repeat(70))
  console.log('  CONCURRENCY STRESS TEST')
  console.log('  Testing parallel routing calls')
  console.log('═'.repeat(70))

  // Get orders to test
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, order_items (id)')
    .eq('order_type', 'shipping')
    .order('created_at', { ascending: false })
    .limit(20)

  console.log(`\nLoaded ${orders.length} orders for concurrent testing\n`)

  // Reset all order items first
  console.log('Resetting all order item locations...')
  for (const order of orders) {
    await supabase
      .from('order_items')
      .update({ location_id: null })
      .eq('order_id', order.id)
  }
  console.log('Done resetting.\n')

  // Test 1: Route all orders in parallel
  console.log('─'.repeat(70))
  console.log('TEST 1: Route 20 orders simultaneously')
  console.log('─'.repeat(70))

  const startTime = Date.now()

  const promises = orders.map(order =>
    supabase.rpc('route_order_to_locations', { p_order_id: order.id })
      .then(({ data, error }) => ({
        order: order.order_number,
        success: !error,
        error: error?.message,
        locations: data?.length || 0
      }))
  )

  const results = await Promise.all(promises)
  const elapsed = Date.now() - startTime

  console.log(`\nCompleted in ${elapsed}ms`)

  const successes = results.filter(r => r.success)
  const failures = results.filter(r => !r.success)

  console.log(`\n✅ Successful: ${successes.length}`)
  console.log(`❌ Failed: ${failures.length}`)

  if (failures.length > 0) {
    console.log('\nFailures:')
    for (const f of failures) {
      console.log(`  - ${f.order}: ${f.error}`)
    }
  }

  // Verify data integrity
  console.log('\n' + '─'.repeat(70))
  console.log('VERIFYING DATA INTEGRITY')
  console.log('─'.repeat(70))

  let integrityPassed = 0
  let integrityFailed = 0

  for (const order of orders) {
    // Check order_items all have locations
    const { data: items } = await supabase
      .from('order_items')
      .select('id, location_id')
      .eq('order_id', order.id)

    const assigned = items?.filter(i => i.location_id) || []

    // Check order_locations matches
    const { data: locs } = await supabase
      .from('order_locations')
      .select('item_count')
      .eq('order_id', order.id)

    const totalFromLocs = (locs || []).reduce((sum, l) => sum + l.item_count, 0)

    if (assigned.length === totalFromLocs) {
      integrityPassed++
    } else {
      integrityFailed++
      console.log(`  ❌ ${order.order_number}: items=${assigned.length}, order_locations sum=${totalFromLocs}`)
    }
  }

  console.log(`\n✅ Integrity Passed: ${integrityPassed}`)
  console.log(`❌ Integrity Failed: ${integrityFailed}`)

  // Test 2: Rapid repeated calls on same order
  console.log('\n' + '─'.repeat(70))
  console.log('TEST 2: Rapid repeated calls (10x on same order)')
  console.log('─'.repeat(70))

  const testOrder = orders[0]

  // Reset
  await supabase
    .from('order_items')
    .update({ location_id: null })
    .eq('order_id', testOrder.id)

  const rapidPromises = Array(10).fill(null).map(() =>
    supabase.rpc('route_order_to_locations', { p_order_id: testOrder.id })
  )

  const rapidResults = await Promise.all(rapidPromises)
  const rapidErrors = rapidResults.filter(r => r.error)

  console.log(`\nOrder: ${testOrder.order_number}`)
  console.log(`Calls: 10`)
  console.log(`Errors: ${rapidErrors.length}`)

  // Check final state
  const { data: finalItems } = await supabase
    .from('order_items')
    .select('id, location_id')
    .eq('order_id', testOrder.id)

  const { data: finalLocs } = await supabase
    .from('order_locations')
    .select('*')
    .eq('order_id', testOrder.id)

  console.log(`\nFinal state:`)
  console.log(`  - Items with location: ${finalItems?.filter(i => i.location_id).length}/${finalItems?.length}`)
  console.log(`  - order_locations records: ${finalLocs?.length}`)

  // Test 3: Mixed order types concurrently
  console.log('\n' + '─'.repeat(70))
  console.log('TEST 3: Mixed shipping + pickup orders concurrently')
  console.log('─'.repeat(70))

  const { data: mixedOrders } = await supabase
    .from('orders')
    .select('id, order_number, order_type, order_items (id)')
    .in('order_type', ['shipping', 'pickup'])
    .order('created_at', { ascending: false })
    .limit(10)

  // Reset
  for (const order of mixedOrders || []) {
    await supabase
      .from('order_items')
      .update({ location_id: null })
      .eq('order_id', order.id)
  }

  const mixedPromises = (mixedOrders || []).map(order =>
    supabase.rpc('route_order_to_locations', { p_order_id: order.id })
      .then(({ data, error }) => ({
        order: order.order_number,
        type: order.order_type,
        success: !error,
        error: error?.message
      }))
  )

  const mixedResults = await Promise.all(mixedPromises)
  const mixedSuccesses = mixedResults.filter(r => r.success)
  const mixedFailures = mixedResults.filter(r => !r.success)

  console.log(`\n✅ Successful: ${mixedSuccesses.length}`)
  console.log(`❌ Failed: ${mixedFailures.length}`)

  for (const r of mixedResults) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.order} (${r.type})${r.error ? ': ' + r.error : ''}`)
  }

  // Final Summary
  console.log('\n' + '═'.repeat(70))
  console.log('  CONCURRENCY TEST SUMMARY')
  console.log('═'.repeat(70))

  const allPassed =
    failures.length === 0 &&
    integrityFailed === 0 &&
    rapidErrors.length === 0 &&
    mixedFailures.length === 0

  if (allPassed) {
    console.log('\n  🎉 ALL CONCURRENCY TESTS PASSED')
    console.log('  The routing function is thread-safe and reliable!')
  } else {
    console.log('\n  ⚠️  SOME TESTS FAILED - Review errors above')
  }

  console.log('═'.repeat(70))
}

main().catch(console.error)
