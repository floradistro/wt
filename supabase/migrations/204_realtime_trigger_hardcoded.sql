-- ============================================================================
-- Real-time Customer Metrics Trigger (Hardcoded URL version)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable pg_net extension (for HTTP requests from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_order_completed_metrics ON orders;
DROP FUNCTION IF EXISTS trigger_update_customer_metrics();

-- Create trigger function with hardcoded values
CREATE OR REPLACE FUNCTION trigger_update_customer_metrics()
RETURNS TRIGGER AS $$
DECLARE
  completed_statuses TEXT[] := ARRAY['completed', 'delivered', 'shipped', 'picked_up'];
  is_now_completed BOOLEAN;
  was_completed BOOLEAN;
  request_id BIGINT;
  supabase_url TEXT := 'https://uaednwpxursknmwdeejn.supabase.co';
  service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';
BEGIN
  -- Check if order just became completed
  is_now_completed := NEW.status = ANY(completed_statuses);
  was_completed := TG_OP = 'UPDATE' AND OLD.status = ANY(completed_statuses);

  -- Only trigger on new completions
  IF is_now_completed AND NOT was_completed AND NEW.customer_id IS NOT NULL THEN
    -- Call Edge Function via pg_net
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/update-customer-metrics',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'customer_id', NEW.customer_id,
        'vendor_id', NEW.vendor_id,
        'order_id', NEW.id,
        'order_type', NEW.order_type,
        'total_amount', NEW.total_amount
      )
    ) INTO request_id;

    -- Log for debugging
    RAISE NOTICE 'Customer metrics update queued: customer=%, request=%', NEW.customer_id, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on orders table
CREATE TRIGGER trigger_order_completed_metrics
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_customer_metrics();

-- Add comment
COMMENT ON TRIGGER trigger_order_completed_metrics ON orders IS
  'Fires when order status changes to completed - updates customer metrics in real-time';
