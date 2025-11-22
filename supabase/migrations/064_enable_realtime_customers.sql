-- ============================================================================
-- ENABLE REAL-TIME FOR CUSTOMERS TABLE
-- ============================================================================
-- This allows loyalty points and customer data to update instantly across
-- all devices and screens when changes occur.
--
-- Use cases:
-- - Customer earns points at checkout → Balance updates everywhere instantly
-- - Customer redeems points → Balance updates everywhere instantly
-- - Staff adjusts points → Customer sees change immediately
-- - Multi-device scenarios → All devices stay in sync
-- ============================================================================

-- Enable replica identity for customers table
-- FULL = Send all column values in real-time events
ALTER TABLE public.customers REPLICA IDENTITY FULL;

-- Add customers table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;

-- Comment explaining what this does
COMMENT ON TABLE public.customers IS 'Real-time enabled - Loyalty points and customer data update instantly across all devices';
