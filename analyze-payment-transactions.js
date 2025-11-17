#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function analyzePaymentTransactions() {
  console.log('🔍 Analyzing payment_transactions table...\n');

  // Get a sample transaction
  const { data: samples } = await supabase
    .from('payment_transactions')
    .select('*')
    .limit(5);

  if (samples && samples.length > 0) {
    console.log('📋 Sample payment transaction:');
    console.log(JSON.stringify(samples[0], null, 2));

    console.log('\n📊 Required fields analysis:');
    const sample = samples[0];

    // Check which fields are NOT NULL
    Object.keys(sample).forEach(key => {
      if (sample[key] !== null) {
        console.log(`✅ ${key}: ${typeof sample[key] === 'object' ? JSON.stringify(sample[key]) : sample[key]}`);
      } else {
        console.log(`⚪ ${key}: null (optional)`);
      }
    });

    // Show unique processor_type values
    const { data: processors } = await supabase
      .from('payment_transactions')
      .select('processor_type')
      .not('processor_type', 'is', null);

    if (processors) {
      const uniqueTypes = [...new Set(processors.map(p => p.processor_type))];
      console.log('\n📋 Valid processor_type values:');
      uniqueTypes.forEach(type => console.log('   -', type));
    }
  } else {
    console.log('⚠️  No payment transactions found');
  }
}

analyzePaymentTransactions();
