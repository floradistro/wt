#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkDeliveryTypes() {
  // Get sample orders to see valid delivery_type values
  const { data } = await supabase
    .from('orders')
    .select('delivery_type')
    .not('delivery_type', 'is', null)
    .limit(20);

  if (data) {
    const uniqueTypes = [...new Set(data.map(o => o.delivery_type))];
    console.log('📋 Valid delivery_type values found:');
    uniqueTypes.forEach(type => console.log('   -', type));
  }
}

checkDeliveryTypes();
