-- Enable real-time for pricing_tier_templates table
-- This allows instant propagation of pricing changes across all channels

-- Enable real-time for pricing templates
ALTER PUBLICATION supabase_realtime ADD TABLE pricing_tier_templates;

-- Enable real-time for products (if not already enabled)
DO $$
BEGIN
  -- Try to add products to realtime publication
  -- If it already exists, this will fail silently
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already in publication, do nothing
    NULL;
END $$;

-- Add comment explaining the real-time setup
COMMENT ON TABLE pricing_tier_templates IS 'Real-time enabled for instant pricing updates across all channels';
