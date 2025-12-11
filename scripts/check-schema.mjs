const SUPABASE_PROJECT_REF = 'uaednwpxursknmwdeejn';
const SUPABASE_ACCESS_TOKEN = 'sbp_58af2b3d8ab72fa2d9c2950fafcd5cf9477a4b10';

async function checkSchema() {
  // Query table columns
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'customer_segments'
          ORDER BY ordinal_position;
        `
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('Query failed:', response.status, text);
    return;
  }

  const result = await response.json();
  console.log('customer_segments columns:');
  console.log(JSON.stringify(result, null, 2));
}

checkSchema().catch(console.error);
