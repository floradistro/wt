import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function test() {
  // Get vendor with customers (the one that has metrics)
  const { data: metricsVendor } = await supabase
    .from('customer_metrics')
    .select('vendor_id')
    .limit(1)
    .single();

  const { data: vendor } = await supabase
    .from('vendors')
    .select('id, store_name')
    .eq('id', metricsVendor.vendor_id)
    .single();

  console.log('Testing vendor:', vendor?.store_name);

  // Get segments for this vendor
  const { data: segments } = await supabase
    .from('customer_segments')
    .select('id, name, customer_count')
    .eq('vendor_id', vendor.id)
    .eq('is_system', true)
    .order('priority', { ascending: false });

  console.log(`\nSegments for ${vendor.store_name}:`);
  for (const seg of segments || []) {
    // Test get_segment_customers
    const { data: customers, error } = await supabase
      .rpc('get_segment_customers', { p_segment_id: seg.id });

    const count = customers?.length || 0;
    console.log(`  ${seg.name}: ${count} customers ${error ? '(error: ' + error.message + ')' : ''}`);
  }

  // Also test "New Customers" segment specifically
  const { data: newCustomersSeg } = await supabase
    .from('customer_segments')
    .select('id, name')
    .eq('vendor_id', vendor.id)
    .eq('name', 'New Customers')
    .single();

  if (newCustomersSeg) {
    console.log('\nTesting "New Customers" segment in detail:');
    const { data: customers, error } = await supabase
      .rpc('get_segment_customers', { p_segment_id: newCustomersSeg.id });

    if (error) {
      console.log('Error:', error.message);
    } else {
      console.log('Customers found:', customers?.length || 0);
      for (const c of customers || []) {
        console.log(`  - ${c.customer_name} (${c.email})`);
      }
    }
  }
}

test().catch(console.error);
