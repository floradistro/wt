/**
 * Enable Realtime for Orders Table
 *
 * This enables real-time notifications when new orders are inserted
 * Used for native push notifications to staff when pickup/shipping orders arrive
 */

-- Enable replica identity for realtime to work properly
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Enable realtime on the orders table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
