-- ============================================================================
-- ENABLE REALTIME FOR INVENTORY (Instant Updates)
-- ============================================================================
-- This migration enables Supabase Realtime for inventory table so that
-- inventory quantity updates are instantly reflected across all connected
-- clients without requiring page refresh.
--
-- Use case:
-- - POS sale completes → Inventory updates → All product cards update instantly
-- - Manual adjustment → Inventory updates → All screens reflect new quantity
-- - Purchase order received → Inventory updates → Stock levels update live
-- ============================================================================

-- Enable Realtime for inventory table
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Enable Realtime for inventory_holds (optional - useful for debugging)
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory_holds;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Enable Realtime for stock_movements (optional - for audit screens)
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMENT ON TABLE inventory IS
'Inventory tracking by location. REALTIME ENABLED for instant updates across all clients.
When quantity changes, all connected POS terminals and product screens will update automatically.';

-- Verify Realtime is enabled
DO $$
DECLARE
  v_inventory_realtime BOOLEAN;
  v_holds_realtime BOOLEAN;
  v_movements_realtime BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory'
  ) INTO v_inventory_realtime;

  SELECT EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_holds'
  ) INTO v_holds_realtime;

  SELECT EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stock_movements'
  ) INTO v_movements_realtime;

  RAISE NOTICE '================================';
  RAISE NOTICE 'REALTIME STATUS';
  RAISE NOTICE '================================';
  RAISE NOTICE 'inventory: %', CASE WHEN v_inventory_realtime THEN '✅ ENABLED' ELSE '❌ DISABLED' END;
  RAISE NOTICE 'inventory_holds: %', CASE WHEN v_holds_realtime THEN '✅ ENABLED' ELSE '❌ DISABLED' END;
  RAISE NOTICE 'stock_movements: %', CASE WHEN v_movements_realtime THEN '✅ ENABLED' ELSE '❌ DISABLED' END;
  RAISE NOTICE '================================';

  IF NOT v_inventory_realtime THEN
    RAISE EXCEPTION 'Failed to enable Realtime for inventory table';
  END IF;
END $$;
