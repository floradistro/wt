#!/usr/bin/env node
/**
 * Apply the routing migration directly via Supabase SQL API
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyMigration() {
  console.log('📦 Applying routing optimization migration...\n')

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/121_optimize_shipping_routing.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('SQL to execute:\n', sql.substring(0, 500) + '...\n')

  // Execute via RPC - we need to use a different approach
  // Supabase doesn't have a direct SQL execute endpoint for clients
  // We'll use the postgres function approach

  // First, let's check if the function already exists
  const { data: existingFunc, error: checkError } = await supabase
    .rpc('route_order_to_locations', { p_order_id: '00000000-0000-0000-0000-000000000000' })
    .maybeSingle()

  if (checkError && !checkError.message.includes('not found')) {
    console.log('Current function status:', checkError.message)
  }

  console.log('\n⚠️  The migration SQL needs to be applied directly to the database.')
  console.log('Please run this SQL in the Supabase SQL Editor at:')
  console.log(`${SUPABASE_URL.replace('.co', '.co/project/uaednwpxursknmwdeejn/sql/new')}\n`)
  console.log('Or use psql:\n')
  console.log(`psql "postgresql://postgres:[PASSWORD]@db.uaednwpxursknmwdeejn.supabase.co:5432/postgres" -f "${migrationPath}"`)
}

applyMigration().catch(console.error)
