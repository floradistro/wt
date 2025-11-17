#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testCompleteSale() {
  console.log('🧪 Testing complete cash sale flow...\n');

  try {
    // Get required data
    const { data: location } = await supabase.from('locations').select('*').limit(1).single();
    const { data: vendor } = await supabase.from('vendors').select('*').limit(1).single();
    const { data: session } = await supabase.from('pos_sessions').select('*').eq('status', 'open').limit(1).single();
    const { data: product } = await supabase.from('products').select('*').not('price', 'is', null).gt('price', 0).limit(1).single();
    const { data: usersTable } = await supabase.from('users').select('*').limit(1);
    const userId = usersTable && usersTable.length > 0 ? usersTable[0].id : session.user_id;
    const { data: processor } = await supabase.from('payment_processors').select('*').limit(1).single();

    if (!location || !vendor || !session || !product || !userId) {
      console.error('❌ Missing required data');
      return;
    }

    console.log('✅ Found all required data');
    console.log(`   Location: ${location.name}`);
    console.log(`   Vendor: ${vendor.store_name}`);
    console.log(`   Session: ${session.session_number}`);
    console.log(`   Product: ${product.name} ($${product.price})`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Processor: ${processor ? processor.name : 'manual'}\n`);

    const saleData = {
      p_location_id: location.id,
      p_vendor_id: vendor.id,
      p_session_id: session.id,
      p_user_id: userId,
      p_payment_processor_id: processor ? processor.id : null,
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

    console.log('💰 Testing sale...');
    console.log(`   Subtotal: $${saleData.p_subtotal.toFixed(2)}`);
    console.log(`   Tax: $${saleData.p_tax_amount.toFixed(2)}`);
    console.log(`   Total: $${saleData.p_total.toFixed(2)}\n`);

    const { data: result, error } = await supabase.rpc('create_pos_sale', saleData);

    if (error) {
      console.error('❌ RPC Error:', error.message);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return;
    }

    console.log('✅ Sale completed successfully!');
    console.log('📝 Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCompleteSale();
