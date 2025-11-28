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

async function testPricingUpdate() {
  console.log('🧪 Testing Pricing Update Flow\n')

  // Get a category with products
  const categoryId = '02385a4b-be34-442d-8fb5-accdc15e4e66' // Day Drinker (5mg)
  const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

  console.log('Step 1: Check products BEFORE update...')
  const { data: beforeProducts } = await supabase
    .from('products')
    .select('id, name, meta_data')
    .eq('primary_category_id', categoryId)
    .eq('vendor_id', vendorId)
    .limit(2)

  console.log(`Found ${beforeProducts?.length} products`)
  beforeProducts?.forEach(p => {
    const firstTier = p.meta_data?.pricing_tiers?.[0]
    console.log(`  - ${p.name}: $${firstTier?.price || 'N/A'} for ${firstTier?.qty || 'N/A'}${firstTier?.unit || ''}`)
  })

  console.log('\nStep 2: Update pricing via bulk function...')
  const newTiers = [
    { qty: 1, price: "99.99", label: "1g", weight: "1g", unit: "g", sort_order: 1 },
    { qty: 3.5, price: "299.99", label: "3.5g", weight: "3.5g", unit: "g", sort_order: 2 },
  ]

  const { data: updateResult, error } = await supabase.rpc('update_products_pricing_from_template', {
    p_category_id: categoryId,
    p_vendor_id: vendorId,
    p_new_tiers: newTiers
  })

  if (error) {
    console.error('❌ Update failed:', error)
    if (error.code === 'PGRST202') {
      console.log('\n💡 Function not accessible. Run this in Supabase SQL Editor:')
      console.log('   NOTIFY pgrst, \'reload schema\';')
    }
    process.exit(1)
  }

  console.log(`✅ Updated ${updateResult[0].updated_count} products`)

  console.log('\nStep 3: Verify products AFTER update...')
  const { data: afterProducts } = await supabase
    .from('products')
    .select('id, name, meta_data')
    .eq('primary_category_id', categoryId)
    .eq('vendor_id', vendorId)
    .limit(2)

  let allCorrect = true
  afterProducts?.forEach(p => {
    const firstTier = p.meta_data?.pricing_tiers?.[0]
    const priceMatches = firstTier?.price === "99.99"
    const status = priceMatches ? '✅' : '❌'
    console.log(`  ${status} ${p.name}: $${firstTier?.price || 'N/A'} (expected $99.99)`)
    if (!priceMatches) allCorrect = false
  })

  if (allCorrect) {
    console.log('\n🎉 SUCCESS! Pricing updates are working correctly.')
    console.log('\nNext: Check if POS reflects these changes in real-time.')
  } else {
    console.log('\n⚠️  Products were updated but prices don\'t match expected values.')
    console.log('   Check if tier mapping is correct.')
  }
}

testPricingUpdate().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
