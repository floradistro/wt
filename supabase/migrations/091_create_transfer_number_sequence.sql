-- =====================================================
-- CREATE TRANSFER NUMBER SEQUENCE
-- =====================================================

-- Create sequence if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'transfer_number_seq') THEN
    CREATE SEQUENCE transfer_number_seq START 1;
  END IF;
END $$;
