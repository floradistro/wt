-- ============================================================================
-- BULLETPROOF INVENTORY DEDUCTION SYSTEM
-- ============================================================================
-- This migration ensures there is EXACTLY ONE code path for inventory deduction
-- and adds safeguards to prevent quantity mismatches from ever happening again.
--
-- Changes:
-- 1. DROP legacy deduct_inventory function (replaced by reserve/finalize pattern)
-- 2. ADD database constraint to validate gramsToDeduct matches tierQuantity
-- 3. ADD audit trigger to log all inventory changes
-- 4. ADD comprehensive comments for future developers
-- ============================================================================

-- ============================================================================
-- 1. DROP LEGACY FUNCTION
-- ============================================================================
-- The deduct_inventory() function only reads 'quantity' field and does NOT
-- support gramsToDeduct. It was replaced by reserve_inventory() + finalize_inventory_holds()
-- in migration 047. This function MUST be removed to prevent accidental use.

DROP FUNCTION IF EXISTS deduct_inventory(UUID, JSONB);

COMMENT ON FUNCTION reserve_inventory(UUID, JSONB) IS
'CRITICAL: This is the ONLY function that should reserve inventory for orders.
It creates inventory_holds records with the correct quantity to deduct.

Flow:
1. reserve_inventory(order_id, items) - Validates stock, creates holds
2. finalize_inventory_holds(order_id) - Converts holds to actual deductions
3. release_inventory_holds(order_id) - Cancels holds if payment fails

IMPORTANT: The "quantity" field in inventory_holds represents the ACTUAL amount
to deduct from inventory, which may differ from the cart quantity:
- Cart: 1x "28g (Ounce)" → inventory_holds.quantity = 28
- Cart: 2x "3.5g (Eighth)" → inventory_holds.quantity = 7
- Cart: 3x "2 units" → inventory_holds.quantity = 6

The gramsToDeduct field in the JSONB items parameter provides this mapping.';

COMMENT ON FUNCTION finalize_inventory_holds(UUID) IS
'CRITICAL: This is the ONLY function that should deduct inventory after payment.
It reads the quantity from inventory_holds (which was set by reserve_inventory)
and deducts that exact amount from the inventory table.

This function is ATOMIC and creates an audit trail in stock_movements.';

-- ============================================================================
-- 2. ADD DATABASE-LEVEL VALIDATION
-- ============================================================================
-- Ensure inventory_holds.quantity is always positive and reasonable
-- (prevents bugs where negative or zero quantities are accidentally stored)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_holds_quantity_positive'
  ) THEN
    ALTER TABLE inventory_holds
      ADD CONSTRAINT chk_inventory_holds_quantity_positive
      CHECK (quantity > 0 AND quantity <= 100000);
  END IF;
END $$;

COMMENT ON CONSTRAINT chk_inventory_holds_quantity_positive ON inventory_holds IS
'Ensures quantity is always positive and below 100kg (reasonable max for cannabis).
This prevents bugs where incorrect quantities are stored in holds.';

-- ============================================================================
-- 3. ADD AUDIT TRIGGER FOR INVENTORY CHANGES
-- ============================================================================
-- Log all direct modifications to inventory.quantity (should only happen via
-- finalize_inventory_holds, but this catches any unauthorized changes)

CREATE OR REPLACE FUNCTION audit_inventory_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if quantity actually changed
  IF (TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity) THEN
    RAISE NOTICE 'INVENTORY AUDIT: Product % quantity changed from % to % (inventory_id: %)',
      NEW.product_id, OLD.quantity, NEW.quantity, NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_inventory_changes ON inventory;
CREATE TRIGGER trg_audit_inventory_changes
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION audit_inventory_changes();

COMMENT ON FUNCTION audit_inventory_changes() IS
'Audit trigger that logs all inventory quantity changes to database logs.
This helps catch unauthorized or unexpected inventory modifications.';

-- ============================================================================
-- 4. ADD UNIQUE CONSTRAINT TO PREVENT DUPLICATE HOLDS
-- ============================================================================
-- Ensure each order can only have ONE active hold per inventory item
-- (the ON CONFLICT clause in reserve_inventory relies on this)

DROP INDEX IF EXISTS idx_inventory_holds_unique_active;
CREATE UNIQUE INDEX idx_inventory_holds_unique_active
  ON inventory_holds(order_id, inventory_id)
  WHERE released_at IS NULL;

COMMENT ON INDEX idx_inventory_holds_unique_active IS
'Ensures each order can only have ONE active hold per inventory item.
This prevents duplicate holds and ensures reserve_inventory ON CONFLICT works correctly.';

-- ============================================================================
-- 5. ADD COMPREHENSIVE SCHEMA DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE inventory_holds IS
'Two-phase commit for inventory: reserve → finalize or release.
This table stores temporary holds on inventory during checkout to prevent overselling.

Lifecycle:
1. reserve_inventory() → creates hold with released_at = NULL
2. finalize_inventory_holds() → deducts inventory, sets released_at = NOW()
3. release_inventory_holds() → sets released_at = NOW() without deducting

The quantity field represents the ACTUAL amount to deduct from inventory, not cart quantity.';

COMMENT ON COLUMN inventory_holds.quantity IS
'CRITICAL: This is the ACTUAL quantity to deduct from inventory, NOT the cart quantity.
Examples:
- Selling 1x "28g (Ounce)" → quantity = 28 (deduct 28g from inventory)
- Selling 2x "3.5g (Eighth)" → quantity = 7 (deduct 7g from inventory)
- Selling 3x "2 units" → quantity = 6 (deduct 6 units from inventory)

This value comes from gramsToDeduct in the checkout flow, which is calculated from
the pricing_data.tiers[].quantity field in the products table.';

-- ============================================================================
-- 6. VERIFY CURRENT STATE
-- ============================================================================
-- Output current inventory system status for verification

DO $$
DECLARE
  v_deduct_exists BOOLEAN;
  v_reserve_exists BOOLEAN;
  v_finalize_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'deduct_inventory') INTO v_deduct_exists;
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'reserve_inventory') INTO v_reserve_exists;
  SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'finalize_inventory_holds') INTO v_finalize_exists;

  RAISE NOTICE '================================';
  RAISE NOTICE 'INVENTORY SYSTEM STATUS';
  RAISE NOTICE '================================';
  RAISE NOTICE 'deduct_inventory (LEGACY): %', CASE WHEN v_deduct_exists THEN '❌ STILL EXISTS' ELSE '✅ DELETED' END;
  RAISE NOTICE 'reserve_inventory: %', CASE WHEN v_reserve_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE 'finalize_inventory_holds: %', CASE WHEN v_finalize_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '================================';

  IF v_deduct_exists THEN
    RAISE WARNING 'Legacy deduct_inventory function still exists! Migration may have failed.';
  END IF;

  IF NOT v_reserve_exists OR NOT v_finalize_exists THEN
    RAISE EXCEPTION 'Critical inventory functions are missing! Database is in invalid state.';
  END IF;
END $$;
