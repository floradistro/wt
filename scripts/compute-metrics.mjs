import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function computeMetrics() {
  // Get all vendors - just select all to see what columns exist
  const { data: vendors, error: vendorError } = await supabase.from('vendors').select('*').limit(1);
  if (vendorError) {
    console.error('Vendor error:', vendorError.message);
    return;
  }

  if (vendors && vendors.length > 0) {
    console.log('Vendor columns:', Object.keys(vendors[0]).join(', '));
  }

  // Get all vendor IDs
  const { data: allVendors } = await supabase.from('vendors').select('id');
  console.log(`Found ${allVendors?.length || 0} vendors`);

  for (const vendor of (allVendors || [])) {
    console.log(`\nComputing metrics for vendor ${vendor.id.slice(0, 8)}...`);

    // Call the compute function
    const { data, error } = await supabase.rpc('compute_customer_metrics', {
      p_vendor_id: vendor.id
    });

    if (error) {
      console.error(`Error for ${vendor.name}:`, error.message);
    } else {
      console.log(`Computed ${data} customer metrics for ${vendor.name}`);
    }
  }

  // Show results
  const { count } = await supabase.from('customer_metrics').select('*', { count: 'exact', head: true });
  console.log(`\nTotal customer_metrics rows: ${count}`);

  // Show segment distribution
  const { data: segments } = await supabase
    .from('customer_metrics')
    .select('rfm_segment')
    .not('rfm_segment', 'is', null);

  const segmentCounts = {};
  for (const s of (segments || [])) {
    segmentCounts[s.rfm_segment] = (segmentCounts[s.rfm_segment] || 0) + 1;
  }
  console.log('\nRFM Segment Distribution:');
  console.log(segmentCounts);
}

computeMetrics().catch(console.error);
