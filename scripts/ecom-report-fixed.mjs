import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function ecomReport() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all e-commerce orders (shipping + pickup)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('vendor_id', vendorId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .in('order_type', ['shipping', 'pickup'])
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  console.log('=== FLORA DISTRO E-COMMERCE REPORT (Last 30 Days) ===\n');

  let totalSubtotal = 0;
  let totalTax = 0;
  let totalCouponDiscount = 0;
  let totalCampaignDiscount = 0;
  let totalLoyaltyDiscount = 0;
  let totalAffiliateDiscount = 0;
  let totalShipping = 0;
  let totalRevenue = 0;

  const byStatus = {};
  const byType = {};
  const byCampaign = {};

  for (const o of orders) {
    const subtotal = parseFloat(o.subtotal || 0);
    const tax = parseFloat(o.tax_amount || 0);
    const couponDisc = parseFloat(o.discount_amount || 0);
    const affiliateDisc = parseFloat(o.affiliate_discount_amount || 0);
    const campaignDisc = parseFloat(o.metadata?.campaign_discount_amount || 0);
    const loyaltyDisc = parseFloat(o.metadata?.loyalty_discount_amount || 0);
    const shipping = parseFloat(o.shipping_amount || 0);
    const total = parseFloat(o.total_amount || 0);

    totalSubtotal += subtotal;
    totalTax += tax;
    totalCouponDiscount += couponDisc;
    totalCampaignDiscount += campaignDisc;
    totalLoyaltyDiscount += loyaltyDisc;
    totalAffiliateDiscount += affiliateDisc;
    totalShipping += shipping;
    totalRevenue += total;

    // By status
    if (!byStatus[o.status]) byStatus[o.status] = { count: 0, subtotal: 0, discount: 0, revenue: 0 };
    byStatus[o.status].count++;
    byStatus[o.status].subtotal += subtotal;
    byStatus[o.status].discount += couponDisc + campaignDisc + loyaltyDisc + affiliateDisc;
    byStatus[o.status].revenue += total;

    // By type
    if (!byType[o.order_type]) byType[o.order_type] = { count: 0, subtotal: 0, discount: 0, revenue: 0 };
    byType[o.order_type].count++;
    byType[o.order_type].subtotal += subtotal;
    byType[o.order_type].discount += couponDisc + campaignDisc + loyaltyDisc + affiliateDisc;
    byType[o.order_type].revenue += total;

    // By campaign
    if (campaignDisc > 0) {
      const campaign = o.metadata?.campaign_id || 'default_sale';
      if (!byCampaign[campaign]) byCampaign[campaign] = { orders: 0, discount: 0, revenue: 0 };
      byCampaign[campaign].orders++;
      byCampaign[campaign].discount += campaignDisc;
      byCampaign[campaign].revenue += total;
    }
  }

  const totalDiscount = totalCouponDiscount + totalCampaignDiscount + totalLoyaltyDiscount + totalAffiliateDiscount;

  console.log('OVERVIEW');
  console.log('─'.repeat(50));
  console.log(`Total Orders:          ${orders.length}`);
  console.log(`Product Subtotal:      $${totalSubtotal.toFixed(2)}`);
  console.log(`Tax Collected:         $${totalTax.toFixed(2)}`);
  console.log(`Shipping Collected:    $${totalShipping.toFixed(2)}`);
  console.log('');
  console.log('DISCOUNTS GIVEN');
  console.log(`  Campaign/Sale:       -$${totalCampaignDiscount.toFixed(2)}`);
  console.log(`  Coupon Codes:        -$${totalCouponDiscount.toFixed(2)}`);
  console.log(`  Loyalty Points:      -$${totalLoyaltyDiscount.toFixed(2)}`);
  console.log(`  Affiliate:           -$${totalAffiliateDiscount.toFixed(2)}`);
  console.log(`  TOTAL DISCOUNTS:     -$${totalDiscount.toFixed(2)}`);
  console.log('');
  console.log(`NET REVENUE:           $${totalRevenue.toFixed(2)}`);
  console.log(`Avg Order Value:       $${(totalRevenue / orders.length).toFixed(2)}`);
  console.log(`Discount Rate:         ${((totalDiscount / totalSubtotal) * 100).toFixed(1)}% off`);

  // Exclude cancelled
  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  let activeRevenue = 0;
  for (const o of activeOrders) {
    activeRevenue += parseFloat(o.total_amount || 0);
  }

  console.log('\nACTUAL REVENUE (excluding cancelled)');
  console.log('─'.repeat(50));
  console.log(`Orders:                ${activeOrders.length}`);
  console.log(`Revenue:               $${activeRevenue.toFixed(2)}`);

  console.log('\nBY ORDER STATUS');
  console.log('─'.repeat(50));
  for (const [status, data] of Object.entries(byStatus).sort((a, b) => b[1].revenue - a[1].revenue)) {
    console.log(`${status.padEnd(12)} | ${String(data.count).padStart(3)} orders | subtotal: $${data.subtotal.toFixed(2).padStart(10)} | disc: -$${data.discount.toFixed(2).padStart(8)} | revenue: $${data.revenue.toFixed(2).padStart(10)}`);
  }

  console.log('\nBY ORDER TYPE');
  console.log('─'.repeat(50));
  for (const [type, data] of Object.entries(byType).sort((a, b) => b[1].revenue - a[1].revenue)) {
    console.log(`${type.padEnd(12)} | ${String(data.count).padStart(3)} orders | subtotal: $${data.subtotal.toFixed(2).padStart(10)} | disc: -$${data.discount.toFixed(2).padStart(8)} | revenue: $${data.revenue.toFixed(2).padStart(10)}`);
  }

  if (Object.keys(byCampaign).length > 0) {
    console.log('\nCAMPAIGN/SALE BREAKDOWN');
    console.log('─'.repeat(50));
    for (const [campaign, data] of Object.entries(byCampaign)) {
      console.log(`Campaign: ${campaign}`);
      console.log(`  Orders: ${data.orders} | Discount Given: $${data.discount.toFixed(2)} | Revenue: $${data.revenue.toFixed(2)}`);
    }
  }

  // Recent orders
  console.log('\nRECENT 15 E-COMMERCE ORDERS');
  console.log('─'.repeat(50));
  for (const o of orders.slice(0, 15)) {
    const date = new Date(o.created_at).toLocaleDateString();
    const campaignDisc = parseFloat(o.metadata?.campaign_discount_amount || 0);
    const couponDisc = parseFloat(o.discount_amount || 0);
    const totalDisc = campaignDisc + couponDisc;
    const discStr = totalDisc > 0 ? ` (-$${totalDisc.toFixed(2)} disc)` : '';
    console.log(`#${o.order_number} | ${date} | ${o.order_type.padEnd(8)} | ${o.status.padEnd(10)} | $${parseFloat(o.total_amount||0).toFixed(2).padStart(7)}${discStr}`);
  }
}

ecomReport();
