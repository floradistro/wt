import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function discountDeepDive() {
  // Get ALL orders
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

  console.log('=== DISCOUNT DEEP DIVE ===\n');
  console.log('Total orders:', allOrders.length);

  // Analyze ALL discount sources
  console.log('\n=== ALL DISCOUNT SOURCES (ALL ORDERS) ===');

  let totalDiscountField = 0;
  let totalCampaignDiscount = 0;
  let totalLoyaltyDiscount = 0;
  let totalAffiliateDiscount = 0;
  let ordersWithCampaign = 0;
  let ordersWithLoyalty = 0;
  let ordersWithAffiliate = 0;
  let ordersWithDiscountField = 0;

  const affiliateCodes = {};
  const campaignIds = {};

  for (const o of allOrders) {
    const discField = parseFloat(o.discount_amount || 0);
    const campaignDisc = parseFloat(o.metadata?.campaign_discount_amount || 0);
    const loyaltyDisc = parseFloat(o.metadata?.loyalty_discount_amount || 0);
    const affiliateDisc = parseFloat(o.affiliate_discount_amount || 0);

    totalDiscountField += discField;
    totalCampaignDiscount += campaignDisc;
    totalLoyaltyDiscount += loyaltyDisc;
    totalAffiliateDiscount += affiliateDisc;

    if (discField > 0) ordersWithDiscountField++;
    if (campaignDisc > 0) ordersWithCampaign++;
    if (loyaltyDisc > 0) ordersWithLoyalty++;
    if (affiliateDisc > 0) ordersWithAffiliate++;

    // Track affiliate codes
    if (o.affiliate_code) {
      if (!affiliateCodes[o.affiliate_code]) affiliateCodes[o.affiliate_code] = { count: 0, discount: 0 };
      affiliateCodes[o.affiliate_code].count++;
      affiliateCodes[o.affiliate_code].discount += affiliateDisc;
    }

    // Track campaign IDs
    if (o.metadata?.campaign_id) {
      const cid = o.metadata.campaign_id;
      if (!campaignIds[cid]) campaignIds[cid] = { count: 0, discount: 0 };
      campaignIds[cid].count++;
      campaignIds[cid].discount += campaignDisc;
    } else if (campaignDisc > 0) {
      if (!campaignIds['no_id']) campaignIds['no_id'] = { count: 0, discount: 0 };
      campaignIds['no_id'].count++;
      campaignIds['no_id'].discount += campaignDisc;
    }
  }

  console.log('\nDiscount Sources:');
  console.log(`  discount_amount field: $${totalDiscountField.toFixed(2)} (${ordersWithDiscountField} orders)`);
  console.log(`  metadata.campaign_discount_amount: $${totalCampaignDiscount.toFixed(2)} (${ordersWithCampaign} orders)`);
  console.log(`  metadata.loyalty_discount_amount: $${totalLoyaltyDiscount.toFixed(2)} (${ordersWithLoyalty} orders)`);
  console.log(`  affiliate_discount_amount field: $${totalAffiliateDiscount.toFixed(2)} (${ordersWithAffiliate} orders)`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  TOTAL ALL DISCOUNTS: $${(totalDiscountField + totalCampaignDiscount + totalLoyaltyDiscount + totalAffiliateDiscount).toFixed(2)}`);

  if (Object.keys(affiliateCodes).length > 0) {
    console.log('\n=== AFFILIATE CODES USED ===');
    for (const [code, data] of Object.entries(affiliateCodes)) {
      console.log(`  ${code}: ${data.count} orders, $${data.discount.toFixed(2)} discount`);
    }
  }

  if (Object.keys(campaignIds).length > 0) {
    console.log('\n=== CAMPAIGNS ===');
    for (const [id, data] of Object.entries(campaignIds)) {
      console.log(`  ${id}: ${data.count} orders, $${data.discount.toFixed(2)} discount`);
    }
  }

  // Now break down by order type and status
  console.log('\n\n=== DISCOUNTS BY ORDER TYPE ===');
  const byType = {};
  for (const o of allOrders) {
    const type = o.order_type || 'unknown';
    if (!byType[type]) byType[type] = {
      count: 0,
      discountField: 0,
      campaignDisc: 0,
      loyaltyDisc: 0,
      affiliateDisc: 0,
      subtotal: 0,
      total: 0
    };
    byType[type].count++;
    byType[type].discountField += parseFloat(o.discount_amount || 0);
    byType[type].campaignDisc += parseFloat(o.metadata?.campaign_discount_amount || 0);
    byType[type].loyaltyDisc += parseFloat(o.metadata?.loyalty_discount_amount || 0);
    byType[type].affiliateDisc += parseFloat(o.affiliate_discount_amount || 0);
    byType[type].subtotal += parseFloat(o.subtotal || 0);
    byType[type].total += parseFloat(o.total_amount || 0);
  }

  for (const [type, data] of Object.entries(byType)) {
    const totalDisc = data.discountField + data.campaignDisc + data.loyaltyDisc + data.affiliateDisc;
    const discPct = data.subtotal > 0 ? (totalDisc / data.subtotal * 100).toFixed(1) : 0;
    console.log(`\n${type.toUpperCase()} (${data.count} orders):`);
    console.log(`  Subtotal: $${data.subtotal.toFixed(2)}`);
    console.log(`  Total Discounts: $${totalDisc.toFixed(2)} (${discPct}% off)`);
    console.log(`    - discount_amount: $${data.discountField.toFixed(2)}`);
    console.log(`    - campaign: $${data.campaignDisc.toFixed(2)}`);
    console.log(`    - loyalty: $${data.loyaltyDisc.toFixed(2)}`);
    console.log(`    - affiliate: $${data.affiliateDisc.toFixed(2)}`);
    console.log(`  Net Revenue: $${data.total.toFixed(2)}`);
  }

  // Check a sample e-commerce order to see all fields
  console.log('\n\n=== SAMPLE E-COMMERCE ORDER (with discount) ===');
  const sampleEcom = allOrders.find(o =>
    (o.order_type === 'shipping' || o.order_type === 'pickup') &&
    (parseFloat(o.metadata?.campaign_discount_amount || 0) > 0)
  );
  if (sampleEcom) {
    console.log('Order:', sampleEcom.order_number);
    console.log('Type:', sampleEcom.order_type);
    console.log('Status:', sampleEcom.status);
    console.log('Payment Status:', sampleEcom.payment_status);
    console.log('Subtotal:', sampleEcom.subtotal);
    console.log('Tax:', sampleEcom.tax_amount);
    console.log('discount_amount (field):', sampleEcom.discount_amount);
    console.log('affiliate_discount_amount (field):', sampleEcom.affiliate_discount_amount);
    console.log('affiliate_code:', sampleEcom.affiliate_code);
    console.log('Total:', sampleEcom.total_amount);
    console.log('Metadata:', JSON.stringify(sampleEcom.metadata, null, 2));
  }

  // Summary for accounting
  console.log('\n\n=== ACCOUNTING SUMMARY ===');

  // Only paid orders (not failed/pending)
  const paidOrders = allOrders.filter(o => o.payment_status === 'paid');
  console.log('\nPAID ORDERS ONLY:');

  let paidSubtotal = 0;
  let paidDiscounts = 0;
  let paidTotal = 0;

  for (const o of paidOrders) {
    paidSubtotal += parseFloat(o.subtotal || 0);
    paidTotal += parseFloat(o.total_amount || 0);
    paidDiscounts += parseFloat(o.discount_amount || 0);
    paidDiscounts += parseFloat(o.metadata?.campaign_discount_amount || 0);
    paidDiscounts += parseFloat(o.metadata?.loyalty_discount_amount || 0);
    paidDiscounts += parseFloat(o.affiliate_discount_amount || 0);
  }

  console.log(`  Orders: ${paidOrders.length}`);
  console.log(`  Gross Sales (subtotal): $${paidSubtotal.toFixed(2)}`);
  console.log(`  Total Discounts: $${paidDiscounts.toFixed(2)}`);
  console.log(`  Net Revenue: $${paidTotal.toFixed(2)}`);
  console.log(`  Discount Rate: ${(paidDiscounts / paidSubtotal * 100).toFixed(1)}%`);

  // Recognized (completed/delivered)
  const recognizedOrders = paidOrders.filter(o => o.status === 'completed' || o.status === 'delivered');
  console.log('\nRECOGNIZED (completed/delivered):');

  let recSubtotal = 0;
  let recDiscounts = 0;
  let recTotal = 0;

  for (const o of recognizedOrders) {
    recSubtotal += parseFloat(o.subtotal || 0);
    recTotal += parseFloat(o.total_amount || 0);
    recDiscounts += parseFloat(o.discount_amount || 0);
    recDiscounts += parseFloat(o.metadata?.campaign_discount_amount || 0);
    recDiscounts += parseFloat(o.metadata?.loyalty_discount_amount || 0);
    recDiscounts += parseFloat(o.affiliate_discount_amount || 0);
  }

  console.log(`  Orders: ${recognizedOrders.length}`);
  console.log(`  Gross Sales (subtotal): $${recSubtotal.toFixed(2)}`);
  console.log(`  Total Discounts: $${recDiscounts.toFixed(2)}`);
  console.log(`  Net Revenue: $${recTotal.toFixed(2)}`);
  console.log(`  Discount Rate: ${(recDiscounts / recSubtotal * 100).toFixed(1)}%`);

  // Deferred (shipped but not delivered)
  const deferredOrders = paidOrders.filter(o => ['shipped', 'ready', 'ready_to_ship', 'pending'].includes(o.status));
  console.log('\nDEFERRED (in transit):');

  let defSubtotal = 0;
  let defDiscounts = 0;
  let defTotal = 0;

  for (const o of deferredOrders) {
    defSubtotal += parseFloat(o.subtotal || 0);
    defTotal += parseFloat(o.total_amount || 0);
    defDiscounts += parseFloat(o.discount_amount || 0);
    defDiscounts += parseFloat(o.metadata?.campaign_discount_amount || 0);
    defDiscounts += parseFloat(o.metadata?.loyalty_discount_amount || 0);
    defDiscounts += parseFloat(o.affiliate_discount_amount || 0);
  }

  console.log(`  Orders: ${deferredOrders.length}`);
  console.log(`  Gross Sales (subtotal): $${defSubtotal.toFixed(2)}`);
  console.log(`  Total Discounts: $${defDiscounts.toFixed(2)}`);
  console.log(`  Deferred Revenue: $${defTotal.toFixed(2)}`);
}

discountDeepDive();
