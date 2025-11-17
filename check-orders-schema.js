#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkSchema() {
  console.log('🔍 Checking actual database schema...\n');

  try {
    // Get one order to see actual column names
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (orders && orders.length > 0) {
      console.log('📋 Actual orders table columns:');
      Object.keys(orders[0]).sort().forEach(col => {
        console.log('   -', col);
      });
    } else {
      console.log('ℹ️  No orders in table, checking via describe...');
    }

    // Check order_items
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .limit(1);

    if (items && items.length > 0) {
      console.log('\n📋 Actual order_items table columns:');
      Object.keys(items[0]).sort().forEach(col => {
        console.log('   -', col);
      });
    }

    // Check transactions
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);

    if (txns && txns.length > 0) {
      console.log('\n📋 Actual transactions table columns:');
      Object.keys(txns[0]).sort().forEach(col => {
        console.log('   -', col);
      });
    } else {
      console.log('\nℹ️  No transactions in table');
    }

    // Check cash_sessions
    const { data: sessions } = await supabase
      .from('cash_sessions')
      .select('*')
      .limit(1);

    if (sessions && sessions.length > 0) {
      console.log('\n📋 Actual cash_sessions table columns:');
      Object.keys(sessions[0]).sort().forEach(col => {
        console.log('   -', col);
      });
    } else {
      console.log('\nℹ️  No cash_sessions in table');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchema();
