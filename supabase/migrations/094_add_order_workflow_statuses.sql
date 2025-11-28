/**
 * Add Order Workflow Statuses
 *
 * Expands the orders status constraint to support full workflow statuses
 * for pickup and e-commerce/shipping orders
 *
 * Workflow Statuses:
 * - pending: Order received, awaiting confirmation
 * - confirmed: Order confirmed by staff
 * - preparing: Staff is preparing the order
 * - packing: Order is being packed (e-commerce)
 * - packed: Order packed and ready to ship
 * - ready: Order ready for customer pickup
 * - out_for_delivery: Order out for local delivery
 * - ready_to_ship: Packed and ready to hand to carrier
 * - shipped: Order handed to shipping carrier
 * - in_transit: Order in transit to customer
 * - delivered: Order delivered to customer
 * - completed: Order completed (picked up/delivered)
 * - cancelled: Order cancelled
 */

-- Drop the existing status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint with all workflow statuses
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'preparing',
    'packing',
    'packed',
    'ready',
    'out_for_delivery',
    'ready_to_ship',
    'shipped',
    'in_transit',
    'delivered',
    'completed',
    'cancelled'
  ));
