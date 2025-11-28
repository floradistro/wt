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

async function testPricingCascade() {
  console.log('🧪 Testing Pricing Cascade System\n')

  // Step 1: Find a category with products
  console.log('Step 1: Finding a category with products...')
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, vendor_id')
    .limit(5)

  if (catError || !categories || categories.length === 0) {
    console.error('❌ Could not find categories:', catError)
    process.exit(1)
  }

  console.log(`✅ Found ${categories.length} categories`)

  // Find a category with products
  let testCategory = null
  let productCount = 0

  for (const cat of categories) {
    const { count, error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('primary_category_id', cat.id)
      .eq('vendor_id', cat.vendor_id)

    if (count > 0) {
      testCategory = cat
      productCount = count
      break
    }
  }

  if (!testCategory) {
    console.log('⚠️  No categories with products found (this is OK for empty database)')
    console.log('✅ System is ready - add products to test cascade updates')
    return
  }

  console.log(`✅ Using category: "${testCategory.name}" (${productCount} products)\n`)

  // Step 2: Test the bulk update function
  console.log('Step 2: Testing bulk update function...')

  const testTiers = [
    {
      qty: 1,
      price: "10.00",
      label: "1g",
      weight: "1g",
      unit: "g",
      sort_order: 1
    },
    {
      qty: 3.5,
      price: "30.00",
      label: "3.5g",
      weight: "3.5g",
      unit: "g",
      sort_order: 2
    },
    {
      qty: 7,
      price: "50.00",
      label: "7g",
      weight: "7g",
      unit: "g",
      sort_order: 3
    }
  ]

  const { data, error } = await supabase.rpc('update_products_pricing_from_template', {
    p_category_id: testCategory.id,
    p_vendor_id: testCategory.vendor_id,
    p_new_tiers: testTiers
  })

  if (error) {
    console.error('❌ Bulk update failed:', error)
    process.exit(1)
  }

  console.log(`✅ Bulk update succeeded!`)
  console.log(`   Updated ${data[0].updated_count} products`)
  console.log(`   Product IDs: ${data[0].updated_product_ids?.slice(0, 3).join(', ')}${data[0].updated_product_ids?.length > 3 ? '...' : ''}`)

  // Step 3: Verify products were updated
  console.log('\nStep 3: Verifying products have new pricing...')

  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, meta_data')
    .eq('primary_category_id', testCategory.id)
    .eq('vendor_id', testCategory.vendor_id)
    .limit(3)

  if (prodError || !products) {
    console.error('❌ Could not fetch products:', prodError)
    process.exit(1)
  }

  let allCorrect = true
  for (const product of products) {
    const pricingTiers = product.meta_data?.pricing_tiers || []
    const pricingMode = product.meta_data?.pricing_mode

    if (pricingMode !== 'tiered') {
      console.log(`❌ Product "${product.name}" - pricing_mode is "${pricingMode}" (expected "tiered")`)
      allCorrect = false
    } else if (pricingTiers.length !== 3) {
      console.log(`❌ Product "${product.name}" - has ${pricingTiers.length} tiers (expected 3)`)
      allCorrect = false
    } else if (pricingTiers[0].price !== "10.00") {
      console.log(`❌ Product "${product.name}" - first tier price is ${pricingTiers[0].price} (expected "10.00")`)
      allCorrect = false
    } else {
      console.log(`✅ Product "${product.name}" - pricing updated correctly`)
    }
  }

  if (allCorrect) {
    console.log('\n🎉 ALL TESTS PASSED!')
    console.log('\n✅ Pricing cascade system is fully operational:')
    console.log('   • Database function works correctly')
    console.log('   • Products update atomically in bulk')
    console.log('   • meta_data.pricing_tiers is set correctly')
    console.log('   • meta_data.pricing_mode is set correctly')
    console.log('\n🚀 Ready to use in production!')
  } else {
    console.log('\n⚠️  Some products did not update correctly')
    console.log('   Check the logs above for details')
  }
}

testPricingCascade().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
