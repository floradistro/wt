-- ============================================
-- Add Missing Email Settings Columns
-- ============================================
-- Adds columns that exist in native app but not in web app migration

-- Add enable_receipts column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_email_settings'
    AND column_name = 'enable_receipts'
  ) THEN
    ALTER TABLE vendor_email_settings
    ADD COLUMN enable_receipts BOOLEAN DEFAULT true;

    RAISE NOTICE 'Added enable_receipts column to vendor_email_settings';
  END IF;
END $$;

-- Add enable_order_updates column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_email_settings'
    AND column_name = 'enable_order_updates'
  ) THEN
    ALTER TABLE vendor_email_settings
    ADD COLUMN enable_order_updates BOOLEAN DEFAULT true;

    RAISE NOTICE 'Added enable_order_updates column to vendor_email_settings';
  END IF;
END $$;

-- Add created_by_user_id and updated_by_user_id columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_email_settings'
    AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE vendor_email_settings
    ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added created_by_user_id column to vendor_email_settings';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_email_settings'
    AND column_name = 'updated_by_user_id'
  ) THEN
    ALTER TABLE vendor_email_settings
    ADD COLUMN updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added updated_by_user_id column to vendor_email_settings';
  END IF;
END $$;
