#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function inspectTables() {
  try {
    // Get all tables
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .ilike('table_name', '%vari%')

    if (error) {
      // Try querying actual data for clues
      const queries = [
        'product_variations',
        'product_attributes',
        'variations',
        'product_meta'
      ]

      console.log('\n=== CHECKING FOR VARIATION-RELATED TABLES ===\n')

      for (const tableName of queries) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)

        if (!error && data) {
          console.log(`✅ Table EXISTS: ${tableName}`)
          if (data[0]) {
            console.log('Columns:', Object.keys(data[0]).join(', '))
          }
        } else {
          console.log(`❌ Table NOT FOUND: ${tableName}`)
        }
      }

      // Also check if we have products with variations
      console.log('\n=== PRODUCTS WITH VARIATIONS ===\n')
      const { data: productsWithVariations } = await supabase
        .from('products')
        .select('id, name, has_variations, variation_ids, attributes, meta_data')
        .eq('has_variations', true)
        .limit(3)

      if (productsWithVariations && productsWithVariations.length > 0) {
        console.log(`Found ${productsWithVariations.length} products with variations:`)
        console.log(JSON.stringify(productsWithVariations, null, 2))
      } else {
        console.log('No products currently have variations enabled')
      }

    } else {
      console.table(tables)
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

inspectTables()
