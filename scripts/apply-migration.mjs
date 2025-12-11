import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_PROJECT_REF = 'uaednwpxursknmwdeejn';
const SUPABASE_ACCESS_TOKEN = 'sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function checkSchema() {
  // Check customer_segments columns
  const { data: segments } = await supabase.from('customer_segments').select('*').limit(1);
  if (segments && segments.length > 0) {
    console.log('customer_segments columns:', Object.keys(segments[0]).join(', '));
  } else {
    console.log('customer_segments: no data or empty');
  }
}

async function applyMigration() {
  const migrationPath = process.argv[2] || 'supabase/migrations/202_customer_intelligence_system.sql';
  console.log(`Applying migration: ${migrationPath}`);

  const sql = readFileSync(migrationPath, 'utf-8');
  console.log(`SQL length: ${sql.length} characters`);

  // Split into individual statements for better error handling
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} statements to execute`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('Migration failed:', response.status, text);
    process.exit(1);
  }

  const result = await response.json();
  console.log('Migration applied successfully!');
  console.log('Result:', JSON.stringify(result, null, 2).slice(0, 500));
}

// Run migration
checkSchema().then(applyMigration).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
