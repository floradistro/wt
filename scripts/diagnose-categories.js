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

async function diagnoseCategories() {
  console.log('🔍 Diagnosing Categories Issue\n')

  // Step 1: Check categories table
  console.log('Step 1: Checking categories table...')
  const { data: categories, error: catError, count } = await supabase
    .from('categories')
    .select('*', { count: 'exact' })

  if (catError) {
    console.error('❌ Error fetching categories:', catError)
    return
  }

  console.log(`✅ Found ${count} categories in database`)
  console.log(`   Sample: ${categories?.slice(0, 3).map(c => c.name).join(', ')}...\n`)

  // Step 2: Check categories with vendor filter
  const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'
  console.log('Step 2: Checking vendor-specific categories...')
  const { data: vendorCats, error: vendorError } = await supabase
    .from('categories')
    .select('*')
    .or(`vendor_id.is.null,vendor_id.eq.${vendorId}`)
    .order('name', { ascending: true })

  if (vendorError) {
    console.error('❌ Error with vendor filter:', vendorError)
    return
  }

  console.log(`✅ Found ${vendorCats?.length} categories for vendor (including global)`)
  console.log(`   Categories: ${vendorCats?.map(c => c.name).join(', ')}\n`)

  // Step 3: Check if parent_id filter works
  console.log('Step 3: Checking parent_id filter (top-level only)...')
  const { data: topLevel, error: topError } = await supabase
    .from('categories')
    .select('*')
    .or(`vendor_id.is.null,vendor_id.eq.${vendorId}`)
    .is('parent_id', null)
    .order('name', { ascending: true })

  if (topError) {
    console.error('❌ Error with parent_id filter:', topError)
    return
  }

  console.log(`✅ Found ${topLevel?.length} top-level categories`)
  console.log(`   Categories: ${topLevel?.map(c => c.name).join(', ')}\n`)

  // Step 4: Check users table
  console.log('Step 4: Checking users table...')
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, vendor_id, auth_user_id')
    .limit(3)

  if (usersError) {
    console.error('❌ Error fetching users:', usersError)
    return
  }

  console.log(`✅ Found ${users?.length} users`)
  users?.forEach(u => {
    console.log(`   - ${u.email} (vendor: ${u.vendor_id ? '✓' : '✗'}, auth: ${u.auth_user_id ? '✓' : '✗'})`)
  })

  console.log('\n🎉 Diagnosis Complete!')
  console.log('\n📊 Summary:')
  console.log(`   • Total categories: ${count}`)
  console.log(`   • Vendor categories (with global): ${vendorCats?.length}`)
  console.log(`   • Top-level categories: ${topLevel?.length}`)
  console.log(`   • Users in system: ${users?.length}`)
  console.log('\n💡 If categories aren\'t showing in the app:')
  console.log('   1. Check if user is logged in (auth context)')
  console.log('   2. Check browser/app console for errors')
  console.log('   3. Verify vendor_id is set for the logged-in user')
}

diagnoseCategories().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
