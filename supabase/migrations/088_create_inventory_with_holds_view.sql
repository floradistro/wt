-- =====================================================
-- CREATE VIEW: inventory_with_holds
-- =====================================================
-- Real-time available inventory calculation
-- Available = Total - Held (unreleased holds)
-- =====================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS inventory_with_holds CASCADE;

-- Create view that calculates available inventory
CREATE VIEW inventory_with_holds AS
SELECT
  i.id,
  i.product_id,
  i.location_id,
  i.vendor_id,
  i.quantity as total_quantity,
  -- Calculate held quantity from unreleased holds
  COALESCE(SUM(h.quantity) FILTER (WHERE h.released_at IS NULL), 0) as held_quantity,
  -- Calculate available quantity (total - held)
  i.quantity - COALESCE(SUM(h.quantity) FILTER (WHERE h.released_at IS NULL), 0) as available_quantity,
  i.created_at,
  i.updated_at
FROM inventory i
LEFT JOIN inventory_holds h ON h.inventory_id = i.id
GROUP BY
  i.id,
  i.product_id,
  i.location_id,
  i.vendor_id,
  i.quantity,
  i.created_at,
  i.updated_at;

-- Grant access
GRANT SELECT ON inventory_with_holds TO authenticated;
GRANT SELECT ON inventory_with_holds TO service_role;

-- Add comment
COMMENT ON VIEW inventory_with_holds IS
'Real-time inventory with hold calculations. available_quantity = total_quantity - held_quantity. Held quantity includes unreleased holds from both POS orders and transfers.';

-- =====================================================
-- Update RLS policy for the view (inherits from base table)
-- =====================================================

-- The view will automatically respect the RLS policies on the inventory table
-- because it's just a query against that table
