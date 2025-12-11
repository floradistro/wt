import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function cleanup() {
  console.log('Cleaning up duplicate segments...\n');

  // Get all system segments
  const { data: segments } = await supabase
    .from('customer_segments')
    .select('id, vendor_id, name, created_at')
    .eq('is_system', true)
    .order('created_at', { ascending: true });

  console.log(`Total system segments: ${segments?.length || 0}`);

  // Group by vendor + name
  const groups = {};
  for (const seg of segments || []) {
    const key = `${seg.vendor_id}|${seg.name}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(seg);
  }

  // Find duplicates to delete (keep the first one)
  const toDelete = [];
  for (const [key, segs] of Object.entries(groups)) {
    if (segs.length > 1) {
      // Keep first, delete rest
      for (let i = 1; i < segs.length; i++) {
        toDelete.push(segs[i].id);
      }
    }
  }

  console.log(`Duplicates to delete: ${toDelete.length}`);

  if (toDelete.length > 0) {
    // Delete in batches
    const batchSize = 50;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .in('id', batch);

      if (error) {
        console.error('Delete error:', error.message);
      } else {
        console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}`);
      }
    }
  }

  // Verify
  const { count } = await supabase
    .from('customer_segments')
    .select('*', { count: 'exact', head: true })
    .eq('is_system', true);

  console.log(`\nRemaining system segments: ${count}`);
}

cleanup().catch(console.error);
