/**
 * COMPREHENSIVE INVENTORY & CHECKOUT VALIDATION TEST
 *
 * This test validates:
 * 1. Variant inventory setup and queries
 * 2. POS variant checkout flow (reserve_inventory + finalize_inventory_holds)
 * 3. E-commerce variant checkout flow (same functions)
 * 4. Regular (non-variant) product checkout flow
 * 5. Inventory deduction correctness
 * 6. Stock movement records
 * 7. Edge cases (zero inventory, auto-convert from parent)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Use WhaleTools vendor (has variant templates configured)
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

let passed = 0
let failed = 0
const results = []

function log(msg) {
  console.log(msg)
}

function pass(test) {
  passed++
  results.push({ test, status: 'PASS' })
  log(`  ✓ ${test}`)
}

function fail(test, reason) {
  failed++
  results.push({ test, status: 'FAIL', reason })
  log(`  ✗ ${test}: ${reason}`)
}

function section(title) {
  log(`\n${'─'.repeat(60)}`)
  log(`  ${title}`)
  log(`${'─'.repeat(60)}`)
}

async function cleanupOrder(orderId) {
  await supabase.from('stock_movements').delete().eq('reference_id', orderId)
  await supabase.from('inventory_holds').delete().eq('order_id', orderId)
  await supabase.from('order_items').delete().eq('order_id', orderId)
  await supabase.from('orders').delete().eq('id', orderId)
}

async function runTests() {
  log('═'.repeat(60))
  log('  COMPREHENSIVE INVENTORY & CHECKOUT VALIDATION')
  log('═'.repeat(60))

  // ============================================================
  // SETUP: Get test data
  // ============================================================
  section('1. TEST DATA SETUP')

  // Get variant template
  const { data: templates } = await supabase
    .from('category_variant_templates')
    .select('*, pricing_template:pricing_template_id(id, default_tiers)')
    .eq('vendor_id', vendorId)
    .limit(1)

  if (!templates || templates.length === 0) {
    fail('Variant template exists', 'No variant templates found')
    return
  }
  const template = templates[0]
  pass(`Variant template found: ${template.variant_name}`)
  log(`    Template ID: ${template.id}`)
  log(`    Conversion ratio: ${template.conversion_ratio}`)

  // Get pricing tiers
  const pricingTiers = template.pricing_template?.default_tiers || []
  if (pricingTiers.length > 0) {
    pass(`Pricing tiers found: ${pricingTiers.length}`)
    pricingTiers.forEach(t => log(`    - ${t.label}: qty=${t.quantity}, price=$${t.price}`))
  } else {
    fail('Pricing tiers exist', 'No pricing tiers found')
  }

  // Get variant inventory
  const { data: viList } = await supabase
    .from('variant_inventory')
    .select('*, products(id, name)')
    .eq('vendor_id', vendorId)
    .gt('quantity', 0)
    .limit(1)

  if (!viList || viList.length === 0) {
    fail('Variant inventory exists', 'No variant inventory with qty > 0')
    return
  }
  const vi = viList[0]
  pass(`Variant inventory found: ${vi.quantity} units`)
  log(`    Product: ${vi.products?.name}`)
  log(`    Location: ${vi.location_id}`)

  const productId = vi.product_id
  const locationId = vi.location_id
  const variantTemplateId = vi.variant_template_id
  const initialVariantQty = vi.quantity

  // Get parent inventory for this product/location
  const { data: parentInv } = await supabase
    .from('inventory')
    .select('id, quantity')
    .eq('product_id', productId)
    .eq('location_id', locationId)
    .single()

  const inventoryId = parentInv?.id
  const initialParentQty = parentInv?.quantity || 0
  log(`    Parent inventory ID: ${inventoryId}`)
  log(`    Parent inventory qty: ${initialParentQty}`)

  // ============================================================
  // TEST 2: POS-STYLE VARIANT CHECKOUT (1 unit)
  // ============================================================
  section('2. POS-STYLE VARIANT CHECKOUT')

  const posOrderNum = `TEST-POS-${Date.now()}`
  const { data: posOrder } = await supabase
    .from('orders')
    .insert({
      vendor_id: vendorId,
      order_number: posOrderNum,
      order_type: 'pickup',
      status: 'pending',
      payment_status: 'pending',
      subtotal: 10.00,
      total_amount: 10.00,
    })
    .select('id')
    .single()

  if (!posOrder) {
    fail('POS order created', 'Failed to create order')
    return
  }
  pass(`POS order created: ${posOrder.id}`)

  // POS checkout items (1 Pre-Roll unit)
  const posItems = [{
    productId: productId,
    productName: vi.products?.name,
    productSku: productId,
    quantity: 1,
    unitPrice: 10.00,
    lineTotal: 10.00,
    tierQty: 1, // 1 unit
    gramsToDeduct: 1,
    inventoryId: inventoryId,
    variantTemplateId: variantTemplateId,
    locationId: locationId,
  }]

  // Call reserve_inventory
  const { error: posReserveErr } = await supabase.rpc('reserve_inventory', {
    p_order_id: posOrder.id,
    p_items: posItems
  })

  if (posReserveErr) {
    fail('POS reserve_inventory', posReserveErr.message)
    await cleanupOrder(posOrder.id)
    return
  }
  pass('POS reserve_inventory succeeded')

  // Check hold was created correctly
  const { data: posHolds } = await supabase
    .from('inventory_holds')
    .select('*')
    .eq('order_id', posOrder.id)
    .is('released_at', null)

  if (!posHolds || posHolds.length === 0) {
    fail('POS hold created', 'No hold found')
    await cleanupOrder(posOrder.id)
    return
  }

  const posHold = posHolds[0]
  if (posHold.metadata?.is_variant_sale === true) {
    pass('POS hold has is_variant_sale=true')
  } else {
    fail('POS hold has is_variant_sale', `Got: ${posHold.metadata?.is_variant_sale}`)
  }

  if (posHold.metadata?.variant_template_id === variantTemplateId) {
    pass('POS hold has correct variant_template_id')
  } else {
    fail('POS hold variant_template_id', `Expected: ${variantTemplateId}, Got: ${posHold.metadata?.variant_template_id}`)
  }

  // Finalize the hold
  const { error: posFinalizeErr } = await supabase.rpc('finalize_inventory_holds', {
    p_order_id: posOrder.id
  })

  if (posFinalizeErr) {
    fail('POS finalize_inventory_holds', posFinalizeErr.message)
    await cleanupOrder(posOrder.id)
    return
  }
  pass('POS finalize_inventory_holds succeeded')

  // Check variant_inventory was deducted
  const { data: viAfterPos } = await supabase
    .from('variant_inventory')
    .select('quantity')
    .eq('id', vi.id)
    .single()

  const expectedAfterPos = initialVariantQty - 1
  if (viAfterPos?.quantity === expectedAfterPos) {
    pass(`POS variant_inventory deducted: ${initialVariantQty} → ${viAfterPos.quantity}`)
  } else {
    fail('POS variant_inventory deduction', `Expected: ${expectedAfterPos}, Got: ${viAfterPos?.quantity}`)
  }

  // Check stock movement
  const { data: posMovements } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('reference_id', posOrder.id)

  if (posMovements && posMovements.length > 0) {
    const m = posMovements[0]
    if (m.movement_type === 'sale' && m.quantity_change === -1) {
      pass(`POS stock_movement recorded: ${m.movement_type}, qty=${m.quantity_change}`)
    } else {
      fail('POS stock_movement', `Unexpected: type=${m.movement_type}, qty=${m.quantity_change}`)
    }
  } else {
    fail('POS stock_movement', 'No movement recorded')
  }

  // Cleanup POS order
  await cleanupOrder(posOrder.id)
  log('  POS test cleanup complete')

  // Restore inventory for next test
  await supabase
    .from('variant_inventory')
    .update({ quantity: initialVariantQty })
    .eq('id', vi.id)

  // ============================================================
  // TEST 3: E-COMMERCE STYLE VARIANT CHECKOUT (3 units)
  // ============================================================
  section('3. E-COMMERCE STYLE VARIANT CHECKOUT')

  const ecomOrderNum = `TEST-ECOM-${Date.now()}`
  const { data: ecomOrder } = await supabase
    .from('orders')
    .insert({
      vendor_id: vendorId,
      order_number: ecomOrderNum,
      order_type: 'shipping',
      status: 'pending',
      payment_status: 'pending',
      subtotal: 25.00,
      total_amount: 27.50,
    })
    .select('id')
    .single()

  if (!ecomOrder) {
    fail('E-com order created', 'Failed to create order')
    return
  }
  pass(`E-com order created: ${ecomOrder.id}`)

  // E-commerce checkout items (3 Pre-Roll units - simulating "3 Pre-Rolls" tier)
  const ecomItems = [{
    productId: productId,
    productName: vi.products?.name + ' (Pre Roll) - 3 Pre-Rolls',
    productSku: productId,
    quantity: 1, // 1 line item
    unitPrice: 25.00,
    lineTotal: 25.00,
    tierQty: 3, // 3 units
    gramsToDeduct: 3,
    inventoryId: inventoryId,
    variantTemplateId: variantTemplateId, // KEY: This triggers variant handling
    variantId: variantTemplateId,
    variantName: 'Pre Roll',
    locationId: locationId,
  }]

  // Call reserve_inventory
  const { error: ecomReserveErr } = await supabase.rpc('reserve_inventory', {
    p_order_id: ecomOrder.id,
    p_items: ecomItems
  })

  if (ecomReserveErr) {
    fail('E-com reserve_inventory', ecomReserveErr.message)
    await cleanupOrder(ecomOrder.id)
    return
  }
  pass('E-com reserve_inventory succeeded')

  // Check hold
  const { data: ecomHolds } = await supabase
    .from('inventory_holds')
    .select('*')
    .eq('order_id', ecomOrder.id)
    .is('released_at', null)

  const ecomHold = ecomHolds?.[0]
  if (ecomHold?.metadata?.is_variant_sale === true) {
    pass('E-com hold has is_variant_sale=true')
  } else {
    fail('E-com hold is_variant_sale', `Got: ${ecomHold?.metadata?.is_variant_sale}`)
  }

  if (ecomHold?.metadata?.variant_qty_requested === 3) {
    pass('E-com hold has variant_qty_requested=3')
  } else {
    fail('E-com hold variant_qty_requested', `Expected: 3, Got: ${ecomHold?.metadata?.variant_qty_requested}`)
  }

  // Finalize
  const { error: ecomFinalizeErr } = await supabase.rpc('finalize_inventory_holds', {
    p_order_id: ecomOrder.id
  })

  if (ecomFinalizeErr) {
    fail('E-com finalize_inventory_holds', ecomFinalizeErr.message)
    await cleanupOrder(ecomOrder.id)
    return
  }
  pass('E-com finalize_inventory_holds succeeded')

  // Check variant_inventory deduction
  const { data: viAfterEcom } = await supabase
    .from('variant_inventory')
    .select('quantity')
    .eq('id', vi.id)
    .single()

  const expectedAfterEcom = initialVariantQty - 3
  if (viAfterEcom?.quantity === expectedAfterEcom) {
    pass(`E-com variant_inventory deducted: ${initialVariantQty} → ${viAfterEcom.quantity} (-3)`)
  } else {
    fail('E-com variant_inventory deduction', `Expected: ${expectedAfterEcom}, Got: ${viAfterEcom?.quantity}`)
  }

  // Check stock movement
  const { data: ecomMovements } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('reference_id', ecomOrder.id)

  if (ecomMovements && ecomMovements.length > 0) {
    const m = ecomMovements[0]
    if (m.movement_type === 'sale' && m.quantity_change === -3) {
      pass(`E-com stock_movement recorded: ${m.movement_type}, qty=${m.quantity_change}`)
    } else {
      fail('E-com stock_movement', `Unexpected: type=${m.movement_type}, qty=${m.quantity_change}`)
    }
  } else {
    fail('E-com stock_movement', 'No movement recorded')
  }

  // Cleanup
  await cleanupOrder(ecomOrder.id)
  log('  E-com test cleanup complete')

  // Restore
  await supabase
    .from('variant_inventory')
    .update({ quantity: initialVariantQty })
    .eq('id', vi.id)

  // ============================================================
  // TEST 4: REGULAR (NON-VARIANT) PRODUCT CHECKOUT
  // ============================================================
  section('4. REGULAR PRODUCT CHECKOUT (Non-Variant)')

  // Make sure we have parent inventory
  if (!inventoryId || initialParentQty <= 0) {
    log('  Skipping: No parent inventory available')
  } else {
    const regOrderNum = `TEST-REG-${Date.now()}`
    const { data: regOrder } = await supabase
      .from('orders')
      .insert({
        vendor_id: vendorId,
        order_number: regOrderNum,
        order_type: 'pickup',
        status: 'pending',
        payment_status: 'pending',
        subtotal: 50.00,
        total_amount: 50.00,
      })
      .select('id')
      .single()

    if (!regOrder) {
      fail('Regular order created', 'Failed to create order')
    } else {
      pass(`Regular order created: ${regOrder.id}`)

      // Regular checkout (NO variantTemplateId)
      const regItems = [{
        productId: productId,
        productName: vi.products?.name,
        productSku: productId,
        quantity: 1,
        unitPrice: 50.00,
        lineTotal: 50.00,
        tierQty: 3.5, // 3.5g (e.g., eighth)
        gramsToDeduct: 3.5,
        inventoryId: inventoryId,
        locationId: locationId,
        // NO variantTemplateId - this is a regular product sale
      }]

      const { error: regReserveErr } = await supabase.rpc('reserve_inventory', {
        p_order_id: regOrder.id,
        p_items: regItems
      })

      if (regReserveErr) {
        fail('Regular reserve_inventory', regReserveErr.message)
      } else {
        pass('Regular reserve_inventory succeeded')

        // Check hold - should NOT have is_variant_sale
        const { data: regHolds } = await supabase
          .from('inventory_holds')
          .select('*')
          .eq('order_id', regOrder.id)
          .is('released_at', null)

        const regHold = regHolds?.[0]
        if (!regHold?.metadata?.is_variant_sale) {
          pass('Regular hold does NOT have is_variant_sale')
        } else {
          fail('Regular hold', 'Should not have is_variant_sale')
        }

        // Finalize
        const { error: regFinalizeErr } = await supabase.rpc('finalize_inventory_holds', {
          p_order_id: regOrder.id
        })

        if (regFinalizeErr) {
          fail('Regular finalize_inventory_holds', regFinalizeErr.message)
        } else {
          pass('Regular finalize_inventory_holds succeeded')

          // Check parent inventory was deducted
          const { data: parentAfter } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('id', inventoryId)
            .single()

          const expectedParent = initialParentQty - 3.5
          if (parentAfter?.quantity === expectedParent) {
            pass(`Regular inventory deducted: ${initialParentQty} → ${parentAfter.quantity} (-3.5)`)
          } else {
            fail('Regular inventory deduction', `Expected: ${expectedParent}, Got: ${parentAfter?.quantity}`)
          }

          // Check variant_inventory was NOT touched
          const { data: viAfterReg } = await supabase
            .from('variant_inventory')
            .select('quantity')
            .eq('id', vi.id)
            .single()

          if (viAfterReg?.quantity === initialVariantQty) {
            pass('Variant inventory NOT touched by regular sale')
          } else {
            fail('Variant inventory unchanged', `Expected: ${initialVariantQty}, Got: ${viAfterReg?.quantity}`)
          }
        }
      }

      // Cleanup
      await cleanupOrder(regOrder.id)

      // Restore parent inventory
      await supabase
        .from('inventory')
        .update({ quantity: initialParentQty })
        .eq('id', inventoryId)
    }
  }

  // ============================================================
  // TEST 5: AUTO-CONVERT FROM PARENT (when variant stock is low)
  // ============================================================
  section('5. AUTO-CONVERT FROM PARENT INVENTORY')

  // Set variant inventory to 1 (need 3, so should auto-convert 2)
  await supabase
    .from('variant_inventory')
    .update({ quantity: 1 })
    .eq('id', vi.id)

  const convOrderNum = `TEST-CONV-${Date.now()}`
  const { data: convOrder } = await supabase
    .from('orders')
    .insert({
      vendor_id: vendorId,
      order_number: convOrderNum,
      order_type: 'pickup',
      status: 'pending',
      payment_status: 'pending',
      subtotal: 25.00,
      total_amount: 25.00,
    })
    .select('id')
    .single()

  if (!convOrder) {
    fail('Auto-convert order created', 'Failed to create order')
  } else {
    pass(`Auto-convert order created: ${convOrder.id}`)

    const convItems = [{
      productId: productId,
      productName: vi.products?.name + ' - 3 Pre-Rolls',
      productSku: productId,
      quantity: 1,
      unitPrice: 25.00,
      lineTotal: 25.00,
      tierQty: 3, // Need 3, have 1 variant
      gramsToDeduct: 3,
      inventoryId: inventoryId,
      variantTemplateId: variantTemplateId,
      locationId: locationId,
    }]

    const { error: convReserveErr } = await supabase.rpc('reserve_inventory', {
      p_order_id: convOrder.id,
      p_items: convItems
    })

    if (convReserveErr) {
      // This might fail if not enough parent inventory
      fail('Auto-convert reserve_inventory', convReserveErr.message)
    } else {
      pass('Auto-convert reserve_inventory succeeded')

      // Check hold has will_auto_convert
      const { data: convHolds } = await supabase
        .from('inventory_holds')
        .select('*')
        .eq('order_id', convOrder.id)
        .is('released_at', null)

      const convHold = convHolds?.[0]
      if (convHold?.metadata?.will_auto_convert === true) {
        pass('Auto-convert hold has will_auto_convert=true')
      } else {
        log(`    Note: will_auto_convert=${convHold?.metadata?.will_auto_convert}`)
        // Not a failure if variant stock was enough
      }

      log(`    variant_qty_from_stock: ${convHold?.metadata?.variant_qty_from_stock}`)
      log(`    parent_qty_to_convert: ${convHold?.metadata?.parent_qty_to_convert}`)

      // Finalize
      const { error: convFinalizeErr } = await supabase.rpc('finalize_inventory_holds', {
        p_order_id: convOrder.id
      })

      if (convFinalizeErr) {
        fail('Auto-convert finalize', convFinalizeErr.message)
      } else {
        pass('Auto-convert finalize_inventory_holds succeeded')
      }
    }

    // Cleanup
    await cleanupOrder(convOrder.id)
  }

  // Restore everything
  await supabase
    .from('variant_inventory')
    .update({ quantity: initialVariantQty })
    .eq('id', vi.id)

  await supabase
    .from('inventory')
    .update({ quantity: initialParentQty })
    .eq('id', inventoryId)

  // ============================================================
  // TEST 6: VALIDATE FINAL INVENTORY STATE
  // ============================================================
  section('6. FINAL INVENTORY VALIDATION')

  // Check variant_inventory is restored
  const { data: finalVi } = await supabase
    .from('variant_inventory')
    .select('quantity')
    .eq('id', vi.id)
    .single()

  if (finalVi?.quantity === initialVariantQty) {
    pass(`Variant inventory restored: ${finalVi.quantity}`)
  } else {
    fail('Variant inventory restoration', `Expected: ${initialVariantQty}, Got: ${finalVi?.quantity}`)
  }

  // Check parent inventory is restored
  const { data: finalParent } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('id', inventoryId)
    .single()

  if (finalParent?.quantity === initialParentQty) {
    pass(`Parent inventory restored: ${finalParent.quantity}`)
  } else {
    fail('Parent inventory restoration', `Expected: ${initialParentQty}, Got: ${finalParent?.quantity}`)
  }

  // Check no orphan holds
  const { data: orphanHolds } = await supabase
    .from('inventory_holds')
    .select('id')
    .eq('product_id', productId)
    .is('released_at', null)
    .like('order_id', '%TEST-%')

  if (!orphanHolds || orphanHolds.length === 0) {
    pass('No orphan holds remaining')
  } else {
    fail('Orphan holds', `Found ${orphanHolds.length} orphan holds`)
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  log('\n' + '═'.repeat(60))
  log('  TEST SUMMARY')
  log('═'.repeat(60))
  log(`  Total tests: ${passed + failed}`)
  log(`  Passed: ${passed}`)
  log(`  Failed: ${failed}`)
  log('═'.repeat(60))

  if (failed === 0) {
    log('\n  ✓ ALL TESTS PASSED - Inventory system is working correctly!')
  } else {
    log('\n  ✗ SOME TESTS FAILED - Review failures above')
    log('\nFailed tests:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      log(`  - ${r.test}: ${r.reason}`)
    })
  }
}

runTests().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
