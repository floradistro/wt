#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function applyFunction() {
  console.log('🚀 Applying create_pos_sale function to database...\n');
  
  const sql = fs.readFileSync('/Users/whale/Desktop/whaletools-native/supabase/migrations/010_final_create_pos_sale_with_grants.sql', 'utf8');
  
  // Split on semicolons to execute each statement separately
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim() + ';';
    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: statement });
      if (error) throw error;
      console.log(`✅ Statement ${i + 1} executed successfully`);
    } catch (error) {
      // Try direct execution via POST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: statement })
      });
      
      if (!response.ok) {
        console.error(`❌ Statement ${i + 1} failed:`, error.message || await response.text());
      } else {
        console.log(`✅ Statement ${i + 1} executed via API`);
      }
    }
  }
  
  console.log('\n🧪 Testing function...');
  
  // Get required data
  const { data: location } = await supabase.from('locations').select('*').limit(1).single();
  const { data: vendor } = await supabase.from('vendors').select('*').limit(1).single();
  const { data: session } = await supabase.from('pos_sessions').select('*').eq('status', 'open').limit(1).single();
  const { data: product } = await supabase.from('products').select('*').not('price', 'is', null).gt('price', 0).limit(1).single();
  const { data: usersTable } = await supabase.from('users').select('*').limit(1);
  const userId = usersTable && usersTable.length > 0 ? usersTable[0].id : session.user_id;
  
  const saleData = {
    p_location_id: location.id,
    p_vendor_id: vendor.id,
    p_session_id: session.id,
    p_user_id: userId,
    p_payment_processor_id: null,
    p_items: [{
      productId: product.id,
      productName: product.name,
      productSku: product.sku || '',
      quantity: 1,
      unitPrice: parseFloat(product.price),
      tierName: '1 Unit',
      discountAmount: 0,
      lineTotal: parseFloat(product.price)
    }],
    p_subtotal: parseFloat(product.price),
    p_tax_amount: parseFloat(product.price) * 0.1,
    p_total: parseFloat(product.price) * 1.1,
    p_payment_method: 'cash',
    p_cash_tendered: parseFloat(product.price) * 1.1,
    p_change_given: 0
  };
  
  const { data: result, error } = await supabase.rpc('create_pos_sale', saleData);
  
  if (error) {
    console.error('❌ Function test failed:', error.message);
  } else {
    console.log('✅ Function working! Result:', JSON.stringify(result, null, 2));
  }
}

applyFunction();
