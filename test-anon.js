#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTcyMzMsImV4cCI6MjA3NjU3MzIzM30.N8jPwlyCBB5KJB5I-XaK6m-mq88rSR445AWFJJmwRCg';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

async function test() {
  console.log('🧪 Testing create_pos_sale with ANON key (exactly as the app uses)...\n');
  
  const { data: location } = await supabaseService.from('locations').select('*').limit(1).single();
  const { data: vendor } = await supabaseService.from('vendors').select('*').limit(1).single();
  const { data: session } = await supabaseService.from('pos_sessions').select('*').eq('status', 'open').limit(1).single();
  const { data: product } = await supabaseService.from('products').select('*').not('price', 'is', null).gt('price', 0).limit(1).single();
  const { data: usersTable } = await supabaseService.from('users').select('*').limit(1);
  const userId = usersTable && usersTable.length > 0 ? usersTable[0].id : null;
  
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
    p_change_given: 0,
    p_customer_id: null,
    p_customer_name: 'Walk-In',
    p_authorization_code: null,
    p_payment_transaction_id: null,
    p_card_type: null,
    p_card_last4: null,
    p_loyalty_points_redeemed: 0,
    p_loyalty_discount_amount: 0
  };
  
  console.log('💰 Calling RPC with ANON key (not service role)...');
  const { data, error } = await supabaseAnon.rpc('create_pos_sale', saleData);
  
  if (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Details:', error);
  } else {
    console.log('\n✅ SUCCESS WITH ANON KEY!');
    console.log('Result:', JSON.stringify(data, null, 2));
    console.log('\n🎉 The function is working! Cash sales should work in the app now.');
  }
}

test();
