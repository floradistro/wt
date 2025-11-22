-- Enable real-time replication for deals and loyalty_programs
-- This allows the POS to instantly update when discounts/loyalty are modified in Settings

-- Enable replica identity for deals table (campaigns/discounts)
ALTER TABLE public.deals REPLICA IDENTITY FULL;

-- Enable replica identity for loyalty_programs table
ALTER TABLE public.loyalty_programs REPLICA IDENTITY FULL;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_programs;

-- Comment explaining what this does
COMMENT ON TABLE public.deals IS 'Real-time enabled - POS will instantly update when deals/discounts are modified';
COMMENT ON TABLE public.loyalty_programs IS 'Real-time enabled - POS will instantly update when loyalty programs are modified';
