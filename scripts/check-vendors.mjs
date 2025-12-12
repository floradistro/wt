import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function check() {
  // Total counts without vendor filter
  const { count: totalOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const { count: totalCustomers } = await supabase.from('customers').select('*', { count: 'exact', head: true });
  console.log('Total orders (all vendors):', totalOrders);
  console.log('Total customers (all vendors):', totalCustomers);

  // Check orders with NULL vendor_id
  const { count: nullVendorOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).is('vendor_id', null);
  console.log('Orders with NULL vendor_id:', nullVendorOrders);

  // Check distinct vendor_ids in orders (paginated)
  const vendorCounts = {};
  let page = 0;
  while (true) {
    const { data } = await supabase.from('orders').select('vendor_id').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(o => {
      const vid = o.vendor_id || 'NULL';
      vendorCounts[vid] = (vendorCounts[vid] || 0) + 1;
    });
    if (data.length < 1000) break;
    page++;
  }
  console.log('\nOrders by vendor_id:');
  Object.entries(vendorCounts).sort((a, b) => b[1] - a[1]).forEach(([vid, count]) => {
    console.log('  ', vid, ':', count);
  });

  // Get vendor names
  const { data: vendors } = await supabase.from('vendors').select('id, store_name');
  const vendorNames = {};
  vendors?.forEach(v => vendorNames[v.id] = v.store_name);

  console.log('\nVendor names:');
  Object.keys(vendorCounts).forEach(vid => {
    console.log('  ', vid, '->', vendorNames[vid] || 'UNKNOWN');
  });

  // Same for customers
  const customerCounts = {};
  page = 0;
  while (true) {
    const { data } = await supabase.from('customers').select('vendor_id').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => {
      const vid = c.vendor_id || 'NULL';
      customerCounts[vid] = (customerCounts[vid] || 0) + 1;
    });
    if (data.length < 1000) break;
    page++;
  }
  console.log('\nCustomers by vendor_id:');
  Object.entries(customerCounts).sort((a, b) => b[1] - a[1]).forEach(([vid, count]) => {
    console.log('  ', vid, '(', vendorNames[vid] || 'UNKNOWN', '):', count);
  });
}

check();
