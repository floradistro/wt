import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function cleanupTestData() {
  console.log('=== CLEANING UP TEST DATA ===\n');

  // 1. Find and delete DEV/TEST orders
  console.log('Step 1: Deleting DEV/TEST orders...');

  const { data: devOrders } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('vendor_id', vendorId)
    .or('order_number.ilike.DEV-%,order_number.ilike.TEST-%,payment_method.eq.dev_test');

  console.log('  Found ' + (devOrders?.length || 0) + ' DEV/TEST orders');

  if (devOrders?.length > 0) {
    const devOrderIds = devOrders.map(o => o.id);

    // Delete order_items first
    await supabase.from('order_items').delete().in('order_id', devOrderIds);

    // Delete orders
    const { error: ordersErr } = await supabase.from('orders').delete().in('id', devOrderIds);
    if (ordersErr) console.log('  Error:', ordersErr.message);
    else console.log('  Deleted ' + devOrders.length + ' DEV/TEST orders');
  }

  // 2. Find test customer accounts
  console.log('\nStep 2: Finding test customer accounts...');

  const testEmails = [
    'haulexf@gmail.com', // Dill Pickles
    'salisbury@floradistro.com', // Johnny Walker
    'test-resend-flow@example.com',
    'finaltest@vendor.com',
    'fulltest@vendor.com',
    'supatest@vendor.com',
    'fsfaf@gmail.com', // Fahad Farooq Khan test
    'klaviyo-test-events@smile.io',
  ];

  const testNames = [
    { first: 'Dill', last: 'Pickles' },
    { first: 'Johnny', last: 'Walker' },
    { first: 'test', last: 'testies' },
    { first: 'Test', last: 'Customer 1' },
    { first: 'Test', last: 'Customer 2' },
    { first: 'Test', last: 'Customer 3' },
    { first: 'Test', last: 'Customer 4' },
    { first: 'Test', last: 'Customer 5' },
    { first: 'Fahad', last: '65' },
    { first: 'CASSIDY', last: 'CARTER' },
    { first: 'Test', last: 'Buddy' },
    { first: 'Test', last: 'User' },
    { first: 'Test', last: 'Developer' },
    { first: 'Test', last: 'Test1' },
    { first: 'Test', last: 'Test4' },
    { first: 'Test', last: 'Case3' },
    { first: 'Testing', last: 'Dev' },
    { first: 'Testing3', last: 'Testing' },
    { first: 'Final', last: 'Test Store' },
    { first: 'Full', last: 'Test Vendor' },
    { first: 'Supabase', last: 'Test Vendor' },
    { first: 'Lumina', last: 'Studio' },
    { first: 'It', last: 'Prof' },
  ];

  let testCustomerIds = [];

  // Get by email
  for (const email of testEmails) {
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('vendor_id', vendorId)
      .eq('email', email);
    if (data?.length > 0) {
      testCustomerIds.push(...data.map(c => c.id));
      data.forEach(c => console.log('  Found: ' + c.first_name + ' ' + c.last_name + ' (' + c.email + ')'));
    }
  }

  // Get by name
  for (const name of testNames) {
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('vendor_id', vendorId)
      .ilike('first_name', name.first)
      .ilike('last_name', name.last);
    if (data?.length > 0) {
      data.forEach(c => {
        if (!testCustomerIds.includes(c.id)) {
          testCustomerIds.push(c.id);
          console.log('  Found: ' + c.first_name + ' ' + c.last_name + ' (' + (c.email || 'no email') + ')');
        }
      });
    }
  }

  // Fahad Khan with null email
  const { data: fahadNulls } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, total_orders')
    .eq('vendor_id', vendorId)
    .eq('first_name', 'Fahad')
    .eq('last_name', 'Khan')
    .is('email', null);

  fahadNulls?.forEach(c => {
    if (!testCustomerIds.includes(c.id)) {
      testCustomerIds.push(c.id);
      console.log('  Found: Fahad Khan (no email)');
    }
  });

  console.log('\n  Total test customers: ' + testCustomerIds.length);

  // 3. Delete orders from test customers
  console.log('\nStep 3: Deleting orders from test customers...');

  if (testCustomerIds.length > 0) {
    const { data: testOrders } = await supabase
      .from('orders')
      .select('id')
      .in('customer_id', testCustomerIds);

    if (testOrders?.length > 0) {
      const testOrderIds = testOrders.map(o => o.id);
      await supabase.from('order_items').delete().in('order_id', testOrderIds);
      await supabase.from('orders').delete().in('id', testOrderIds);
      console.log('  Deleted ' + testOrders.length + ' orders');
    } else {
      console.log('  No orders to delete');
    }
  }

  // 4. Delete test customers
  console.log('\nStep 4: Deleting test customer accounts...');

  if (testCustomerIds.length > 0) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .in('id', testCustomerIds);

    if (error) console.log('  Error:', error.message);
    else console.log('  Deleted ' + testCustomerIds.length + ' test customers');
  }

  // 5. Summary
  console.log('\n=== CLEANUP COMPLETE ===');

  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', vendorId);

  const { count: customerCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_id', vendorId);

  console.log('\nRemaining orders: ' + orderCount);
  console.log('Remaining customers: ' + customerCount);
}

cleanupTestData().catch(console.error);
