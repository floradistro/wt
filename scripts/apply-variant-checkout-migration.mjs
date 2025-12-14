import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzM3NTI3MSwiZXhwIjoyMDQyOTUxMjcxfQ.5lOLhWlg0tYWenVfpXX2-VURs05x2mKGPzZT2TzXZBs'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Read the migration SQL
const migrationSql = fs.readFileSync('supabase/migrations/221_variant_inventory_checkout.sql', 'utf8')

// Split into individual statements (rough split on CREATE OR REPLACE)
const statements = migrationSql
  .split(/(?=CREATE OR REPLACE|GRANT|COMMENT ON)/)
  .filter(s => s.trim().length > 0)
  .map(s => s.trim())

console.log(`Found ${statements.length} statements to execute`)

async function runMigration() {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ')
    console.log(`\n[${i+1}/${statements.length}] Executing: ${preview}...`)

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: stmt })
      if (error) {
        console.error(`Error: ${error.message}`)
        // Try alternative approach - direct query
        console.log('Trying direct approach...')
      } else {
        console.log('✅ Success')
      }
    } catch (e) {
      console.error(`Exception: ${e.message}`)
    }
  }
}

runMigration()
