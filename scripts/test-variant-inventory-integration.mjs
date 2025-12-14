/**
 * Comprehensive Test Suite: Variant Inventory Integration
 * Tests the full flow from database to website to POS
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'
const PRE_ROLL_VARIANT_ID = '40c36cdd-8533-4926-8e6d-32f9e0def2f9'
const TEST_PRODUCT_ID = '3cbabc61-0b53-4cff-adf1-0aeea323850c' // Sherb Cream Pie
const TEST_LOCATION_ID = '4d0685cc-6dfd-4c2e-a640-d8cfd4080975'

let testsPassed = 0
let testsFailed = 0

function log(message, type = 'info') {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️'
  console.log(`${prefix} ${message}`)
}

function assert(condition, message) {
  if (condition) {
    log(message, 'pass')
    testsPassed++
  } else {
    log(message, 'fail')
    testsFailed++
  }
}

async function setupTestData() {
  log('Setting up test data...')

  // Ensure we have variant inventory with known quantity
  const { error } = await supabase
    .from('variant_inventory')
    .upsert({
      product_id: TEST_PRODUCT_ID,
      variant_template_id: PRE_ROLL_VARIANT_ID,
      location_id: TEST_LOCATION_ID,
      vendor_id: VENDOR_ID,
      quantity: 15  // Set to known value for testing
    }, { onConflict: 'product_id,variant_template_id,location_id' })

  if (error) {
    log(`Setup error: ${error.message}`, 'fail')
    return false
  }

  log('Test data setup complete - variant inventory set to 15')
  return true
}

async function test1_VariantInventoryQuery() {
  console.log('\n--- TEST 1: variant_inventory table query ---')

  const { data, error } = await supabase
    .from('variant_inventory')
    .select('*')
    .eq('vendor_id', VENDOR_ID)
    .gt('quantity', 0)

  assert(!error, 'Query executes without error')
  assert(Array.isArray(data), 'Returns array of results')
  assert(data.length > 0, 'Has at least one variant with inventory')

  const preRollInventory = data.find(v => v.variant_template_id === PRE_ROLL_VARIANT_ID)
  assert(preRollInventory !== undefined, 'Pre Roll variant inventory exists')
  assert(preRollInventory?.quantity === 15, `Pre Roll quantity is 15 (got ${preRollInventory?.quantity})`)

  return data
}

async function test2_VariantTemplateWithInventory() {
  console.log('\n--- TEST 2: Variant templates linked to inventory ---')

  // Get all variants for the vendor
  const { data: variants, error: variantsError } = await supabase
    .from('category_variant_templates')
    .select('id, variant_name, category_id')
    .eq('vendor_id', VENDOR_ID)
    .eq('is_active', true)

  assert(!variantsError, 'Can query variant templates')

  // Get variant inventory
  const { data: inventory } = await supabase
    .from('variant_inventory')
    .select('variant_template_id, quantity')
    .eq('vendor_id', VENDOR_ID)
    .gt('quantity', 0)

  const variantsWithInventory = new Set(inventory?.map(i => i.variant_template_id) || [])

  log(`Total variants: ${variants?.length || 0}`)
  log(`Variants with inventory: ${variantsWithInventory.size}`)

  assert(variantsWithInventory.has(PRE_ROLL_VARIANT_ID), 'Pre Roll variant has inventory')

  // Check that variants WITHOUT inventory are correctly identified
  const variantsWithoutInventory = variants?.filter(v => !variantsWithInventory.has(v.id)) || []
  log(`Variants without inventory: ${variantsWithoutInventory.length}`)

  return { variants, variantsWithInventory }
}

async function test3_ProductVariantInventoryMapping() {
  console.log('\n--- TEST 3: Product-to-Variant inventory mapping ---')

  // Simulate what shop-data.ts does
  const { data: variantInventory } = await supabase
    .from('variant_inventory')
    .select('product_id, variant_template_id, location_id, quantity')
    .eq('vendor_id', VENDOR_ID)
    .gt('quantity', 0)

  // Build the map structure: productId -> variantId -> quantity
  const variantInventoryMap = {}
  const variantsWithInventory = new Set()

  variantInventory?.forEach(vi => {
    if (!variantInventoryMap[vi.product_id]) {
      variantInventoryMap[vi.product_id] = {}
    }
    if (!variantInventoryMap[vi.product_id][vi.variant_template_id]) {
      variantInventoryMap[vi.product_id][vi.variant_template_id] = 0
    }
    variantInventoryMap[vi.product_id][vi.variant_template_id] += vi.quantity
    variantsWithInventory.add(vi.variant_template_id)
  })

  assert(Object.keys(variantInventoryMap).length > 0, 'Map has product entries')
  assert(variantInventoryMap[TEST_PRODUCT_ID] !== undefined, 'Test product has variant inventory')
  assert(
    variantInventoryMap[TEST_PRODUCT_ID]?.[PRE_ROLL_VARIANT_ID] === 15,
    `Test product Pre Roll inventory is 15 (got ${variantInventoryMap[TEST_PRODUCT_ID]?.[PRE_ROLL_VARIANT_ID]})`
  )

  return variantInventoryMap
}

async function test4_PricingTierQuantities() {
  console.log('\n--- TEST 4: Pricing tier quantities are correct ---')

  const { data: template, error } = await supabase
    .from('pricing_tier_templates')
    .select('name, default_tiers')
    .eq('id', 'e6bb6513-07d5-4a18-8d59-f4ecffc10537')  // Pre Roll template
    .single()

  assert(!error, 'Can fetch Pre Roll pricing template')
  assert(template?.name === 'Pre Roll', `Template name is "Pre Roll" (got "${template?.name}")`)

  const tiers = template?.default_tiers || []
  assert(tiers.length === 3, `Has 3 tiers (got ${tiers.length})`)

  const tier1 = tiers.find(t => t.label === '1')
  const tier3 = tiers.find(t => t.label === '3 Pre-Rolls')
  const tier5 = tiers.find(t => t.label === '5 Pre-Rolls')

  assert(tier1?.quantity === 1, `"1" tier has quantity 1 (got ${tier1?.quantity})`)
  assert(tier3?.quantity === 3, `"3 Pre-Rolls" tier has quantity 3 (got ${tier3?.quantity})`)
  assert(tier5?.quantity === 5, `"5 Pre-Rolls" tier has quantity 5 (got ${tier5?.quantity})`)

  return tiers
}

async function test5_ReserveInventoryFunction() {
  console.log('\n--- TEST 5: reserve_inventory() function works for variants ---')

  // Create a test order
  const testOrderId = crypto.randomUUID()

  // Create the order first
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      id: testOrderId,
      vendor_id: VENDOR_ID,
      status: 'pending',
      payment_status: 'pending',
      total_amount: 39.99,
      subtotal: 39.99,
      tax_amount: 0,
      order_type: 'pickup',
      pickup_location_id: TEST_LOCATION_ID
    })

  if (orderError) {
    log(`Could not create test order: ${orderError.message}`, 'warn')
    return
  }

  // Get inventory ID for the product
  const { data: inv } = await supabase
    .from('inventory')
    .select('id')
    .eq('product_id', TEST_PRODUCT_ID)
    .eq('location_id', TEST_LOCATION_ID)
    .single()

  // Call reserve_inventory with variant data
  const items = [{
    inventoryId: inv?.id,
    productId: TEST_PRODUCT_ID,
    variantTemplateId: PRE_ROLL_VARIANT_ID,
    locationId: TEST_LOCATION_ID,
    tierQty: 5  // Requesting 5 Pre-Rolls
  }]

  const { data: reserveResult, error: reserveError } = await supabase
    .rpc('reserve_inventory', {
      p_order_id: testOrderId,
      p_items: items
    })

  if (reserveError) {
    log(`reserve_inventory error: ${reserveError.message}`, 'fail')
    testsFailed++
  } else {
    log('reserve_inventory executed successfully', 'pass')
    testsPassed++
  }

  // Check the hold was created with correct metadata
  const { data: hold } = await supabase
    .from('inventory_holds')
    .select('*')
    .eq('order_id', testOrderId)
    .single()

  assert(hold !== null, 'Inventory hold was created')
  assert(hold?.metadata?.is_variant_sale === true, 'Hold marked as variant sale')
  assert(hold?.metadata?.variant_qty_requested === 5, `Requested qty is 5 (got ${hold?.metadata?.variant_qty_requested})`)
  assert(hold?.metadata?.variant_template_id === PRE_ROLL_VARIANT_ID, 'Correct variant template ID in metadata')

  // Clean up - cancel the order and release hold
  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', testOrderId)
  await supabase.from('inventory_holds').update({ released_at: new Date().toISOString() }).eq('order_id', testOrderId)

  return hold
}

async function test6_FinalizeInventoryHolds() {
  console.log('\n--- TEST 6: finalize_inventory_holds() deducts from variant_inventory ---')

  // Get current variant inventory
  const { data: before } = await supabase
    .from('variant_inventory')
    .select('quantity')
    .eq('product_id', TEST_PRODUCT_ID)
    .eq('variant_template_id', PRE_ROLL_VARIANT_ID)
    .eq('location_id', TEST_LOCATION_ID)
    .single()

  const qtyBefore = before?.quantity || 0
  log(`Variant inventory before: ${qtyBefore}`)

  // Create a complete test order flow
  const testOrderId = crypto.randomUUID()

  await supabase.from('orders').insert({
    id: testOrderId,
    vendor_id: VENDOR_ID,
    status: 'pending',
    payment_status: 'pending',
    total_amount: 39.99,
    subtotal: 39.99,
    tax_amount: 0,
    order_type: 'pickup',
    pickup_location_id: TEST_LOCATION_ID
  })

  const { data: inv } = await supabase
    .from('inventory')
    .select('id')
    .eq('product_id', TEST_PRODUCT_ID)
    .eq('location_id', TEST_LOCATION_ID)
    .single()

  // Reserve 3 Pre-Rolls
  await supabase.rpc('reserve_inventory', {
    p_order_id: testOrderId,
    p_items: [{
      inventoryId: inv?.id,
      productId: TEST_PRODUCT_ID,
      variantTemplateId: PRE_ROLL_VARIANT_ID,
      locationId: TEST_LOCATION_ID,
      tierQty: 3
    }]
  })

  // Update order to completed
  await supabase.from('orders').update({
    status: 'completed',
    payment_status: 'paid'
  }).eq('id', testOrderId)

  // Finalize the hold
  const { error: finalizeError } = await supabase.rpc('finalize_inventory_holds', {
    p_order_id: testOrderId
  })

  if (finalizeError) {
    log(`finalize_inventory_holds error: ${finalizeError.message}`, 'fail')
    testsFailed++
    return
  }

  // Check variant inventory was deducted
  const { data: after } = await supabase
    .from('variant_inventory')
    .select('quantity')
    .eq('product_id', TEST_PRODUCT_ID)
    .eq('variant_template_id', PRE_ROLL_VARIANT_ID)
    .eq('location_id', TEST_LOCATION_ID)
    .single()

  const qtyAfter = after?.quantity || 0
  log(`Variant inventory after: ${qtyAfter}`)

  assert(qtyAfter === qtyBefore - 3, `Inventory decreased by 3 (${qtyBefore} -> ${qtyAfter})`)

  // Check hold was released
  const { data: hold } = await supabase
    .from('inventory_holds')
    .select('released_at, metadata')
    .eq('order_id', testOrderId)
    .single()

  assert(hold?.released_at !== null, 'Hold was released')
  assert(hold?.metadata?.finalized === true, 'Hold marked as finalized')

  return { qtyBefore, qtyAfter }
}

async function test7_EdgeCaseZeroInventory() {
  console.log('\n--- TEST 7: Edge case - Variant with 0 inventory ---')

  // Temporarily set inventory to 0
  await supabase
    .from('variant_inventory')
    .update({ quantity: 0 })
    .eq('product_id', TEST_PRODUCT_ID)
    .eq('variant_template_id', PRE_ROLL_VARIANT_ID)

  // Query for variants with inventory
  const { data } = await supabase
    .from('variant_inventory')
    .select('variant_template_id')
    .eq('vendor_id', VENDOR_ID)
    .gt('quantity', 0)

  const hasPreRoll = data?.some(v => v.variant_template_id === PRE_ROLL_VARIANT_ID)
  assert(!hasPreRoll, 'Pre Roll NOT in results when quantity is 0')

  // Restore inventory
  await supabase
    .from('variant_inventory')
    .update({ quantity: 12 })  // Set to 12 (15 - 3 from test 6)
    .eq('product_id', TEST_PRODUCT_ID)
    .eq('variant_template_id', PRE_ROLL_VARIANT_ID)

  log('Restored variant inventory to 12')
}

async function test8_MultipleLocationsAggregation() {
  console.log('\n--- TEST 8: Multiple locations aggregate correctly ---')

  // Get all locations for vendor
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('vendor_id', VENDOR_ID)
    .eq('is_active', true)

  log(`Found ${locations?.length || 0} active locations`)

  if (locations && locations.length > 1) {
    // Add inventory to second location
    const secondLocation = locations.find(l => l.id !== TEST_LOCATION_ID)
    if (secondLocation) {
      await supabase.from('variant_inventory').upsert({
        product_id: TEST_PRODUCT_ID,
        variant_template_id: PRE_ROLL_VARIANT_ID,
        location_id: secondLocation.id,
        vendor_id: VENDOR_ID,
        quantity: 5
      }, { onConflict: 'product_id,variant_template_id,location_id' })

      // Query total
      const { data: all } = await supabase
        .from('variant_inventory')
        .select('quantity')
        .eq('product_id', TEST_PRODUCT_ID)
        .eq('variant_template_id', PRE_ROLL_VARIANT_ID)

      const total = all?.reduce((sum, v) => sum + v.quantity, 0) || 0
      assert(total >= 17, `Total across locations is >= 17 (got ${total})`)

      // Clean up second location
      await supabase.from('variant_inventory').delete()
        .eq('product_id', TEST_PRODUCT_ID)
        .eq('variant_template_id', PRE_ROLL_VARIANT_ID)
        .eq('location_id', secondLocation.id)
    }
  } else {
    log('Only one location - skipping multi-location test', 'warn')
  }
}

async function runAllTests() {
  console.log('='.repeat(60))
  console.log('VARIANT INVENTORY INTEGRATION TEST SUITE')
  console.log('='.repeat(60))

  const setupOk = await setupTestData()
  if (!setupOk) {
    console.log('\n❌ Setup failed, aborting tests')
    return
  }

  await test1_VariantInventoryQuery()
  await test2_VariantTemplateWithInventory()
  await test3_ProductVariantInventoryMapping()
  await test4_PricingTierQuantities()
  await test5_ReserveInventoryFunction()
  await test6_FinalizeInventoryHolds()
  await test7_EdgeCaseZeroInventory()
  await test8_MultipleLocationsAggregation()

  console.log('\n' + '='.repeat(60))
  console.log(`RESULTS: ${testsPassed} passed, ${testsFailed} failed`)
  console.log('='.repeat(60))

  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!')
  } else {
    console.log('\n⚠️ Some tests failed - review above for details')
  }
}

runAllTests()
