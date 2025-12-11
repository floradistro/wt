-- ============================================================================
-- Real-time Customer Metrics Trigger
--
-- Automatically updates customer metrics when orders are completed.
-- Uses pg_net extension to call Edge Function in real-time.
-- ============================================================================

-- Enable pg_net extension (for HTTP requests from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ===========================================
-- FUNCTION: Trigger to update customer metrics
-- Called when order status changes to completed
-- ===========================================
CREATE OR REPLACE FUNCTION trigger_update_customer_metrics()
RETURNS TRIGGER AS $$
DECLARE
  completed_statuses TEXT[] := ARRAY['completed', 'delivered', 'shipped', 'picked_up'];
  is_now_completed BOOLEAN;
  was_completed BOOLEAN;
  request_id BIGINT;
BEGIN
  -- Check if order just became completed
  is_now_completed := NEW.status = ANY(completed_statuses);
  was_completed := TG_OP = 'UPDATE' AND OLD.status = ANY(completed_statuses);

  -- Only trigger on new completions
  IF is_now_completed AND NOT was_completed AND NEW.customer_id IS NOT NULL THEN
    -- Call Edge Function via pg_net
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/update-customer-metrics',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'customer_id', NEW.customer_id,
        'vendor_id', NEW.vendor_id,
        'order_id', NEW.id,
        'order_type', NEW.order_type,
        'total_amount', NEW.total_amount
      )
    ) INTO request_id;

    -- Log for debugging (optional)
    RAISE NOTICE 'Customer metrics update queued: customer=%, request=%', NEW.customer_id, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Create the trigger on orders table
-- ===========================================
DROP TRIGGER IF EXISTS trigger_order_completed_metrics ON orders;

CREATE TRIGGER trigger_order_completed_metrics
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_customer_metrics();

-- ===========================================
-- Alternative: Simple trigger for when pg_net isn't available
-- Uses the compute function directly (synchronous, slower)
-- ===========================================
CREATE OR REPLACE FUNCTION trigger_update_customer_metrics_sync()
RETURNS TRIGGER AS $$
DECLARE
  completed_statuses TEXT[] := ARRAY['completed', 'delivered', 'shipped', 'picked_up'];
  is_now_completed BOOLEAN;
  was_completed BOOLEAN;
BEGIN
  is_now_completed := NEW.status = ANY(completed_statuses);
  was_completed := TG_OP = 'UPDATE' AND OLD.status = ANY(completed_statuses);

  -- Only trigger on new completions
  IF is_now_completed AND NOT was_completed AND NEW.customer_id IS NOT NULL THEN
    -- Update metrics synchronously (fallback if pg_net unavailable)
    PERFORM compute_customer_metrics(NEW.vendor_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Set up app.settings for Edge Function URL
-- (These need to be set in Supabase dashboard or via SQL)
-- ===========================================
-- Note: In production, set these via Supabase dashboard:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

COMMENT ON FUNCTION trigger_update_customer_metrics IS
  'Async trigger that calls Edge Function to update customer metrics when order completes';

COMMENT ON TRIGGER trigger_order_completed_metrics ON orders IS
  'Fires when order status changes to completed/delivered/shipped/picked_up';
