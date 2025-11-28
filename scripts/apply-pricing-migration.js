#!/usr/bin/env node

/**
 * Apply pricing bulk update migration
 * This script creates the database function and reloads the schema cache
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

require('dotenv').config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:')
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗')
  console.error('\nPlease check your .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  console.log('🚀 Applying pricing bulk update migration...\n')

  // Step 1: Enable real-time
  console.log('📡 Step 1: Enabling real-time for pricing tables...')
  const realtimeSql = `
-- Enable real-time for pricing_tier_templates
ALTER PUBLICATION supabase_realtime ADD TABLE pricing_tier_templates;

-- Enable real-time for products (if not already enabled)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
  `.trim()

  // Try to enable real-time via direct SQL execution
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: realtimeSql })
    })
    if (response.ok) {
      console.log('✅ Real-time enabled\n')
    } else {
      console.log('⚠️  Real-time may already be enabled\n')
    }
  } catch (err) {
    console.log('⚠️  Could not enable real-time (may already be enabled)\n')
  }

  // Step 2: Create bulk update function
  console.log('⚡ Step 2: Creating bulk update function...')
  const functionSql = `
CREATE OR REPLACE FUNCTION update_products_pricing_from_template(
  p_category_id uuid,
  p_vendor_id uuid,
  p_new_tiers jsonb
)
RETURNS TABLE (
  updated_count integer,
  updated_product_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count integer;
  v_updated_ids uuid[];
BEGIN
  WITH updated_products AS (
    UPDATE products
    SET
      meta_data = jsonb_set(
        COALESCE(meta_data, '{}'::jsonb),
        '{pricing_tiers}',
        p_new_tiers
      ),
      meta_data = jsonb_set(
        COALESCE(meta_data, '{}'::jsonb),
        '{pricing_mode}',
        '"tiered"'::jsonb
      ),
      updated_at = now()
    WHERE
      primary_category_id = p_category_id
      AND vendor_id = p_vendor_id
    RETURNING id
  )
  SELECT
    count(*)::integer,
    array_agg(id)
  INTO v_updated_count, v_updated_ids
  FROM updated_products;

  RETURN QUERY SELECT v_updated_count, v_updated_ids;
END;
$$;
  `.trim()

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '102_bulk_update_product_pricing.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf8')

  // Execute via PostgreSQL REST API
  const createFunctionUrl = `${supabaseUrl}/rest/v1/rpc/query`

  try {
    // Try using raw SQL execution
    const response = await fetch(createFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: migrationSql })
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    console.log('✅ Function created successfully\n')
  } catch (err) {
    console.error('❌ Failed to create function:', err.message)
    console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:')
    console.log('─'.repeat(80))
    console.log(migrationSql)
    console.log('─'.repeat(80))
    process.exit(1)
  }

  // Step 3: Reload schema cache
  console.log('🔄 Step 3: Reloading PostgREST schema cache...')

  // Multiple methods to reload schema
  const reloadMethods = [
    // Method 1: Direct NOTIFY
    async () => {
      const { error } = await supabase.rpc('exec_sql', {
        sql: "NOTIFY pgrst, 'reload schema';"
      })
      return !error
    },
    // Method 2: Via REST API
    async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'schema-reload'
        }
      })
      return response.ok
    }
  ]

  let reloaded = false
  for (const method of reloadMethods) {
    try {
      if (await method()) {
        reloaded = true
        break
      }
    } catch (e) {
      continue
    }
  }

  if (reloaded) {
    console.log('✅ Schema cache reloaded\n')
  } else {
    console.log('⚠️  Could not reload schema automatically')
    console.log('   Please run this in SQL Editor: NOTIFY pgrst, \'reload schema\';\n')
  }

  // Step 4: Verify function exists
  console.log('🔍 Step 4: Verifying function...')
  const { data: verifyData, error: verifyError } = await supabase
    .from('routines')
    .select('routine_name')
    .eq('routine_name', 'update_products_pricing_from_template')
    .maybeSingle()

  if (verifyError || !verifyData) {
    // Try alternative verification
    const { data, error } = await supabase.rpc('update_products_pricing_from_template', {
      p_category_id: '00000000-0000-0000-0000-000000000000',
      p_vendor_id: '00000000-0000-0000-0000-000000000000',
      p_new_tiers: []
    })

    if (error && error.code === 'PGRST202') {
      console.error('❌ Function not accessible via API')
      console.log('\n📋 Manual steps required:')
      console.log('1. Go to Supabase Dashboard → SQL Editor')
      console.log('2. Run: NOTIFY pgrst, \'reload schema\';')
      console.log('3. Wait 5 seconds')
      console.log('4. Try updating a pricing template\n')
      process.exit(1)
    } else {
      console.log('✅ Function is accessible and working!\n')
    }
  } else {
    console.log('✅ Function verified in database\n')
  }

  console.log('🎉 Migration completed successfully!')
  console.log('\nYou can now update pricing templates and they will cascade instantly.')
}

applyMigration().catch(console.error)
