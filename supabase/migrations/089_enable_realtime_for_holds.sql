-- =====================================================
-- ENABLE REALTIME FOR INVENTORY HOLDS
-- =====================================================
-- This allows instant UI updates when holds are created/released
-- =====================================================

-- Enable realtime for inventory_holds table (if not already enabled)
DO $$
BEGIN
  -- Check if inventory_holds is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'inventory_holds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory_holds;
  END IF;
END $$;

-- Enable realtime for inventory table (if not already enabled)
DO $$
BEGIN
  -- Check if inventory is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
  END IF;
END $$;

-- Create indexes for better real-time performance
CREATE INDEX IF NOT EXISTS idx_inventory_holds_inventory_id_unreleased
ON inventory_holds(inventory_id, released_at)
WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_holds_order_id_unreleased
ON inventory_holds(order_id, released_at)
WHERE released_at IS NULL;

COMMENT ON INDEX idx_inventory_holds_inventory_id_unreleased IS
'Optimizes queries for unreleased holds by inventory_id - critical for available inventory calculation';

COMMENT ON INDEX idx_inventory_holds_order_id_unreleased IS
'Optimizes queries for unreleased holds by order_id/transfer_id - used for hold validation';
