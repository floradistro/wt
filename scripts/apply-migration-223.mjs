import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const sql = fs.readFileSync('supabase/migrations/223_fix_finalize_stock_movements.sql', 'utf8')

// Split by DROP, CREATE, GRANT
const statements = sql.split(/(?=DROP FUNCTION|CREATE OR REPLACE|GRANT)/).filter(s => s.trim().length > 0)

console.log(`Found ${statements.length} statements`)

async function run() {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    console.log(`\n[${i+1}/${statements.length}] Executing: ${stmt.substring(0, 50)}...`)

    const { data, error } = await supabase.rpc('exec_sql', { sql: stmt })
    if (error) {
      console.log('RPC Error:', error.message)
    } else {
      console.log('Success')
    }
  }
}

run()
