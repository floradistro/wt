-- Fix purchase_order_items table to ensure all required columns exist
-- This is a fixup migration in case the original migration didn't apply cleanly

-- Add received_quantity column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items'
    AND column_name = 'received_quantity'
  ) THEN
    ALTER TABLE purchase_order_items
    ADD COLUMN received_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add condition column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items'
    AND column_name = 'condition'
  ) THEN
    ALTER TABLE purchase_order_items
    ADD COLUMN condition TEXT CHECK (condition IN ('good', 'damaged', 'expired', 'rejected'));
  END IF;
END $$;

-- Add quality_notes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items'
    AND column_name = 'quality_notes'
  ) THEN
    ALTER TABLE purchase_order_items
    ADD COLUMN quality_notes TEXT;
  END IF;
END $$;
