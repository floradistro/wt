import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function checkEcomOrders() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all e-commerce orders (shipping + pickup)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, created_at, order_type, status, subtotal, tax_amount, discount_amount, total_amount, shipping_amount, payment_method, metadata, affiliate_discount_amount')
    .eq('vendor_id', vendorId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .in('order_type', ['shipping', 'pickup'])
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  console.log('=== E-COMMERCE ORDERS DETAIL ===');
  console.log('Total e-com orders:', orders.length);

  // Show breakdown
  let totalSubtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;
  let totalAffiliateDiscount = 0;
  let totalShipping = 0;
  let totalTotal = 0;
  let withCoupon = 0;

  const byStatus = {};
  const byType = {};

  for (const o of orders) {
    totalSubtotal += parseFloat(o.subtotal || 0);
    totalTax += parseFloat(o.tax_amount || 0);
    totalDiscount += parseFloat(o.discount_amount || 0);
    totalAffiliateDiscount += parseFloat(o.affiliate_discount_amount || 0);
    totalShipping += parseFloat(o.shipping_amount || 0);
    totalTotal += parseFloat(o.total_amount || 0);
    if (o.metadata?.coupon_code) withCoupon++;

    if (!byStatus[o.status]) byStatus[o.status] = { count: 0, total: 0, subtotal: 0, discount: 0 };
    byStatus[o.status].count++;
    byStatus[o.status].total += parseFloat(o.total_amount || 0);
    byStatus[o.status].subtotal += parseFloat(o.subtotal || 0);
    byStatus[o.status].discount += parseFloat(o.discount_amount || 0);

    if (!byType[o.order_type]) byType[o.order_type] = { count: 0, total: 0, subtotal: 0, discount: 0 };
    byType[o.order_type].count++;
    byType[o.order_type].total += parseFloat(o.total_amount || 0);
    byType[o.order_type].subtotal += parseFloat(o.subtotal || 0);
    byType[o.order_type].discount += parseFloat(o.discount_amount || 0);
  }

  console.log('\n=== TOTALS ===');
  console.log('Subtotal:', '$' + totalSubtotal.toFixed(2));
  console.log('Tax:', '$' + totalTax.toFixed(2));
  console.log('Discount (coupon/promo):', '$' + totalDiscount.toFixed(2));
  console.log('Affiliate Discount:', '$' + totalAffiliateDiscount.toFixed(2));
  console.log('Shipping:', '$' + totalShipping.toFixed(2));
  console.log('Total (stored in DB):', '$' + totalTotal.toFixed(2));
  console.log('Calculated (subtotal + tax + shipping - discount - affiliate):', '$' + (totalSubtotal + totalTax + totalShipping - totalDiscount - totalAffiliateDiscount).toFixed(2));
  console.log('Orders with coupon:', withCoupon);

  console.log('\n=== BY STATUS ===');
  for (const [status, data] of Object.entries(byStatus)) {
    console.log(`${status}: ${data.count} orders | subtotal: $${data.subtotal.toFixed(2)} | discount: $${data.discount.toFixed(2)} | total: $${data.total.toFixed(2)}`);
  }

  console.log('\n=== BY TYPE ===');
  for (const [type, data] of Object.entries(byType)) {
    console.log(`${type}: ${data.count} orders | subtotal: $${data.subtotal.toFixed(2)} | discount: $${data.discount.toFixed(2)} | total: $${data.total.toFixed(2)}`);
  }

  // Exclude cancelled for actual revenue
  const nonCancelled = orders.filter(o => o.status !== 'cancelled');
  let actualRevenue = 0;
  let actualSubtotal = 0;
  let actualDiscount = 0;
  for (const o of nonCancelled) {
    actualRevenue += parseFloat(o.total_amount || 0);
    actualSubtotal += parseFloat(o.subtotal || 0);
    actualDiscount += parseFloat(o.discount_amount || 0) + parseFloat(o.affiliate_discount_amount || 0);
  }
  console.log('\n=== ACTUAL REVENUE (excluding cancelled) ===');
  console.log('Orders:', nonCancelled.length);
  console.log('Subtotal:', '$' + actualSubtotal.toFixed(2));
  console.log('Total Discounts Applied:', '$' + actualDiscount.toFixed(2));
  console.log('Net Revenue:', '$' + actualRevenue.toFixed(2));

  // Show recent e-com orders with details
  console.log('\n=== LAST 30 E-COM ORDERS ===');
  for (const o of orders.slice(0, 30)) {
    const date = new Date(o.created_at).toLocaleDateString();
    const coupon = o.metadata?.coupon_code ? ` [COUPON: ${o.metadata.coupon_code}]` : '';
    const affDisc = parseFloat(o.affiliate_discount_amount || 0);
    const disc = parseFloat(o.discount_amount || 0);
    const totalDisc = disc + affDisc;
    console.log(`#${o.order_number} | ${date} | ${o.order_type.padEnd(8)} | ${o.status.padEnd(10)} | sub: $${parseFloat(o.subtotal||0).toFixed(2).padStart(7)} | disc: $${totalDisc.toFixed(2).padStart(6)} | total: $${parseFloat(o.total_amount||0).toFixed(2).padStart(7)}${coupon}`);
  }

  // Check for orders where total doesn't match calculation
  console.log('\n=== ORDERS WITH CALCULATION MISMATCH ===');
  let mismatches = 0;
  for (const o of orders) {
    const subtotal = parseFloat(o.subtotal || 0);
    const tax = parseFloat(o.tax_amount || 0);
    const discount = parseFloat(o.discount_amount || 0);
    const affDiscount = parseFloat(o.affiliate_discount_amount || 0);
    const shipping = parseFloat(o.shipping_amount || 0);
    const total = parseFloat(o.total_amount || 0);
    const calculated = subtotal + tax + shipping - discount - affDiscount;

    if (Math.abs(calculated - total) > 0.05) {
      console.log(`#${o.order_number}: sub=$${subtotal.toFixed(2)} + tax=$${tax.toFixed(2)} + ship=$${shipping.toFixed(2)} - disc=$${discount.toFixed(2)} - aff=$${affDiscount.toFixed(2)} = $${calculated.toFixed(2)} BUT stored=$${total.toFixed(2)} (diff: $${(total - calculated).toFixed(2)})`);
      mismatches++;
    }
  }
  if (mismatches === 0) console.log('None found - all totals match calculations');
  else console.log(`\nFound ${mismatches} orders with calculation mismatches`);
}

checkEcomOrders();
