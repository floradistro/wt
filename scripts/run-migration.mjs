import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

// Use Management API to run SQL
const SUPABASE_PROJECT_REF = 'uaednwpxursknmwdeejn';
const SUPABASE_ACCESS_TOKEN = 'sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10';

async function runSQL(sql) {
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
    throw new Error(`API Error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function runMigration() {
  const migrationPath = process.argv[2];
  if (!migrationPath) {
    console.error('Usage: node run-migration.mjs <migration-file>');
    process.exit(1);
  }

  console.log(`Running migration: ${migrationPath}`);
  const sql = readFileSync(migrationPath, 'utf8');

  console.log('Executing full migration SQL...');

  try {
    const result = await runSQL(sql);
    console.log('Migration executed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2).substring(0, 500));
  } catch (err) {
    console.error('Migration error:', err.message);

    // If full SQL fails, let's just check if tables exist
    console.log('\nChecking if customer_metrics table exists...');
    const { data, error } = await supabase
      .from('customer_metrics')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      console.log('Table does not exist yet. Migration may need to be run via Supabase Dashboard.');
    } else if (error) {
      console.log('Query error:', error.message);
    } else {
      console.log('customer_metrics table already exists!');
    }
  }
}

runMigration().catch(console.error);
