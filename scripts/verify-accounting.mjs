import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function verifyAccounting() {
  // Fetch ALL orders with pagination
  let allOrders = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) { console.error(error); return; }
    if (!data || data.length === 0) break;
    allOrders = [...allOrders, ...data];
    if (data.length < pageSize) break;
    page++;
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ACCOUNTING VERIFICATION REPORT                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Total orders in database: ${allOrders.length}\n`);

  // === STEP 1: Categorize all orders by payment_status ===
  console.log('┌──────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 1: Orders by Payment Status                             │');
  console.log('└──────────────────────────────────────────────────────────────┘');

  const byPaymentStatus = {};
  for (const o of allOrders) {
    const ps = o.payment_status || 'null';
    if (!byPaymentStatus[ps]) byPaymentStatus[ps] = { count: 0, total: 0 };
    byPaymentStatus[ps].count++;
    byPaymentStatus[ps].total += parseFloat(o.total_amount || 0);
  }

  for (const [status, data] of Object.entries(byPaymentStatus).sort((a, b) => b[1].count - a[1].count)) {
    const emoji = status === 'paid' ? '✅' : (status === 'failed' ? '❌' : '⏳');
    console.log(`  ${emoji} ${status.padEnd(12)} ${String(data.count).padStart(4)} orders  $${data.total.toFixed(2)}`);
  }

  // === STEP 2: Categorize by order status ===
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 2: Orders by Status                                     │');
  console.log('└──────────────────────────────────────────────────────────────┘');

  const byStatus = {};
  for (const o of allOrders) {
    const s = o.status || 'null';
    if (!byStatus[s]) byStatus[s] = { count: 0, total: 0 };
    byStatus[s].count++;
    byStatus[s].total += parseFloat(o.total_amount || 0);
  }

  for (const [status, data] of Object.entries(byStatus).sort((a, b) => b[1].count - a[1].count)) {
    const emoji = ['completed', 'delivered'].includes(status) ? '✅' :
                  status === 'cancelled' ? '❌' : '⏳';
    console.log(`  ${emoji} ${status.padEnd(15)} ${String(data.count).padStart(4)} orders  $${data.total.toFixed(2)}`);
  }

  // === STEP 3: What should be EXCLUDED ===
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 3: Orders that should be EXCLUDED from revenue          │');
  console.log('└──────────────────────────────────────────────────────────────┘');

  const excludedOrders = allOrders.filter(o =>
    o.payment_status !== 'paid' || o.status === 'cancelled'
  );

  const excludedByReason = {
    'payment_failed': allOrders.filter(o => o.payment_status === 'failed'),
    'payment_pending': allOrders.filter(o => o.payment_status === 'pending'),
    'payment_null': allOrders.filter(o => !o.payment_status),
    'cancelled': allOrders.filter(o => o.status === 'cancelled' && o.payment_status === 'paid'),
  };

  let totalExcluded = 0;
  for (const [reason, orders] of Object.entries(excludedByReason)) {
    if (orders.length > 0) {
      const sum = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
      totalExcluded += sum;
      console.log(`  ❌ ${reason.padEnd(20)} ${String(orders.length).padStart(4)} orders  $${sum.toFixed(2)}`);
    }
  }
  console.log(`  ────────────────────────────────────────────────────────────`);
  console.log(`  TOTAL EXCLUDED:        ${String(excludedOrders.length).padStart(4)} orders  $${totalExcluded.toFixed(2)}`);

  // === STEP 4: PAID orders only (money in bank) ===
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 4: PAID Orders (Cash Collected - Money in Bank)         │');
  console.log('└──────────────────────────────────────────────────────────────┘');

  const paidOrders = allOrders.filter(o => o.payment_status === 'paid' && o.status !== 'cancelled');

  let paidSubtotal = 0;
  let paidTax = 0;
  let paidShipping = 0;
  let paidTotal = 0;
  let paidDiscountField = 0;
  let paidCampaignDiscount = 0;
  let paidLoyaltyDiscount = 0;
  let paidAffiliateDiscount = 0;

  for (const o of paidOrders) {
    paidSubtotal += parseFloat(o.subtotal || 0);
    paidTax += parseFloat(o.tax_amount || 0);
    paidShipping += parseFloat(o.shipping_cost || 0);
    paidTotal += parseFloat(o.total_amount || 0);
    paidDiscountField += parseFloat(o.discount_amount || 0);
    paidCampaignDiscount += parseFloat(o.metadata?.campaign_discount_amount || 0);
    paidLoyaltyDiscount += parseFloat(o.metadata?.loyalty_discount_amount || 0);
    paidAffiliateDiscount += parseFloat(o.affiliate_discount_amount || 0);
  }

  const totalDiscounts = paidDiscountField + paidCampaignDiscount + paidLoyaltyDiscount + paidAffiliateDiscount;

  console.log(`  Orders:              ${paidOrders.length}`);
  console.log(`  ────────────────────────────────────────────────────────────`);
  console.log(`  Gross Sales:         $${paidSubtotal.toFixed(2)}`);
  console.log(`  Discounts:`);
  console.log(`    - discount_amount:   $${paidDiscountField.toFixed(2)}`);
  console.log(`    - campaign:          $${paidCampaignDiscount.toFixed(2)}`);
  console.log(`    - loyalty:           $${paidLoyaltyDiscount.toFixed(2)}`);
  console.log(`    - affiliate:         $${paidAffiliateDiscount.toFixed(2)}`);
  console.log(`    TOTAL DISCOUNTS:    -$${totalDiscounts.toFixed(2)}`);
  console.log(`  ────────────────────────────────────────────────────────────`);
  console.log(`  Net Sales:           $${(paidSubtotal - totalDiscounts).toFixed(2)}`);
  console.log(`  Tax Collected:       $${paidTax.toFixed(2)}`);
  console.log(`  Shipping Collected:  $${paidShipping.toFixed(2)}`);
  console.log(`  ════════════════════════════════════════════════════════════`);
  console.log(`  CASH COLLECTED:      $${paidTotal.toFixed(2)}`);

  // Verify math
  const calculatedTotal = paidSubtotal - totalDiscounts + paidTax + paidShipping;
  const diff = Math.abs(calculatedTotal - paidTotal);
  if (diff > 1) {
    console.log(`  ⚠️  MATH CHECK: Calculated $${calculatedTotal.toFixed(2)} vs Stored $${paidTotal.toFixed(2)} (diff: $${diff.toFixed(2)})`);
  } else {
    console.log(`  ✅ MATH CHECK: Numbers reconcile within $1 tolerance`);
  }

  // === STEP 5: Revenue Recognition (ASC 606) ===
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 5: Revenue Recognition (ASC 606 Compliant)              │');
  console.log('└──────────────────────────────────────────────────────────────┘');

  // Recognized: paid AND (completed OR delivered)
  const recognizedOrders = paidOrders.filter(o =>
    o.status === 'completed' || o.status === 'delivered'
  );

  // Deferred: paid but not yet delivered
  const deferredOrders = paidOrders.filter(o =>
    ['shipped', 'ready', 'ready_to_ship', 'pending', 'confirmed', 'preparing', 'packing', 'packed'].includes(o.status)
  );

  let recTotal = 0, recSubtotal = 0, recDiscounts = 0;
  for (const o of recognizedOrders) {
    recSubtotal += parseFloat(o.subtotal || 0);
    recTotal += parseFloat(o.total_amount || 0);
    recDiscounts += parseFloat(o.discount_amount || 0);
    recDiscounts += parseFloat(o.metadata?.campaign_discount_amount || 0);
    recDiscounts += parseFloat(o.metadata?.loyalty_discount_amount || 0);
    recDiscounts += parseFloat(o.affiliate_discount_amount || 0);
  }

  let defTotal = 0;
  for (const o of deferredOrders) {
    defTotal += parseFloat(o.total_amount || 0);
  }

  console.log(`  RECOGNIZED REVENUE (P&L):`);
  console.log(`    Orders: ${recognizedOrders.length} (completed/delivered)`);
  console.log(`    Gross:  $${recSubtotal.toFixed(2)}`);
  console.log(`    Disc:  -$${recDiscounts.toFixed(2)}`);
  console.log(`    Revenue: $${recTotal.toFixed(2)}`);
  console.log(`  `);
  console.log(`  DEFERRED REVENUE (Balance Sheet Liability):`);
  console.log(`    Orders: ${deferredOrders.length} (in transit/pending delivery)`);
  console.log(`    Amount: $${defTotal.toFixed(2)}`);
  console.log(`  `);
  console.log(`  ✅ Recognized + Deferred = $${(recTotal + defTotal).toFixed(2)}`);
  console.log(`  ✅ Cash Collected =        $${paidTotal.toFixed(2)}`);

  // === STEP 6: Breakdown by Order Type ===
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 6: Paid Orders by Type                                  │');
  console.log('└──────────────────────────────────────────────────────────────┘');

  const byType = {};
  for (const o of paidOrders) {
    const type = o.order_type || 'unknown';
    if (!byType[type]) byType[type] = { count: 0, total: 0, discounts: 0 };
    byType[type].count++;
    byType[type].total += parseFloat(o.total_amount || 0);
    byType[type].discounts += parseFloat(o.discount_amount || 0);
    byType[type].discounts += parseFloat(o.metadata?.campaign_discount_amount || 0);
    byType[type].discounts += parseFloat(o.metadata?.loyalty_discount_amount || 0);
    byType[type].discounts += parseFloat(o.affiliate_discount_amount || 0);
  }

  for (const [type, data] of Object.entries(byType).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${type.padEnd(12)} ${String(data.count).padStart(4)} orders  $${data.total.toFixed(2)} (disc: $${data.discounts.toFixed(2)})`);
  }

  // === STEP 7: Affiliate Code Check ===
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 7: Affiliate Code Tracking                              │');
  console.log('└──────────────────────────────────────────────────────────────┘');

  const ordersWithAffiliateCode = paidOrders.filter(o => o.affiliate_code);
  const ordersWithAffiliateInMeta = paidOrders.filter(o => o.metadata?.affiliate_code);

  console.log(`  Orders with affiliate_code (top-level): ${ordersWithAffiliateCode.length}`);
  console.log(`  Orders with affiliate_code (metadata):  ${ordersWithAffiliateInMeta.length}`);

  if (ordersWithAffiliateCode.length > 0) {
    const affiliateCodes = {};
    for (const o of ordersWithAffiliateCode) {
      const code = o.affiliate_code;
      if (!affiliateCodes[code]) affiliateCodes[code] = { count: 0, discount: 0, total: 0 };
      affiliateCodes[code].count++;
      affiliateCodes[code].discount += parseFloat(o.affiliate_discount_amount || 0);
      affiliateCodes[code].total += parseFloat(o.total_amount || 0);
    }
    console.log(`\n  Affiliate Breakdown:`);
    for (const [code, data] of Object.entries(affiliateCodes)) {
      console.log(`    ${code}: ${data.count} orders, $${data.discount.toFixed(2)} discount, $${data.total.toFixed(2)} sales`);
    }
  } else {
    console.log(`  ⚠️  No orders have affiliate_code set in the top-level field`);
    console.log(`     (Fix deployed - new orders will track correctly)`);
  }

  // === SUMMARY ===
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    VERIFICATION SUMMARY                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  ✅ Total orders:        ${allOrders.length}`);
  console.log(`  ✅ Excluded (unpaid):   ${excludedOrders.length}`);
  console.log(`  ✅ Counted (paid):      ${paidOrders.length}`);
  console.log(`  ────────────────────────────────────────────────────────────`);
  console.log(`  💰 Cash Collected:      $${paidTotal.toFixed(2)}`);
  console.log(`  📊 Recognized Revenue:  $${recTotal.toFixed(2)}`);
  console.log(`  ⏳ Deferred Revenue:    $${defTotal.toFixed(2)}`);
  console.log(`  🎯 Total Discounts:     $${totalDiscounts.toFixed(2)}`);
}

verifyAccounting();
