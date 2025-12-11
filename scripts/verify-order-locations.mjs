#!/usr/bin/env node
/**
 * Verify order_locations table is populated correctly after routing
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function verify() {
  const orderId = '3e674644-6f2e-4e95-82e3-cd4452368ee2'

  console.log('📋 Verifying order_locations for order', orderId)

  const { data: orderLocs, error } = await supabase
    .from('order_locations')
    .select(`
      id,
      order_id,
      location_id,
      item_count,
      total_quantity,
      fulfillment_status,
      locations (name)
    `)
    .eq('order_id', orderId)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\norder_locations entries:')
  for (const loc of orderLocs) {
    console.log(`  - ${loc.locations?.name}: ${loc.item_count} items, qty: ${loc.total_quantity}, status: ${loc.fulfillment_status}`)
  }

  // Also check order_items
  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, quantity, location_id, order_type, locations (name), products (name)')
    .eq('order_id', orderId)

  console.log('\norder_items:')
  for (const item of items) {
    console.log(`  - ${item.products?.name}: ${item.locations?.name} (${item.order_type})`)
  }

  console.log('\n✅ Verification complete')
}

verify().catch(console.error)
