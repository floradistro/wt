#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

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

async function applyMigration() {
  console.log('🚀 Applying pricing migration...\n')

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '102_bulk_update_product_pricing.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf8')

  console.log('⚡ Creating bulk update function...')

  // Execute SQL using Supabase's edge function or direct query
  const { data, error } = await supabase.rpc('exec', { sql: migrationSql }).single()

  if (error) {
    console.error('❌ Migration failed:', error)
    console.log('\n📋 Please copy and paste this SQL into Supabase SQL Editor:')
    console.log('─'.repeat(80))
    console.log(migrationSql)
    console.log('─'.repeat(80))
    process.exit(1)
  }

  console.log('✅ Migration applied successfully!\n')

  // Verify function exists
  console.log('🔍 Verifying function...')
  const { data: testData, error: testError } = await supabase.rpc('update_products_pricing_from_template', {
    p_category_id: '00000000-0000-0000-0000-000000000000',
    p_vendor_id: '00000000-0000-0000-0000-000000000000',
    p_new_tiers: []
  })

  if (testError && testError.code === 'PGRST202') {
    console.error('❌ Function not accessible via API')
    console.log('\n📋 Manual step required:')
    console.log('1. Go to Supabase Dashboard → SQL Editor')
    console.log('2. Run: NOTIFY pgrst, \'reload schema\';')
    console.log('3. Wait 5 seconds and try again\n')
    process.exit(1)
  }

  console.log('✅ Function is accessible!\n')
  console.log('🎉 Migration completed successfully!')
}

applyMigration().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
