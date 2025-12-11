import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';
const USER_ID = '038cb26c-da40-4466-9b71-4155ad1b9bc7';

async function runConversionTests() {
  console.log('🧪 AFFILIATE CONVERSION TESTS (with real order)\n');

  // Get a real order
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, total_amount, subtotal')
    .eq('vendor_id', VENDOR_ID)
    .limit(1);

  if (orderError) {
    console.log('❌ Order query error:', orderError.message);
    return;
  }

  const order = orders?.[0];
  if (!order) {
    console.log('❌ No orders found');
    return;
  }

  console.log('Found order:', order.id, 'Total:', order.total_amount);

  // Get active affiliate
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('*')
    .eq('vendor_id', VENDOR_ID)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!affiliate) {
    console.log('❌ No active affiliate found');
    return;
  }

  console.log('Using affiliate:', affiliate.first_name, affiliate.referral_code);
  console.log('Initial metrics:', {
    total_orders: affiliate.total_orders,
    total_revenue: parseFloat(affiliate.total_revenue),
    pending_commission: parseFloat(affiliate.pending_commission)
  });

  const orderTotal = parseFloat(order.total_amount) || 100;
  const commissionAmount = orderTotal * (affiliate.commission_rate / 100);

  console.log('\nCreating conversion with commission:', commissionAmount.toFixed(2));

  // Create conversion
  const { data: conversion, error: convError } = await supabase
    .from('affiliate_conversions')
    .insert({
      affiliate_id: affiliate.id,
      vendor_id: VENDOR_ID,
      order_id: order.id,
      order_total: orderTotal,
      order_subtotal: parseFloat(order.subtotal) || orderTotal * 0.9,
      commission_rate: affiliate.commission_rate,
      commission_amount: commissionAmount,
      status: 'pending'
    })
    .select()
    .single();

  if (convError) {
    console.log('❌ Failed to create conversion:', convError.message);
    return;
  }

  console.log('✅ Created conversion:', conversion.id);

  // Approve conversion
  const { error: approveError } = await supabase
    .from('affiliate_conversions')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: USER_ID
    })
    .eq('id', conversion.id);

  if (approveError) {
    console.log('❌ Failed to approve:', approveError.message);
  } else {
    console.log('✅ Approved conversion');
  }

  // Wait for trigger
  await new Promise(r => setTimeout(r, 500));

  // Check updated metrics
  const { data: updatedAffiliate } = await supabase
    .from('affiliates')
    .select('total_orders, total_revenue, pending_commission')
    .eq('id', affiliate.id)
    .single();

  console.log('\n📊 Updated metrics:', updatedAffiliate);

  const ordersPassed = updatedAffiliate.total_orders > affiliate.total_orders;
  const revenuePassed = parseFloat(updatedAffiliate.total_revenue) > parseFloat(affiliate.total_revenue);
  const commissionPassed = parseFloat(updatedAffiliate.pending_commission) > parseFloat(affiliate.pending_commission);

  console.log(ordersPassed ? '✅ total_orders incremented' : '❌ total_orders NOT incremented');
  console.log(revenuePassed ? '✅ total_revenue updated' : '❌ total_revenue NOT updated');
  console.log(commissionPassed ? '✅ pending_commission updated' : '❌ pending_commission NOT updated');

  // Cleanup
  await supabase.from('affiliate_conversions').delete().eq('id', conversion.id);
  await supabase.from('affiliates').update({
    total_orders: affiliate.total_orders,
    total_revenue: affiliate.total_revenue,
    total_commission_earned: affiliate.total_commission_earned,
    pending_commission: affiliate.pending_commission
  }).eq('id', affiliate.id);

  console.log('\n🧹 Cleaned up');
  console.log('\n' + (ordersPassed && revenuePassed && commissionPassed ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'));
}

runConversionTests().catch(console.error);
