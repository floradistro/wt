#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkAllTables() {
  console.log('🔍 Checking all tables in Supabase...\n');

  const tablesToCheck = [
    'orders',
    'order_items',
    'pos_sessions',
    'cash_sessions',
    'transactions',
    'payment_transactions',
    'products',
    'customers',
    'locations',
    'vendors'
  ];

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`✅ ${table}: EXISTS with data`);
        console.log(`   Columns: ${Object.keys(data[0]).slice(0, 5).join(', ')}...`);
      } else {
        console.log(`⚠️  ${table}: EXISTS but empty`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
}

checkAllTables();
