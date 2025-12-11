/**
 * Set up Database Webhook for real-time customer metrics
 *
 * This creates a webhook that triggers the update-customer-metrics
 * edge function whenever an order status changes.
 */

const SUPABASE_PROJECT_REF = 'uaednwpxursknmwdeejn';
const SUPABASE_ACCESS_TOKEN = 'sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10';

async function setupWebhook() {
  console.log('Setting up Database Webhook for customer metrics...\n');

  // First, check existing webhooks
  const listResponse = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/webhooks`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      },
    }
  );

  if (!listResponse.ok) {
    console.log('Note: Webhooks API may not be available via Management API.');
    console.log('You can set this up via the Supabase Dashboard instead:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/database/hooks');
    console.log('2. Click "Create a new hook"');
    console.log('3. Configure:');
    console.log('   - Name: update_customer_metrics_on_order');
    console.log('   - Table: orders');
    console.log('   - Events: UPDATE (status column)');
    console.log('   - Type: Supabase Edge Function');
    console.log('   - Function: update-customer-metrics');
    console.log('   - HTTP Headers: Content-Type: application/json');
    console.log('\nAlternatively, use this SQL to set up a trigger:\n');

    // Output the SQL approach
    console.log(`
-- Run this in the Supabase SQL Editor:

-- Enable the http extension for making HTTP calls
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function that calls our edge function
CREATE OR REPLACE FUNCTION notify_customer_metrics_update()
RETURNS TRIGGER AS $$
DECLARE
  completed_statuses TEXT[] := ARRAY['completed', 'delivered', 'shipped', 'picked_up'];
BEGIN
  -- Only trigger when status changes to a completed state
  IF NEW.status = ANY(completed_statuses)
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.customer_id IS NOT NULL THEN

    -- Use pg_notify for async processing (lightweight)
    PERFORM pg_notify(
      'customer_metrics_update',
      json_build_object(
        'customer_id', NEW.customer_id,
        'vendor_id', NEW.vendor_id,
        'order_id', NEW.id
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_customer_metrics_on_order ON orders;
CREATE TRIGGER trigger_customer_metrics_on_order
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_metrics_update();
    `);

    return;
  }

  const webhooks = await listResponse.json();
  console.log('Existing webhooks:', webhooks);
}

setupWebhook().catch(console.error);
