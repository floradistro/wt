import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function testFunction() {
  // Get a customer with orders
  const { data: order } = await supabase
    .from('orders')
    .select('customer_id, vendor_id, customer:customers(first_name, last_name)')
    .not('customer_id', 'is', null)
    .in('status', ['completed', 'delivered'])
    .limit(1)
    .single();

  if (!order) {
    console.log('No completed orders found');
    return;
  }

  console.log(`Testing with customer: ${order.customer?.first_name} ${order.customer?.last_name}`);
  console.log(`Customer ID: ${order.customer_id}`);
  console.log(`Vendor ID: ${order.vendor_id}`);

  // Call the edge function directly
  const response = await fetch(
    'https://uaednwpxursknmwdeejn.supabase.co/functions/v1/update-customer-metrics',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI`,
      },
      body: JSON.stringify({
        customer_id: order.customer_id,
        vendor_id: order.vendor_id,
      }),
    }
  );

  const result = await response.json();
  console.log('\nEdge Function Response:');
  console.log(JSON.stringify(result, null, 2));

  // Check the metrics
  const { data: metrics } = await supabase
    .from('customer_metrics')
    .select('*')
    .eq('customer_id', order.customer_id)
    .single();

  if (metrics) {
    console.log('\nCustomer Metrics:');
    console.log(`  RFM Segment: ${metrics.rfm_segment}`);
    console.log(`  RFM Scores: R=${metrics.recency_score} F=${metrics.frequency_score} M=${metrics.monetary_score}`);
    console.log(`  Total Orders: ${metrics.total_orders}`);
    console.log(`  Total Spent: $${metrics.total_spent}`);
    console.log(`  Category Affinity:`, metrics.category_affinity);
    console.log(`  Strain Affinity:`, metrics.strain_affinity);
    console.log(`  Preferred Channel: ${metrics.preferred_channel}`);
    console.log(`  Is At Risk: ${metrics.is_at_risk}`);
    console.log(`  Reorder Due: ${metrics.reorder_due}`);
  }
}

testFunction().catch(console.error);
