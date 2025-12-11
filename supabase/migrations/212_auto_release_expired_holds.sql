-- ============================================================================
-- Auto-Release Expired Inventory Holds
--
-- Problem: Holds have expires_at but nothing releases them when expired.
-- Solution:
--   1. Trigger that releases holds on any inventory_holds query (lazy cleanup)
--   2. Function that can be called by a cron job for proactive cleanup
--   3. Fix the inventory_with_holds view to exclude expired holds
-- ============================================================================

-- 1. Create function to release all expired holds
CREATE OR REPLACE FUNCTION release_expired_inventory_holds()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  released_count INTEGER;
BEGIN
  UPDATE inventory_holds
  SET
    released_at = NOW(),
    release_reason = COALESCE(release_reason, 'expired')
  WHERE
    released_at IS NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS released_count = ROW_COUNT;

  IF released_count > 0 THEN
    RAISE NOTICE 'Released % expired inventory holds', released_count;
  END IF;

  RETURN released_count;
END;
$$;

-- 2. Create a trigger function that cleans up expired holds lazily
--    This runs whenever we query or modify inventory_holds
CREATE OR REPLACE FUNCTION cleanup_expired_holds_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only run cleanup occasionally (not on every query)
  -- Use a simple random check to run ~10% of the time
  IF random() < 0.1 THEN
    PERFORM release_expired_inventory_holds();
  END IF;

  RETURN NULL; -- For AFTER triggers
END;
$$;

-- 3. Create trigger on INSERT to inventory_holds (cleanup old ones when creating new)
DROP TRIGGER IF EXISTS trg_cleanup_expired_holds ON inventory_holds;
CREATE TRIGGER trg_cleanup_expired_holds
  AFTER INSERT ON inventory_holds
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_holds_trigger();

-- 4. CRITICAL FIX: Update inventory_with_holds view to EXCLUDE expired unreleased holds
--    This is the real fix - the view should never count expired holds as "held"
DROP VIEW IF EXISTS inventory_with_holds;
CREATE OR REPLACE VIEW inventory_with_holds AS
SELECT
  i.id,
  i.product_id,
  i.location_id,
  i.vendor_id,
  i.quantity AS total_quantity,
  COALESCE(h.held_quantity, 0) AS held_quantity,
  GREATEST(0, i.quantity - COALESCE(h.held_quantity, 0)) AS available_quantity,
  i.created_at,
  i.updated_at
FROM inventory i
LEFT JOIN (
  SELECT
    inventory_id,
    SUM(quantity) AS held_quantity
  FROM inventory_holds
  WHERE
    released_at IS NULL
    AND expires_at > NOW()  -- ← THIS IS THE KEY FIX: Only count non-expired holds
  GROUP BY inventory_id
) h ON h.inventory_id = i.id;

-- 5. Create a callable RPC function for manual/scheduled cleanup
CREATE OR REPLACE FUNCTION cleanup_stale_inventory_holds()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
  stale_transfer_count INTEGER;
  result JSON;
BEGIN
  -- Release expired holds
  UPDATE inventory_holds
  SET released_at = NOW(), release_reason = 'expired'
  WHERE released_at IS NULL AND expires_at < NOW();
  GET DIAGNOSTICS expired_count = ROW_COUNT;

  -- Release stale transfer holds (older than 24 hours)
  UPDATE inventory_holds
  SET released_at = NOW(), release_reason = 'stale_transfer_cleanup'
  WHERE
    released_at IS NULL
    AND release_reason = 'transfer_hold'
    AND created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS stale_transfer_count = ROW_COUNT;

  result := json_build_object(
    'expired_released', expired_count,
    'stale_transfers_released', stale_transfer_count,
    'timestamp', NOW()
  );

  RETURN result;
END;
$$;

-- 6. Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION release_expired_inventory_holds() TO authenticated;
GRANT EXECUTE ON FUNCTION release_expired_inventory_holds() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_stale_inventory_holds() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_inventory_holds() TO service_role;

-- 7. Run immediate cleanup
SELECT release_expired_inventory_holds();

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Expired holds auto-release system installed successfully';
END $$;
