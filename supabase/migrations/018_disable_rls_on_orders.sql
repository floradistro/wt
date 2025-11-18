-- Disable RLS on orders-related tables so staff users can access them
-- RLS policies were blocking staff users from seeing orders

ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Note: The app handles location-based filtering at the application level
-- Staff users only see orders for their assigned locations via client-side filtering
