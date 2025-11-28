#!/usr/bin/env node

/**
 * Quick script to inspect the products table schema
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectSchema() {
  try {
    // Query the information_schema to get products table columns
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    })

    if (error) {
      // Try direct query instead
      const { data: rawData, error: rawError } = await supabase
        .from('products')
        .select('*')
        .limit(1)

      if (rawError) {
        console.error('Error:', rawError)
        return
      }

      console.log('\n=== PRODUCTS TABLE SCHEMA (from sample row) ===\n')
      if (rawData && rawData[0]) {
        Object.keys(rawData[0]).forEach(key => {
          const value = rawData[0][key]
          const type = typeof value
          console.log(`${key}: ${type}`)
        })
      }
    } else {
      console.log('\n=== PRODUCTS TABLE SCHEMA ===\n')
      console.table(data)
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

inspectSchema()
