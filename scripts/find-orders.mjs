import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findOrders() {
  // The two missing orders
  const missingOrderNumbers = [
    '764922823436CYHNQND',  // Matthew Lane
    '764956425071LNITD4I',  // Sheneka Thomas
  ];

  console.log('=== CHECKING MISSING ORDERS ===\n');

  for (const orderNum of missingOrderNumbers) {
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNum)
      .single();

    if (!order) {
      console.log(`Order ${orderNum} NOT FOUND`);
      continue;
    }

    console.log(`\n--- ${orderNum} ---`);
    console.log('status:', order.status);
    console.log('pickup_location_id:', order.pickup_location_id || 'NULL');
    console.log('vendor_id:', order.vendor_id);
    console.log('customer_id:', order.customer_id);
    console.log('order_type:', order.order_type);
    console.log('delivery_type:', order.delivery_type);
    console.log('shipping_address:', order.shipping_address ? 'YES' : 'NO');

    // Check order_locations
    const { data: orderLocs } = await supabase
      .from('order_locations')
      .select('*, locations:location_id(name)')
      .eq('order_id', order.id);

    console.log('order_locations entries:', orderLocs ? orderLocs.length : 0);
    if (orderLocs && orderLocs.length > 0) {
      orderLocs.forEach(ol => {
        console.log(`  -> ${ol.locations?.name || ol.location_id} | ${ol.fulfillment_status} | items: ${ol.item_count}`);
      });
    }
  }

  // Check how many orders have NULL pickup_location_id
  console.log('\n=== ORDERS WITH NULL pickup_location_id ===');
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .is('pickup_location_id', null);

  console.log('Total orders with NULL pickup_location_id:', count);

  // Get recent ones
  const { data: nullLocOrders } = await supabase
    .from('orders')
    .select('order_number, status, created_at, customer_id')
    .is('pickup_location_id', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nRecent NULL location orders:');
  if (nullLocOrders) {
    // Get customer names for these
    const customerIds = nullLocOrders.map(o => o.customer_id).filter(Boolean);
    const { data: customers } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .in('id', customerIds);

    nullLocOrders.forEach(o => {
      const cust = customers?.find(c => c.id === o.customer_id);
      const custName = cust ? `${cust.first_name} ${cust.last_name}` : 'Unknown';
      console.log(`  ${o.order_number} | ${o.status} | ${custName} | ${o.created_at}`);
    });
  }
}

findOrders();
