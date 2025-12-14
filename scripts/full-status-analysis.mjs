import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function fullAnalysis() {
  // Get ALL orders with pagination
  let allOrders = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status, fulfillment_status, order_type, total_amount, subtotal, discount_amount, tax_amount, metadata, created_at')
      .eq('vendor_id', vendorId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) { console.error(error); return; }
    if (!data || data.length === 0) break;

    allOrders = [...allOrders, ...data];
    if (data.length < pageSize) break;
    page++;
  }

  console.log('=== FULL ORDER STATUS ANALYSIS ===');
  console.log('Total orders in database:', allOrders.length);

  // Group by order_type first
  const byOrderType = {};
  for (const o of allOrders) {
    const type = o.order_type || 'unknown';
    if (!byOrderType[type]) byOrderType[type] = [];
    byOrderType[type].push(o);
  }

  console.log('\n=== ORDERS BY TYPE ===');
  for (const [type, orders] of Object.entries(byOrderType)) {
    console.log(`\n--- ${type.toUpperCase()} (${orders.length} orders) ---`);

    // Count statuses within this type
    const statusCounts = {};
    const paymentCounts = {};
    let totalRev = 0;
    let totalDiscount = 0;
    let totalCampaignDiscount = 0;

    for (const o of orders) {
      const s = o.status || 'null';
      const p = o.payment_status || 'null';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
      paymentCounts[p] = (paymentCounts[p] || 0) + 1;
      totalRev += parseFloat(o.total_amount || 0);
      totalDiscount += parseFloat(o.discount_amount || 0);
      totalCampaignDiscount += parseFloat(o.metadata?.campaign_discount_amount || 0);
    }

    console.log('  Statuses:');
    for (const [s, c] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${s}: ${c}`);
    }

    console.log('  Payment Status:');
    for (const [p, c] of Object.entries(paymentCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${p}: ${c}`);
    }

    console.log(`  Revenue: $${totalRev.toFixed(2)}`);
    console.log(`  Discount (discount_amount): $${totalDiscount.toFixed(2)}`);
    console.log(`  Discount (campaign in metadata): $${totalCampaignDiscount.toFixed(2)}`);
  }

  // For Apple accounting standards - what should count as "recognized revenue"?
  console.log('\n\n=== ACCOUNTING ANALYSIS (Apple Standards / ASC 606) ===');
  console.log('Revenue should be recognized when goods are DELIVERED, not just paid.');

  // For walk-in: completed = delivered immediately
  // For shipping: delivered = delivered
  // For pickup: completed = picked up

  const recognizedStatuses = {
    walk_in: ['completed'],
    pickup: ['completed'],
    shipping: ['delivered', 'completed'],
    delivery: ['delivered', 'completed']
  };

  let recognizedRevenue = 0;
  let unrecognizedRevenue = 0;
  const unrecognizedOrders = [];

  for (const o of allOrders) {
    if (o.status === 'cancelled') continue; // Skip cancelled
    if (o.payment_status !== 'paid') continue; // Must be paid

    const type = o.order_type || 'walk_in';
    const validStatuses = recognizedStatuses[type] || ['completed'];

    if (validStatuses.includes(o.status)) {
      recognizedRevenue += parseFloat(o.total_amount || 0);
    } else {
      unrecognizedRevenue += parseFloat(o.total_amount || 0);
      unrecognizedOrders.push(o);
    }
  }

  console.log('\nPaid, Non-Cancelled Orders:');
  console.log(`  Recognized Revenue (delivered/completed): $${recognizedRevenue.toFixed(2)}`);
  console.log(`  Unrecognized Revenue (in transit/pending): $${unrecognizedRevenue.toFixed(2)}`);
  console.log(`  Orders pending delivery: ${unrecognizedOrders.length}`);

  if (unrecognizedOrders.length > 0) {
    console.log('\n  Unrecognized orders by status:');
    const unrecByStatus = {};
    for (const o of unrecognizedOrders) {
      const key = `${o.order_type}/${o.status}`;
      if (!unrecByStatus[key]) unrecByStatus[key] = { count: 0, revenue: 0 };
      unrecByStatus[key].count++;
      unrecByStatus[key].revenue += parseFloat(o.total_amount || 0);
    }
    for (const [key, data] of Object.entries(unrecByStatus).sort((a, b) => b[1].revenue - a[1].revenue)) {
      console.log(`    ${key}: ${data.count} orders, $${data.revenue.toFixed(2)}`);
    }
  }

  // Dashboard comparison
  console.log('\n\n=== DASHBOARD COMPARISON ===');
  const paidOrders = allOrders.filter(o => o.payment_status === 'paid');
  const dashboardRevenue = paidOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

  console.log('Dashboard currently shows (payment_status=paid):');
  console.log(`  Orders: ${paidOrders.length}`);
  console.log(`  Revenue: $${dashboardRevenue.toFixed(2)}`);

  console.log('\nProper accounting should show:');
  console.log(`  Recognized Revenue: $${recognizedRevenue.toFixed(2)}`);
  console.log(`  Deferred Revenue (in transit): $${unrecognizedRevenue.toFixed(2)}`);
  console.log(`  Difference: $${(dashboardRevenue - recognizedRevenue).toFixed(2)}`);

  // Campaign discount analysis
  console.log('\n\n=== DISCOUNT TRACKING ===');
  let totalDiscountField = 0;
  let totalCampaignMeta = 0;
  let totalLoyaltyMeta = 0;

  for (const o of allOrders) {
    totalDiscountField += parseFloat(o.discount_amount || 0);
    totalCampaignMeta += parseFloat(o.metadata?.campaign_discount_amount || 0);
    totalLoyaltyMeta += parseFloat(o.metadata?.loyalty_discount_amount || 0);
  }

  console.log(`discount_amount field: $${totalDiscountField.toFixed(2)}`);
  console.log(`metadata.campaign_discount_amount: $${totalCampaignMeta.toFixed(2)}`);
  console.log(`metadata.loyalty_discount_amount: $${totalLoyaltyMeta.toFixed(2)}`);
  console.log(`TOTAL DISCOUNTS: $${(totalDiscountField + totalCampaignMeta + totalLoyaltyMeta).toFixed(2)}`);

  console.log('\n⚠️  ISSUE: Dashboard is NOT tracking campaign/loyalty discounts from metadata!');
}

fullAnalysis();
