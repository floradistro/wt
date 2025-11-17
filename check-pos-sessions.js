#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data } = await supabase.from('pos_sessions').select('*').limit(1);

  if (data && data.length > 0) {
    console.log('📋 pos_sessions columns:');
    Object.keys(data[0]).sort().forEach(col => console.log('   -', col));
  }

  const { data: pt } = await supabase.from('payment_transactions').select('*').limit(1);

  if (pt && pt.length > 0) {
    console.log('\n📋 payment_transactions columns:');
    Object.keys(pt[0]).sort().forEach(col => console.log('   -', col));
  }
}

checkSchema();
