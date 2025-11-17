#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testCashSale() {
  console.log('🧪 Testing cash sale flow...\n');

  try {
    // Step 1: Check if required tables exist
    console.log('📋 Step 1: Checking database tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('orders')
      .select('id')
      .limit(1);

    if (tablesError) {
      console.error('❌ Orders table error:', tablesError.message);
      return;
    }
    console.log('✅ Orders table exists\n');

    // Step 2: Get a location ID
    console.log('📋 Step 2: Finding location...');
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('id, name')
      .limit(1)
      .single();

    if (locError || !locations) {
      console.error('❌ No locations found:', locError?.message);
      console.log('ℹ️  Need to create a location first\n');
      return;
    }
    console.log('✅ Found location:', locations.name, `(${locations.id})\n`);

    // Step 3: Get a session
    console.log('📋 Step 3: Finding or creating session...');
    const { data: sessions, error: sessError } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('location_id', locations.id)
      .order('created_at', { ascending: false })
      .limit(1);

    let sessionId;
    if (!sessions || sessions.length === 0) {
      console.log('ℹ️  No session found, need to create one first\n');
      return;
    } else {
      sessionId = sessions[0].id;
      console.log('✅ Found session:', sessions[0].session_number, `(${sessionId})\n`);
    }

    // Step 4: Get a user
    console.log('📋 Step 4: Finding user...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError || !users || users.length === 0) {
      console.error('❌ No users found:', usersError?.message);
      return;
    }
    const userId = users[0].id;
    console.log('✅ Found user:', users[0].email, `(${userId})\n`);

    // Step 5: Get a product
    console.log('📋 Step 5: Finding product...');
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .limit(1)
      .single();

    if (prodError || !products) {
      console.error('❌ No products found:', prodError?.message);
      return;
    }
    console.log('✅ Found product:', products.name, `$${products.price}\n`);

    // Step 6: Get vendor
    console.log('📋 Step 6: Finding vendor...');
    const { data: vendors, error: vendorError } = await supabase
      .from('vendors')
      .select('id, name')
      .limit(1)
      .single();

    if (vendorError || !vendors) {
      console.error('❌ No vendors found:', vendorError?.message);
      return;
    }
    console.log('✅ Found vendor:', vendors.name, `(${vendors.id})\n`);

    // Step 7: Test the RPC function
    console.log('📋 Step 7: Testing create_pos_sale RPC function...');

    const saleData = {
      p_location_id: locations.id,
      p_vendor_id: vendors.id,
      p_session_id: sessionId,
      p_user_id: userId,
      p_items: [
        {
          productId: products.id,
          productName: products.name,
          productSku: products.sku || 'TEST-SKU',
          quantity: 1,
          unitPrice: parseFloat(products.price),
          tierName: '1 Unit',
          discountAmount: 0,
          lineTotal: parseFloat(products.price)
        }
      ],
      p_subtotal: parseFloat(products.price),
      p_tax_amount: parseFloat(products.price) * 0.1,
      p_total: parseFloat(products.price) * 1.1,
      p_payment_method: 'cash',
      p_cash_tendered: parseFloat(products.price) * 1.1,
      p_change_given: 0,
      p_customer_id: null,
      p_customer_name: 'Walk-In'
    };

    console.log('💰 Sale details:');
    console.log('   Subtotal: $' + saleData.p_subtotal.toFixed(2));
    console.log('   Tax:      $' + saleData.p_tax_amount.toFixed(2));
    console.log('   Total:    $' + saleData.p_total.toFixed(2));
    console.log('   Method:   cash\n');

    const { data: result, error: rpcError } = await supabase.rpc('create_pos_sale', saleData);

    if (rpcError) {
      console.error('❌ RPC Error:', rpcError.message);
      console.error('   Details:', rpcError.details);
      console.error('   Hint:', rpcError.hint);
      return;
    }

    console.log('✅ Sale completed successfully!');
    console.log('📝 Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
  }
}

testCashSale();
