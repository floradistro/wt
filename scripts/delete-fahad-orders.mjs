import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteFahadOrders() {
  console.log('Finding Fahad Khan customer account...\n');

  // Find customer with name Fahad Khan
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, vendor_id')
    .ilike('first_name', 'fahad');

  if (custError) {
    console.error('Error finding customers:', custError);
    return;
  }

  // Filter to Fahad Khan
  const targetCustomers = customers.filter(c => {
    const first = (c.first_name || '').toLowerCase().trim();
    const last = (c.last_name || '').toLowerCase().trim();
    return first === 'fahad' && last === 'khan';
  });

  console.log(`Found ${targetCustomers.length} Fahad Khan account(s):`);
  targetCustomers.forEach(c => {
    console.log(`  - ${c.id}: ${c.first_name} ${c.last_name} (${c.email}) - vendor: ${c.vendor_id}`);
  });

  if (targetCustomers.length === 0) {
    console.log('\nNo Fahad Khan accounts found.');
    return;
  }

  const customerIds = targetCustomers.map(c => c.id);

  // Find all orders for these customers
  console.log('\nFinding orders for Fahad Khan...');
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
    const cust = targetCustomers.find(c => c.id === o.customer_id);
    console.log(`  - ${o.order_number}: $${(o.total_amount || 0).toFixed(2)} - ${o.status} - ${new Date(o.created_at).toLocaleDateString()}`);
  });

  if (orders.length === 0) {
    console.log('\nNo orders found for Fahad Khan.');
    return;
  }

  const orderIds = orders.map(o => o.id);

  // Delete order_locations first (if exists)
  console.log('\nDeleting order locations...');
  const { error: locError } = await supabase
    .from('order_locations')
    .delete()
    .in('order_id', orderIds);

  if (locError && !locError.message.includes('does not exist')) {
    console.error('Error deleting order locations:', locError);
  } else {
    console.log('Order locations deleted.');
  }

  // Delete order items
  console.log('Deleting order items...');
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

  if (statusError && !statusError.message.includes('does not exist')) {
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

  console.log(`\n✅ Successfully deleted ${orders.length} orders for Fahad Khan!`);
}

deleteFahadOrders().catch(console.error);
