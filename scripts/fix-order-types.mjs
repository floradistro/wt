import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function fixOrderTypes() {
  const dec5 = '2025-12-05T00:00:00.000Z';

  // Check how many pickup orders exist before Dec 5
  const { data: pickupOrders } = await supabase
    .from('orders')
    .select('id, order_number, order_type, created_at')
    .eq('vendor_id', vendorId)
    .eq('order_type', 'pickup')
    .lt('created_at', dec5);

  console.log('Pickup orders before Dec 5:', pickupOrders?.length || 0);

  if (pickupOrders?.length > 0) {
    console.log('\nSample orders to be updated:');
    pickupOrders.slice(0, 5).forEach(o => {
      console.log('  ' + o.order_number + ' | ' + o.order_type + ' | ' + new Date(o.created_at).toLocaleDateString());
    });

    // Update them to walk_in
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ order_type: 'walk_in' })
      .eq('vendor_id', vendorId)
      .eq('order_type', 'pickup')
      .lt('created_at', dec5);

    if (updateErr) {
      console.log('\nError updating:', updateErr.message);
    } else {
      console.log('\nUpdated ' + pickupOrders.length + ' orders from pickup to walk_in');
    }
  }

  // Verify
  const { data: verify } = await supabase
    .from('orders')
    .select('order_type')
    .eq('vendor_id', vendorId)
    .eq('order_type', 'pickup')
    .lt('created_at', dec5);

  console.log('\nPickup orders before Dec 5 after fix:', verify?.length || 0);

  // Show new breakdown
  console.log('\n=== UPDATED ORDER TYPE BREAKDOWN (Last 30 Days) ===');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: allOrders } = await supabase
    .from('orders')
    .select('order_type, total_amount')
    .eq('vendor_id', vendorId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const totalRevenue = allOrders?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0;

  const byType = {};
  allOrders?.forEach(o => {
    const t = o.order_type || 'unknown';
    if (!byType[t]) byType[t] = { count: 0, revenue: 0 };
    byType[t].count++;
    byType[t].revenue += (o.total_amount || 0);
  });

  Object.entries(byType).sort((a, b) => b[1].revenue - a[1].revenue).forEach(([t, d]) => {
    const pct = ((d.revenue / totalRevenue) * 100).toFixed(1);
    console.log('  ' + t.padEnd(12) + ': ' + d.count.toString().padStart(5) + ' orders | $' + d.revenue.toFixed(2).padStart(10) + ' | ' + pct + '%');
  });
}

fixOrderTypes().catch(console.error);
