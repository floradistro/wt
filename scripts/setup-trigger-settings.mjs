/**
 * Set up database settings for the customer metrics trigger
 * These settings are used by the pg_net extension to call the edge function
 */

const SUPABASE_PROJECT_REF = 'uaednwpxursknmwdeejn';
const SUPABASE_ACCESS_TOKEN = 'sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10';
const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI';

async function runSQL(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function main() {
  console.log('Setting up database configuration for trigger...\n');

  // Set the app settings
  const sql = `
    -- Set app settings for edge function calls from triggers
    ALTER DATABASE postgres SET app.settings.supabase_url = '${SUPABASE_URL}';
    ALTER DATABASE postgres SET app.settings.service_role_key = '${SERVICE_ROLE_KEY}';
  `;

  try {
    await runSQL(sql);
    console.log('Database settings configured successfully!');

    // Verify settings
    console.log('\nVerifying settings...');
    const verifyResult = await runSQL(`
      SELECT current_setting('app.settings.supabase_url', true) as url,
             substring(current_setting('app.settings.service_role_key', true), 1, 20) as key_prefix;
    `);
    console.log('Settings:', JSON.stringify(verifyResult, null, 2));

    console.log('\nTrigger setup complete!');
    console.log('When orders are completed, customer metrics will update automatically.');
  } catch (err) {
    console.error('Error:', err.message);

    // Alternative: Set via vault secrets
    console.log('\nNote: You may need to set these in Supabase Dashboard instead:');
    console.log('1. Go to Database > Extensions > Enable pg_net');
    console.log('2. Go to Edge Functions > Secrets');
    console.log('3. Or use Database Webhooks in the Dashboard');
  }
}

main().catch(console.error);
