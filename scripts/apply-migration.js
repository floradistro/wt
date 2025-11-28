#!/usr/bin/env node

/**
 * Apply migration to Supabase
 * Usage: node scripts/apply-migration.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Read environment variables
require('dotenv').config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Read migration file
const migrationPath = path.join(__dirname, '../supabase/migrations/095_enable_realtime_for_orders.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

// Execute entire migration as one statement
const statements = [migrationSQL]

async function applyMigration() {
  console.log('🔄 Applying migration: 095_enable_realtime_for_orders.sql')
  console.log(`📦 Found ${statements.length} SQL statements\n`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim()
    if (!statement) continue

    console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement })

      if (error) {
        // Try alternative method - direct query
        const { error: queryError } = await supabase.from('_').select('*').limit(0)

        // Since RPC doesn't exist, we'll use the postgres connection
        console.log('⚠️  RPC method not available, executing via raw SQL...')

        // Execute using the postgres driver
        const pg = require('pg')
        const client = new pg.Client({
          host: 'db.zwcwrwctomlnvyswovhb.supabase.co',
          port: 5432,
          database: 'postgres',
          user: 'postgres',
          password: 'Flipperspender12!!',
          ssl: { rejectUnauthorized: false }
        })

        await client.connect()
        await client.query(statement)
        await client.end()

        console.log(`✅ Statement ${i + 1} executed successfully\n`)
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully\n`)
      }
    } catch (err) {
      console.error(`❌ Failed to execute statement ${i + 1}:`)
      console.error(err.message)
      console.error('\nStatement:')
      console.error(statement)
      process.exit(1)
    }
  }

  console.log('✅ Migration applied successfully!')
}

applyMigration().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
