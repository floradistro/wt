#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectSchema() {
  try {
    console.log('\n=== PRODUCT_VARIATIONS SCHEMA ===\n')
    const { data: variations } = await supabase
      .from('product_variations')
      .select('*')
      .limit(1)

    if (variations && variations[0]) {
      Object.keys(variations[0]).forEach(key => {
        console.log(`${key}: ${typeof variations[0][key]}`)
      })
    } else {
      console.log('Table is empty, querying for columns...')
      // Insert dummy row to see columns
      const { error } = await supabase
        .from('product_variations')
        .select('*')
        .limit(0)
      console.log('Columns:', error?.message || 'Could not determine')
    }

    console.log('\n=== PRODUCT_ATTRIBUTES SCHEMA ===\n')
    const { data: attributes } = await supabase
      .from('product_attributes')
      .select('*')
      .limit(1)

    if (attributes && attributes[0]) {
      Object.keys(attributes[0]).forEach(key => {
        console.log(`${key}: ${typeof attributes[0][key]}`)
      })
    } else {
      console.log('Table is empty')
    }

    // Check if variations can reference a parent product
    console.log('\n=== SAMPLE VARIATION DATA ===\n')
    const { data: allVariations } = await supabase
      .from('product_variations')
      .select('*')
      .limit(5)

    console.log(JSON.stringify(allVariations, null, 2))

  } catch (err) {
    console.error('Error:', err.message)
  }
}

inspectSchema()
