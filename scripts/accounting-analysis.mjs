import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function accountingAnalysis() {
  // Get ALL orders with pagination
  let allOrders = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status, order_type, total_amount, subtotal, tax_amount, discount_amount, metadata')
      .eq('vendor_id', vendorId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) { console.error(error); return; }
    if (!data || data.length === 0) break;
    allOrders = [...allOrders, ...data];
    if (data.length < pageSize) break;
    page++;
  }

  console.log('=== APPLE-STYLE ACCOUNTING ANALYSIS ===\n');
  console.log('Total orders in system:', allOrders.length);

  // Show every unique combination of order_type + status + payment_status
  console.log('\n=== ALL STATUS COMBINATIONS ===');
  const combos = {};
  for (const o of allOrders) {
    const key = `${o.order_type} | ${o.status} | ${o.payment_status}`;
    if (!combos[key]) combos[key] = { count: 0, revenue: 0 };
    combos[key].count++;
    combos[key].revenue += parseFloat(o.total_amount || 0);
  }

  console.log('order_type | status | payment_status → count (revenue)');
  console.log('─'.repeat(70));
  for (const [key, data] of Object.entries(combos).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`${key} → ${data.count} ($${data.revenue.toFixed(2)})`);
  }

  // Now define what should count as RECOGNIZED revenue
  // Rule: payment_status = 'paid' AND status IN ('completed', 'delivered')
  console.log('\n\n=== REVENUE RECOGNITION RULES ===');
  console.log('✅ RECOGNIZED: payment_status="paid" AND status IN ("completed", "delivered")');
  console.log('⏳ DEFERRED: payment_status="paid" AND status IN ("shipped", "ready", "ready_to_ship", "pending")');
  console.log('❌ EXCLUDED: payment_status IN ("failed", "pending") OR status="cancelled"');

  let recognizedRevenue = 0;
  let recognizedOrders = 0;
  let recognizedSubtotal = 0;
  let recognizedTax = 0;
  let recognizedDiscounts = 0;

  let deferredRevenue = 0;
  let deferredOrders = 0;

  let excludedRevenue = 0;
  let excludedOrders = 0;

  for (const o of allOrders) {
    const isPaid = o.payment_status === 'paid';
    const isRecognized = isPaid && (o.status === 'completed' || o.status === 'delivered');
    const isDeferred = isPaid && ['shipped', 'ready', 'ready_to_ship', 'pending'].includes(o.status);

    const totalDiscounts = parseFloat(o.discount_amount || 0)
      + parseFloat(o.metadata?.campaign_discount_amount || 0)
      + parseFloat(o.metadata?.loyalty_discount_amount || 0);

    if (isRecognized) {
      recognizedRevenue += parseFloat(o.total_amount || 0);
      recognizedSubtotal += parseFloat(o.subtotal || 0);
      recognizedTax += parseFloat(o.tax_amount || 0);
      recognizedDiscounts += totalDiscounts;
      recognizedOrders++;
    } else if (isDeferred) {
      deferredRevenue += parseFloat(o.total_amount || 0);
      deferredOrders++;
    } else {
      excludedRevenue += parseFloat(o.total_amount || 0);
      excludedOrders++;
    }
  }

  console.log('\n\n=== APPLE-STYLE P&L METRICS ===');
  console.log('─'.repeat(50));
  console.log(`Gross Sales (subtotal):        $${recognizedSubtotal.toFixed(2)}`);
  console.log(`Less: Discounts & Promos:     -$${recognizedDiscounts.toFixed(2)}`);
  console.log(`                              ─────────────`);
  console.log(`Net Sales:                     $${(recognizedSubtotal - recognizedDiscounts).toFixed(2)}`);
  console.log(`Tax Collected:                 $${recognizedTax.toFixed(2)}`);
  console.log(`                              ─────────────`);
  console.log(`RECOGNIZED REVENUE:            $${recognizedRevenue.toFixed(2)}`);
  console.log(`(${recognizedOrders} orders)`);

  console.log('\n=== BALANCE SHEET ITEMS ===');
  console.log('─'.repeat(50));
  console.log(`Deferred Revenue (liability):  $${deferredRevenue.toFixed(2)}`);
  console.log(`(${deferredOrders} orders in transit/pending pickup)`);

  console.log('\n=== EXCLUDED FROM FINANCIALS ===');
  console.log('─'.repeat(50));
  console.log(`Cancelled/Failed Orders:       $${excludedRevenue.toFixed(2)}`);
  console.log(`(${excludedOrders} orders)`);

  console.log('\n\n=== VERIFICATION ===');
  const total = recognizedRevenue + deferredRevenue + excludedRevenue;
  console.log(`Recognized + Deferred + Excluded = $${total.toFixed(2)}`);
  console.log(`All Orders Total = $${allOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0).toFixed(2)}`);

  // What the dashboard SHOULD show
  console.log('\n\n=== DASHBOARD SHOULD DISPLAY ===');
  console.log('─'.repeat(50));
  console.log('METRIC CARDS:');
  console.log(`  Total Revenue:     $${recognizedRevenue.toFixed(2)} (recognized only)`);
  console.log(`  Gross Sales:       $${recognizedSubtotal.toFixed(2)} (before discounts)`);
  console.log(`  Discounts Given:   $${recognizedDiscounts.toFixed(2)}`);
  console.log(`  Tax Collected:     $${recognizedTax.toFixed(2)}`);
  console.log(`  Total Orders:      ${recognizedOrders}`);
  console.log(`  Avg Order Value:   $${(recognizedRevenue / recognizedOrders).toFixed(2)}`);
  console.log(`  Deferred Revenue:  $${deferredRevenue.toFixed(2)} (${deferredOrders} orders pending)`);
}

accountingAnalysis();
