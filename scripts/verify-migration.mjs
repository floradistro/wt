import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function verify() {
  // Check customer_metrics table
  const { count: metricsCount } = await supabase.from('customer_metrics').select('*', { count: 'exact', head: true });
  console.log('customer_metrics rows:', metricsCount);

  // Check customer_segments
  const { data: segments } = await supabase.from('customer_segments').select('name, description, is_system, priority, color');
  console.log('\n=== Customer Segments ===');
  for (const s of (segments || [])) {
    console.log(`${s.name.padEnd(25)} | system: ${s.is_system ? 'Y' : 'N'} | priority: ${s.priority} | ${s.color}`);
  }

  // Check customer_segment_memberships
  const { count: membershipCount } = await supabase.from('customer_segment_memberships').select('*', { count: 'exact', head: true });
  console.log('\ncustomer_segment_memberships rows:', membershipCount);
}

verify().catch(console.error);
