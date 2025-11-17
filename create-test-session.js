#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createTestSession() {
  console.log('🧪 Creating test cash session...\n');

  try {
    // Get location
    const { data: location } = await supabase
      .from('locations')
      .select('id, name')
      .limit(1)
      .single();

    if (!location) {
      console.error('❌ No location found');
      return;
    }

    // Get user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    if (!users || users.length === 0) {
      console.error('❌ No users found');
      return;
    }

    const sessionNumber = 'SESS-TEST-' + Date.now();

    const { data: session, error } = await supabase
      .from('cash_sessions')
      .insert({
        session_number: sessionNumber,
        location_id: location.id,
        register_id: location.id, // Using location as register since no registers table
        cashier_id: users[0].id,
        opening_cash: 100.00,
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating session:', error.message);
      return;
    }

    console.log('✅ Session created successfully!');
    console.log('   ID:', session.id);
    console.log('   Number:', session.session_number);
    console.log('   Location:', location.name);
    console.log('   Opening cash: $100.00');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestSession();
