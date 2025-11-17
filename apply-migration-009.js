#!/usr/bin/env node

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function applyMigration() {
  console.log('🔧 Applying migration 009...\n');

  const sql = fs.readFileSync('supabase/migrations/009_create_pos_sale_actual_schema.sql', 'utf8');

  // Execute raw SQL using Supabase client
  const { data, error } = await supabase.rpc('exec', { sql });

  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Migration file created at:');
    console.log('   supabase/migrations/009_create_pos_sale_actual_schema.sql');
    console.log('\n📌 Please run this in Supabase SQL Editor manually');
  } else {
    console.log('✅ Migration applied successfully!');
  }
}

applyMigration();
