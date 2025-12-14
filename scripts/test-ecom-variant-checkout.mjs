/**
 * Test E-commerce Variant Checkout Flow
 *
 * This script tests the complete e-commerce checkout flow for variant products,
 * verifying that:
 * 1. variantTemplateId is passed correctly through the checkout
 * 2. reserve_inventory properly handles variant inventory
 * 3. finalize_inventory_holds deducts from variant_inventory table
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Use WhaleTools vendor (has variant templates configured)
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

async function testEcomVariantCheckout() {
  console.log('='.repeat(60))
  console.log('E-COMMERCE VARIANT CHECKOUT TEST')
  console.log('='.repeat(60))

  // 1. Find a product with variant inventory
  console.log('\n1. Finding product with variant inventory...')
  const { data: variantInventoryList, error: viError } = await supabase
    .from('variant_inventory')
    .select(`
      id,
      product_id,
      variant_template_id,
      location_id,
      quantity,
      products(id, name),
      category_variant_templates(id, variant_name, conversion_ratio)
    `)
    .eq('vendor_id', vendorId)
    .gt('quantity', 0)
    .limit(1)

  if (viError || !variantInventoryList || variantInventoryList.length === 0) {
    console.log('No variant inventory found:', viError?.message)
    return
  }

  const variantInventory = variantInventoryList[0]

  console.log(`Found: ${variantInventory.products.name}`)
  console.log(`  Variant: ${variantInventory.category_variant_templates.variant_name}`)
  console.log(`  Quantity: ${variantInventory.quantity}`)
  console.log(`  Location: ${variantInventory.location_id}`)

  const productId = variantInventory.product_id
  const variantTemplateId = variantInventory.variant_template_id
  const locationId = variantInventory.location_id
  const initialQty = variantInventory.quantity

  // 2. Create a test order
  console.log('\n2. Creating test order...')
  const testOrderNumber = `TEST-ECOM-${Date.now()}`

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      vendor_id: vendorId,
      order_number: testOrderNumber,
      order_type: 'shipping',
      status: 'pending',
      payment_status: 'pending',
      subtotal: 25.00,
      tax_amount: 2.50,
      total_amount: 27.50,
    })
    .select('id')
    .single()

  if (orderError) {
    console.error('Failed to create order:', orderError.message)
    return
  }
  console.log(`Created order: ${order.id}`)

  // 3. Get inventory ID for the product at location
  const { data: inventory } = await supabase
    .from('inventory')
    .select('id')
    .eq('product_id', productId)
    .eq('location_id', locationId)
    .single()

  const inventoryId = inventory?.id

  // 4. Simulate what the checkout page sends
  const checkoutItems = [{
    productId: productId,
    productName: variantInventory.products.name,
    productSku: productId,
    quantity: 1,
    unitPrice: 25.00,
    lineTotal: 25.00,
    gramsToDeduct: 1, // 1 unit
    tierQty: 1,
    inventoryId: inventoryId,
    variantTemplateId: variantTemplateId, // THIS IS THE KEY FIELD
    variantId: variantTemplateId,
    variantName: variantInventory.category_variant_templates.variant_name,
    locationId: locationId,
  }]

  console.log('\n3. Checkout items payload:')
  console.log(JSON.stringify(checkoutItems, null, 2))

  // 5. Call reserve_inventory
  console.log('\n4. Calling reserve_inventory...')
  const { data: reserveResult, error: reserveError } = await supabase
    .rpc('reserve_inventory', {
      p_order_id: order.id,
      p_items: checkoutItems
    })

  if (reserveError) {
    console.error('reserve_inventory failed:', reserveError.message)
    // Cleanup
    await supabase.from('orders').delete().eq('id', order.id)
    return
  }
  console.log('reserve_inventory succeeded')

  // 6. Check the hold was created with variant metadata
  console.log('\n5. Checking inventory hold...')
  const { data: holds } = await supabase
    .from('inventory_holds')
    .select('*')
    .eq('order_id', order.id)
    .is('released_at', null)

  if (!holds || holds.length === 0) {
    console.error('No inventory holds found!')
    await supabase.from('orders').delete().eq('id', order.id)
    return
  }

  const hold = holds[0]
  console.log('Hold created:')
  console.log(`  Hold ID: ${hold.id}`)
  console.log(`  Quantity: ${hold.quantity}`)
  console.log(`  Metadata: ${JSON.stringify(hold.metadata, null, 2)}`)

  // Verify variant metadata
  const isVariantSale = hold.metadata?.is_variant_sale
  const holdVariantTemplateId = hold.metadata?.variant_template_id
  const variantQtyRequested = hold.metadata?.variant_qty_requested

  console.log('\n6. Validating hold metadata...')
  if (!isVariantSale) {
    console.error('FAIL: is_variant_sale not set in hold metadata')
  } else {
    console.log('PASS: is_variant_sale = true')
  }

  if (holdVariantTemplateId !== variantTemplateId) {
    console.error(`FAIL: variant_template_id mismatch. Expected: ${variantTemplateId}, Got: ${holdVariantTemplateId}`)
  } else {
    console.log(`PASS: variant_template_id = ${variantTemplateId}`)
  }

  if (variantQtyRequested !== 1) {
    console.error(`FAIL: variant_qty_requested mismatch. Expected: 1, Got: ${variantQtyRequested}`)
  } else {
    console.log(`PASS: variant_qty_requested = 1`)
  }

  // 7. Call finalize_inventory_holds
  console.log('\n7. Calling finalize_inventory_holds...')
  const { error: finalizeError } = await supabase
    .rpc('finalize_inventory_holds', {
      p_order_id: order.id
    })

  if (finalizeError) {
    console.error('finalize_inventory_holds failed:', finalizeError.message)
    // Cleanup
    await supabase.from('inventory_holds').delete().eq('order_id', order.id)
    await supabase.from('orders').delete().eq('id', order.id)
    return
  }
  console.log('finalize_inventory_holds succeeded')

  // 8. Verify variant_inventory was deducted
  console.log('\n8. Verifying variant_inventory deduction...')
  const { data: updatedVi } = await supabase
    .from('variant_inventory')
    .select('quantity')
    .eq('product_id', productId)
    .eq('variant_template_id', variantTemplateId)
    .eq('location_id', locationId)
    .single()

  const finalQty = updatedVi?.quantity ?? 0
  const expectedQty = initialQty - 1

  if (finalQty === expectedQty) {
    console.log(`PASS: variant_inventory deducted correctly`)
    console.log(`  Initial: ${initialQty}`)
    console.log(`  Final: ${finalQty}`)
    console.log(`  Deducted: ${initialQty - finalQty}`)
  } else {
    console.error(`FAIL: variant_inventory not deducted correctly`)
    console.error(`  Expected: ${expectedQty}, Got: ${finalQty}`)
  }

  // 9. Check stock_movements
  console.log('\n9. Checking stock_movements...')
  const { data: movements } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('reference_id', order.id)
    .order('created_at', { ascending: false })

  if (movements && movements.length > 0) {
    console.log(`Found ${movements.length} stock movement(s):`)
    movements.forEach(m => {
      console.log(`  - Type: ${m.movement_type}, Qty: ${m.quantity_change}, Notes: ${m.notes}`)
    })
  } else {
    console.log('No stock movements found (may be OK if using variant stock)')
  }

  // 10. Cleanup - restore inventory
  console.log('\n10. Cleaning up...')
  await supabase
    .from('variant_inventory')
    .update({ quantity: initialQty })
    .eq('product_id', productId)
    .eq('variant_template_id', variantTemplateId)
    .eq('location_id', locationId)

  await supabase.from('stock_movements').delete().eq('reference_id', order.id)
  await supabase.from('order_items').delete().eq('order_id', order.id)
  await supabase.from('orders').delete().eq('id', order.id)

  console.log('Cleanup complete')

  console.log('\n' + '='.repeat(60))
  console.log('TEST COMPLETE')
  console.log('='.repeat(60))
}

testEcomVariantCheckout().catch(console.error)
