import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function checkLocations() {
  // Get locations with tax info
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, city, state, tax_rate, is_active')
    .eq('vendor_id', vendorId);

  console.log('=== LOCATIONS ===');
  for (const loc of locations || []) {
    console.log(`${loc.name} (${loc.city}, ${loc.state})`);
    console.log(`  Tax Rate: ${loc.tax_rate ? (loc.tax_rate * 100).toFixed(2) + '%' : 'Not set'}`);
    console.log(`  Active: ${loc.is_active}`);
  }

  // Get tax breakdown by location from orders
  const pageSize = 1000;
  let allOrders = [];
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('pickup_location_id, tax_amount, total_amount, subtotal, order_type, shipping_state')
      .eq('vendor_id', vendorId)
      .eq('payment_status', 'paid')
      .neq('status', 'cancelled')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;
    allOrders = [...allOrders, ...data];
    if (data.length < pageSize) break;
    page++;
  }

  // Aggregate by location
  const byLocation = {};
  const byOrderType = {};

  for (const o of allOrders) {
    // By location
    const locId = o.pickup_location_id || 'shipping_orders';
    if (!byLocation[locId]) byLocation[locId] = { orders: 0, tax: 0, revenue: 0, subtotal: 0 };
    byLocation[locId].orders++;
    byLocation[locId].tax += parseFloat(o.tax_amount || 0);
    byLocation[locId].revenue += parseFloat(o.total_amount || 0);
    byLocation[locId].subtotal += parseFloat(o.subtotal || 0);

    // By order type
    const type = o.order_type || 'unknown';
    if (!byOrderType[type]) byOrderType[type] = { orders: 0, tax: 0, revenue: 0 };
    byOrderType[type].orders++;
    byOrderType[type].tax += parseFloat(o.tax_amount || 0);
    byOrderType[type].revenue += parseFloat(o.total_amount || 0);
  }

  console.log('\n=== TAX BY LOCATION ===');
  for (const [locId, data] of Object.entries(byLocation)) {
    const loc = locations?.find(l => l.id === locId);
    const name = loc?.name || (locId === 'shipping_orders' ? 'E-Commerce (Shipping)' : locId.substring(0,8));
    const effectiveRate = data.subtotal > 0 ? (data.tax / data.subtotal * 100).toFixed(2) : 0;
    console.log(`\n${name}:`);
    console.log(`  Orders: ${data.orders}`);
    console.log(`  Subtotal: $${data.subtotal.toFixed(2)}`);
    console.log(`  Tax Collected: $${data.tax.toFixed(2)}`);
    console.log(`  Effective Tax Rate: ${effectiveRate}%`);
    console.log(`  Total Revenue: $${data.revenue.toFixed(2)}`);
  }

  console.log('\n=== TAX BY ORDER TYPE ===');
  for (const [type, data] of Object.entries(byOrderType)) {
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  Orders: ${data.orders}`);
    console.log(`  Tax Collected: $${data.tax.toFixed(2)}`);
    console.log(`  Revenue: $${data.revenue.toFixed(2)}`);
  }

  // Summary
  const totalTax = Object.values(byLocation).reduce((sum, d) => sum + d.tax, 0);
  const totalRevenue = Object.values(byLocation).reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = Object.values(byLocation).reduce((sum, d) => sum + d.orders, 0);

  console.log('\n=== SUMMARY ===');
  console.log(`Total Orders: ${totalOrders}`);
  console.log(`Total Tax Collected: $${totalTax.toFixed(2)}`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
}

checkLocations();
