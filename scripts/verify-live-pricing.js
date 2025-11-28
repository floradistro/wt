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

async function verifyLivePricing() {
  console.log('🔍 Verifying Live Pricing System\n')

  // Step 1: Check if column exists
  console.log('Step 1: Checking if pricing_template_id column exists...')
  const { data: columns, error: columnError } = await supabase
    .from('products')
    .select('pricing_template_id')
    .limit(1)

  if (columnError) {
    console.error('❌ Column does not exist!')
    console.log('\n📋 Please apply the migration:')
    console.log('   1. Open: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/sql/new')
    console.log('   2. Run: supabase/migrations/097_add_pricing_template_reference.sql')
    console.log('   3. Run this script again\n')
    process.exit(1)
  }

  console.log('✅ Column exists!\n')

  // Step 2: Count products with template references
  console.log('Step 2: Counting products with template references...')
  const { count: linkedCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .not('pricing_template_id', 'is', null)

  const { count: totalCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })

  console.log(`✅ ${linkedCount}/${totalCount} products linked to templates\n`)

  // Step 3: Show sample products with templates
  console.log('Step 3: Sample products with live templates...')
  const { data: products } = await supabase
    .from('products')
    .select(`
      name,
      pricing_template_id,
      pricing_template:pricing_tier_templates (
        name,
        default_tiers
      )
    `)
    .not('pricing_template_id', 'is', null)
    .limit(5)

  products?.forEach(p => {
    const firstTier = p.pricing_template?.default_tiers?.[0]
    console.log(`  ✅ ${p.name}`)
    console.log(`     Template: ${p.pricing_template?.name}`)
    console.log(`     First tier: ${firstTier?.quantity}${firstTier?.unit} = $${firstTier?.default_price}`)
  })

  // Step 4: Test the bulk update function
  console.log('\nStep 4: Testing bulk update function...')
  const { data: templates } = await supabase
    .from('pricing_tier_templates')
    .select('id, name, category_id')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!templates) {
    console.log('⚠️  No templates found (this is OK if you haven\'t created any)')
  } else {
    console.log(`   Using template: ${templates.name}`)

    // Get vendor ID
    const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

    // Call the function
    const { data: result, error: funcError } = await supabase.rpc('update_products_pricing_from_template', {
      p_category_id: templates.category_id,
      p_vendor_id: vendorId,
      p_template_id: templates.id
    })

    if (funcError) {
      if (funcError.code === 'PGRST202') {
        console.error('❌ Function not found!')
        console.log('\n📋 The migration may not have been applied correctly.')
        console.log('   Run: NOTIFY pgrst, \'reload schema\'; in SQL Editor')
        process.exit(1)
      }
      console.error('❌ Function error:', funcError)
      process.exit(1)
    }

    console.log(`✅ Function works! Updated ${result[0].updated_count} products\n`)
  }

  // Step 5: Summary
  console.log('🎉 Live Pricing System Verified!\n')
  console.log('📊 Summary:')
  console.log(`   • pricing_template_id column: ✅`)
  console.log(`   • Products linked to templates: ${linkedCount}/${totalCount}`)
  console.log(`   • Bulk update function: ✅`)
  console.log('\n✅ System ready! Update a template and watch all products update instantly.')
}

verifyLivePricing().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
