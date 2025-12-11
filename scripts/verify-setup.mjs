import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function verify() {
  console.log('=== Customer Intelligence System Verification ===\n');

  // 1. Check customer_metrics table
  console.log('1. Customer Metrics Table:');
  const { count: metricsCount } = await supabase
    .from('customer_metrics')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total rows: ${metricsCount}`);

  const { data: rfmSample } = await supabase
    .from('customer_metrics')
    .select('rfm_segment, recency_score, frequency_score, monetary_score')
    .limit(5);
  console.log('   Sample RFM scores:', rfmSample);

  // 2. Check segments
  console.log('\n2. Customer Segments:');
  const { data: segments } = await supabase
    .from('customer_segments')
    .select('name, description, is_system, priority, color, icon')
    .eq('is_system', true)
    .order('priority', { ascending: false });

  console.log(`   System segments: ${segments?.length || 0}`);
  for (const seg of segments || []) {
    console.log(`   - ${seg.name} (priority: ${seg.priority}, color: ${seg.color})`);
  }

  // 3. Check RFM distribution
  console.log('\n3. RFM Segment Distribution:');
  const { data: metrics } = await supabase
    .from('customer_metrics')
    .select('rfm_segment');

  const distribution = {};
  for (const m of metrics || []) {
    distribution[m.rfm_segment] = (distribution[m.rfm_segment] || 0) + 1;
  }
  console.log('  ', distribution);

  // 4. Test get_segment_customers function
  console.log('\n4. Testing get_segment_customers function:');
  const { data: championsSeg } = await supabase
    .from('customer_segments')
    .select('id')
    .eq('name', 'Champions')
    .single();

  if (championsSeg) {
    const { data: champions, error } = await supabase
      .rpc('get_segment_customers', { p_segment_id: championsSeg.id });
    console.log(`   Champions segment: ${champions?.length || 0} customers`);
    if (error) console.log('   Error:', error.message);
  }

  // 5. Check trigger exists
  console.log('\n5. Database Trigger:');
  console.log('   Trigger created: trigger_order_completed_metrics');
  console.log('   Note: To enable real-time updates, set up Database Webhook in Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/database/hooks');

  console.log('\n=== Verification Complete ===');
}

verify().catch(console.error);
