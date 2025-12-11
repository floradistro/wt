-- ============================================================================
-- Fix customer_activity RLS policy
--
-- The customers table has a trigger that logs to customer_activity when
-- customers are updated. This policy allows the trigger to write properly.
-- ============================================================================

-- Allow authenticated users to insert into customer_activity
-- (needed for triggers that log customer changes)
DO $$
BEGIN
  -- Check if customer_activity table exists before adding policy
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'customer_activity'
  ) THEN
    -- Drop existing insert policy if it exists
    DROP POLICY IF EXISTS "Allow authenticated inserts to customer_activity" ON customer_activity;

    -- Create policy to allow authenticated users to insert
    CREATE POLICY "Allow authenticated inserts to customer_activity"
      ON customer_activity
      FOR INSERT
      TO authenticated
      WITH CHECK (true);

    -- Also allow service_role full access
    DROP POLICY IF EXISTS "Service role full access to customer_activity" ON customer_activity;
    CREATE POLICY "Service role full access to customer_activity"
      ON customer_activity
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

    RAISE NOTICE 'customer_activity RLS policies created successfully';
  ELSE
    RAISE NOTICE 'customer_activity table does not exist, skipping';
  END IF;
END $$;

-- Alternative: If there's a trigger function, make it SECURITY DEFINER
-- This would bypass RLS entirely for the trigger
DO $$
DECLARE
  trigger_func_name TEXT;
BEGIN
  -- Find triggers on customers table that might write to customer_activity
  FOR trigger_func_name IN
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name LIKE '%customer%activity%'
  LOOP
    EXECUTE format('ALTER FUNCTION %I() SECURITY DEFINER', trigger_func_name);
    RAISE NOTICE 'Made function % SECURITY DEFINER', trigger_func_name;
  END LOOP;
END $$;
