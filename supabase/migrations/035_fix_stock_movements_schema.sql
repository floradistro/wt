-- ============================================================================
-- FIX STOCK_MOVEMENTS TABLE - Add missing columns for checkout flow
-- ============================================================================

-- Add inventory_id column if it doesn't exist
DO $$
BEGIN
  -- Add inventory_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'inventory_id'
  ) THEN
    ALTER TABLE stock_movements ADD COLUMN inventory_id UUID REFERENCES inventory(id);
    RAISE NOTICE 'Added inventory_id column to stock_movements';
  END IF;

  -- Add quantity column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE stock_movements ADD COLUMN quantity NUMERIC NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added quantity column to stock_movements';
  END IF;
END $$;
