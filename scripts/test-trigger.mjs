import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function testTrigger() {
  console.log('Testing real-time trigger...\n');

  // Find an order that we can update to trigger the function
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id, vendor_id, status, customer:customers(first_name, last_name)')
    .not('customer_id', 'is', null)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (!order) {
    // Try to find any order we can test with
    const { data: anyOrder } = await supabase
      .from('orders')
      .select('id, customer_id, vendor_id, status, customer:customers(first_name, last_name)')
      .not('customer_id', 'is', null)
      .limit(1)
      .single();

    if (!anyOrder) {
      console.log('No orders found to test with');
      return;
    }

    console.log(`Found order: ${anyOrder.id.slice(0, 8)}...`);
    console.log(`Customer: ${anyOrder.customer?.first_name} ${anyOrder.customer?.last_name}`);
    console.log(`Current status: ${anyOrder.status}`);

    // Get current metrics
    const { data: beforeMetrics } = await supabase
      .from('customer_metrics')
      .select('rfm_segment, total_orders, computed_at')
      .eq('customer_id', anyOrder.customer_id)
      .single();

    console.log('\nMetrics before:', beforeMetrics);

    // Update status to 'completed' to trigger the function
    if (anyOrder.status !== 'completed') {
      console.log('\nUpdating order status to "completed" to trigger function...');
      const { error } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', anyOrder.id);

      if (error) {
        console.log('Update error:', error.message);
        return;
      }

      // Wait a moment for the trigger to execute
      console.log('Waiting 3 seconds for trigger to process...');
      await new Promise(r => setTimeout(r, 3000));

      // Check if metrics were updated
      const { data: afterMetrics } = await supabase
        .from('customer_metrics')
        .select('rfm_segment, total_orders, computed_at')
        .eq('customer_id', anyOrder.customer_id)
        .single();

      console.log('\nMetrics after:', afterMetrics);

      if (afterMetrics?.computed_at !== beforeMetrics?.computed_at) {
        console.log('\n✅ TRIGGER WORKING! Metrics were updated.');
      } else {
        console.log('\n⚠️  Metrics may not have been updated yet. Check pg_net queue.');
      }

      // Restore original status
      console.log(`\nRestoring order status to "${anyOrder.status}"...`);
      await supabase
        .from('orders')
        .update({ status: anyOrder.status })
        .eq('id', anyOrder.id);
    } else {
      console.log('Order already completed, metrics should be up to date.');
    }
  }
}

testTrigger().catch(console.error);
