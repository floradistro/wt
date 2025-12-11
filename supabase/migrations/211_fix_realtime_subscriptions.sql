-- ============================================================================
-- Fix Realtime Subscriptions
--
-- This migration ensures all necessary tables have realtime enabled.
-- Run this to fix CHANNEL_ERROR subscription issues.
-- ============================================================================

-- Enable realtime for orders (if not already)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  RAISE NOTICE 'Added orders to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'orders already in realtime publication';
END $$;

-- Enable realtime for inventory
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
  RAISE NOTICE 'Added inventory to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'inventory already in realtime publication';
END $$;

-- Enable realtime for inventory_holds
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory_holds;
  RAISE NOTICE 'Added inventory_holds to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'inventory_holds already in realtime publication';
END $$;

-- Enable realtime for pricing_tier_templates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE pricing_tier_templates;
  RAISE NOTICE 'Added pricing_tier_templates to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'pricing_tier_templates already in realtime publication';
END $$;

-- Enable realtime for products
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
  RAISE NOTICE 'Added products to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'products already in realtime publication';
END $$;

-- Enable realtime for inventory_transfers
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transfers;
  RAISE NOTICE 'Added inventory_transfers to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'inventory_transfers already in realtime publication';
END $$;

-- Enable realtime for inventory_transfer_items
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transfer_items;
  RAISE NOTICE 'Added inventory_transfer_items to realtime publication';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'inventory_transfer_items already in realtime publication';
END $$;

-- Enable realtime for marketing_campaigns (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_campaigns') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE marketing_campaigns;
    RAISE NOTICE 'Added marketing_campaigns to realtime publication';
  ELSE
    RAISE NOTICE 'marketing_campaigns table does not exist - skipping';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'marketing_campaigns already in realtime publication';
END $$;

-- Verify what tables are in the publication
DO $$
DECLARE
  table_list TEXT;
BEGIN
  SELECT string_agg(tablename, ', ' ORDER BY tablename)
  INTO table_list
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime';

  RAISE NOTICE 'Tables in supabase_realtime: %', COALESCE(table_list, 'NONE');
END $$;
