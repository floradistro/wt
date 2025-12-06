import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const FLORA_VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function deleteTestOrders() {
  console.log('Finding test orders created from dev tools (is_test_order: true in metadata)...\n');

  // Find orders with is_test_order in metadata
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, metadata, status, created_at')
    .eq('vendor_id', FLORA_VENDOR_ID)
    .not('metadata', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter for test orders
  const testOrders = (orders || []).filter(o => o.metadata?.is_test_order === true);

  console.log(`Found ${testOrders.length} test orders:`);
  testOrders.forEach(o => {
    const name = o.metadata?.customer_name || 'Unknown';
    console.log(`  - ${o.order_number}: "${name}" - ${o.status} - ${new Date(o.created_at).toLocaleDateString()}`);
  });

  if (testOrders.length === 0) {
    console.log('\nNo test orders found.');

    // Also try finding TEST- prefix orders
    console.log('\nLooking for orders with TEST- prefix...');
    const { data: testPrefixOrders } = await supabase
      .from('orders')
      .select('id, order_number, metadata, status')
      .eq('vendor_id', FLORA_VENDOR_ID)
      .ilike('order_number', 'TEST-%');

    console.log(`Found ${testPrefixOrders?.length || 0} TEST- prefix orders`);
    testPrefixOrders?.forEach(o => console.log(`  - ${o.order_number}: ${o.status}`));
    return;
  }

  const orderIds = testOrders.map(o => o.id);

  console.log('\nDeleting order items...');
  const { error: itemsErr } = await supabase.from('order_items').delete().in('order_id', orderIds);
  if (itemsErr) console.error('Items error:', itemsErr);

  console.log('Deleting status history...');
  await supabase.from('order_status_history').delete().in('order_id', orderIds);

  console.log('Deleting orders...');
  const { error: delErr } = await supabase.from('orders').delete().in('id', orderIds);

  if (delErr) {
    console.error('Delete error:', delErr);
  } else {
    console.log(`\n✅ Deleted ${testOrders.length} test orders!`);
  }
}

deleteTestOrders().catch(console.error);
