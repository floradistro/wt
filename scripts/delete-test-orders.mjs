import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteTestOrders() {
  console.log('Finding test customer accounts...\n');

  // Find customers with exact test names
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, vendor_id')
    .or('first_name.ilike.jessica,first_name.ilike.robert,first_name.ilike.thomas');

  if (custError) {
    console.error('Error finding customers:', custError);
    return;
  }

  // Filter to exact matches
  const testCustomers = customers.filter(c => {
    const first = (c.first_name || '').toLowerCase().trim();
    const last = (c.last_name || '').toLowerCase().trim();
    return (
      (first === 'jessica' && last === 'miller') ||
      (first === 'robert' && last === 'brown') ||
      (first === 'thomas' && last === 'thomas')
    );
  });

  console.log(`Found ${testCustomers.length} test customer accounts:`);
  testCustomers.forEach(c => {
    console.log(`  - ${c.id}: ${c.first_name} ${c.last_name} (${c.email}) - vendor: ${c.vendor_id}`);
  });

  if (testCustomers.length === 0) {
    console.log('\nNo test accounts found. Checking all customers for similar names...');

    // Debug: show all customers with these first names
    const debugCusts = customers.filter(c => {
      const first = (c.first_name || '').toLowerCase();
      return first.includes('jessica') || first.includes('robert') || first.includes('thomas');
    }).slice(0, 20);

    debugCusts.forEach(c => {
      console.log(`  Debug: "${c.first_name}" "${c.last_name}"`);
    });
    return;
  }

  const customerIds = testCustomers.map(c => c.id);

  // Find all orders for these customers
  console.log('\nFinding orders for these customers...');
  const { data: orders, error: ordError } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, total_amount, created_at, status')
    .in('customer_id', customerIds);

  if (ordError) {
    console.error('Error finding orders:', ordError);
    return;
  }

  console.log(`Found ${orders.length} orders to delete:`);
  orders.forEach(o => {
    const cust = testCustomers.find(c => c.id === o.customer_id);
    console.log(`  - ${o.order_number}: ${cust?.first_name} ${cust?.last_name} - $${((o.total_amount || 0) / 100).toFixed(2)} - ${o.status}`);
  });

  if (orders.length === 0) {
    console.log('\nNo orders found for these test accounts.');
    return;
  }

  const orderIds = orders.map(o => o.id);

  // Delete order items first
  console.log('\nDeleting order items...');
  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .in('order_id', orderIds);

  if (itemsError) {
    console.error('Error deleting order items:', itemsError);
  } else {
    console.log('Order items deleted.');
  }

  // Delete status history
  console.log('Deleting status history...');
  const { error: statusError } = await supabase
    .from('order_status_history')
    .delete()
    .in('order_id', orderIds);

  if (statusError) {
    console.error('Error deleting status history:', statusError);
  } else {
    console.log('Status history deleted.');
  }

  // Delete orders
  console.log('Deleting orders...');
  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .in('id', orderIds);

  if (deleteError) {
    console.error('Error deleting orders:', deleteError);
    return;
  }

  console.log(`\n✅ Successfully deleted ${orders.length} test orders!`);
}

deleteTestOrders().catch(console.error);
