-- Add set_config function for setting session variables
-- This is needed for RLS policies that use current_setting()

CREATE OR REPLACE FUNCTION public.set_config(
  setting_name text,
  setting_value text,
  is_local boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the configuration parameter
  -- is_local = true means it only applies to the current transaction
  -- is_local = false means it applies to the entire session
  PERFORM pg_catalog.set_config(setting_name, setting_value, is_local);

  RETURN setting_value;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.set_config(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_config(text, text, boolean) TO anon;

-- Add comment
COMMENT ON FUNCTION public.set_config IS 'Sets a configuration parameter for the current session or transaction. Used for RLS policies that check current_setting().';
