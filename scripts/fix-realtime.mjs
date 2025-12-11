#!/usr/bin/env node
/**
 * Fix Realtime Subscriptions
 * Run with: node scripts/fix-realtime.mjs
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRealtime() {
  console.log('🔧 Fixing realtime subscriptions...\n')

  const sql = `
    -- Enable realtime for orders
    DO $$ BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE orders;
      RAISE NOTICE 'Added orders';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Enable realtime for inventory
    DO $$ BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
      RAISE NOTICE 'Added inventory';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Enable realtime for inventory_holds
    DO $$ BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE inventory_holds;
      RAISE NOTICE 'Added inventory_holds';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Enable realtime for pricing_tier_templates
    DO $$ BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE pricing_tier_templates;
      RAISE NOTICE 'Added pricing_tier_templates';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Enable realtime for products
    DO $$ BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE products;
      RAISE NOTICE 'Added products';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Enable realtime for inventory_transfers
    DO $$ BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transfers;
      RAISE NOTICE 'Added inventory_transfers';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- Enable realtime for marketing_campaigns (if exists)
    DO $$ BEGIN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_campaigns') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE marketing_campaigns;
        RAISE NOTICE 'Added marketing_campaigns';
      END IF;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    // exec_sql RPC might not exist, try direct query approach
    console.log('⚠️  exec_sql not available, checking tables manually...\n')
  }

  // Check what tables are in the publication
  const { data: tables, error: tablesError } = await supabase
    .from('pg_publication_tables')
    .select('tablename')
    .eq('pubname', 'supabase_realtime')

  if (tablesError) {
    console.log('⚠️  Cannot query pg_publication_tables directly')
    console.log('\n📋 Please run this SQL in your Supabase SQL Editor:\n')
    console.log('=' .repeat(60))
    console.log(`
-- Check current realtime tables
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Add missing tables (run each one)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_holds;
ALTER PUBLICATION supabase_realtime ADD TABLE pricing_tier_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE marketing_campaigns;
`)
    console.log('=' .repeat(60))
  } else {
    console.log('✅ Tables in supabase_realtime publication:')
    tables?.forEach(t => console.log(`   - ${t.tablename}`))
  }
}

fixRealtime().catch(console.error)
