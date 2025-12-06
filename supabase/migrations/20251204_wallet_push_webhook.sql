-- Create webhook trigger function
CREATE OR REPLACE FUNCTION public.trigger_wallet_push_webhook()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the wallet-push edge function via pg_net
  PERFORM net.http_post(
    url := 'https://uaednwpxursknmwdeejn.supabase.co/functions/v1/wallet-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI"}'::jsonb,
    body := '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on wallet_push_queue
DROP TRIGGER IF EXISTS wallet_push_webhook_trigger ON public.wallet_push_queue;
CREATE TRIGGER wallet_push_webhook_trigger
  AFTER INSERT ON public.wallet_push_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_wallet_push_webhook();
