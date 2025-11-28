#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

require('dotenv').config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verifyMigration() {
  console.log('🔍 Verifying migration...\n')

  // Test 1: Check if function exists and is accessible
  console.log('Test 1: Checking if function is accessible via API...')
  const { data, error } = await supabase.rpc('update_products_pricing_from_template', {
    p_category_id: '00000000-0000-0000-0000-000000000000',
    p_vendor_id: '00000000-0000-0000-0000-000000000000',
    p_new_tiers: []
  })

  if (error) {
    if (error.code === 'PGRST202') {
      console.error('❌ Function NOT found!')
      console.log('\n📋 Next steps:')
      console.log('1. Go to: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/sql/new')
      console.log('2. Copy the contents of: supabase/migrations/APPLY_THIS_NOW.sql')
      console.log('3. Paste into SQL Editor and click "RUN"')
      console.log('4. Wait 5 seconds, then run this script again\n')
      process.exit(1)
    } else {
      console.error('❌ Unexpected error:', error)
      process.exit(1)
    }
  }

  console.log('✅ Function exists and is accessible!')
  console.log(`   Updated ${data?.[0]?.updated_count || 0} products (expected 0 for test UUIDs)`)

  console.log('\n🎉 Migration verified successfully!')
  console.log('\nYou can now:')
  console.log('• Update pricing templates in Categories')
  console.log('• Changes will cascade instantly to all products')
  console.log('• Real-time sync will update all POS terminals')
}

verifyMigration().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
