const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTcyMzMsImV4cCI6MjA3NjU3MzIzM30.N8jPwlyCBB5KJB5I-XaK6m-mq88rSR445AWFJJmwRCg'
);

async function checkSchema() {
  // Try to query payment_processors with a limit to see if table exists
  const { data, error } = await supabase
    .from('payment_processors')
    .select('*')
    .limit(1);
  
  console.log('Table exists:', !error);
  if (error) {
    console.log('Error:', error.message);
  }
  
  // Check locations table
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('id', '4d0685cc-6dfd-4c2e-a640-d8cfd4080975');
  
  console.log('\nBlowing Rock location:', locations);
  
  // Check registers table
  const { data: registers } = await supabase
    .from('pos_registers')
    .select('id, name, payment_processor_id')
    .eq('location_id', '4d0685cc-6dfd-4c2e-a640-d8cfd4080975');
  
  console.log('\nRegisters at Blowing Rock:', registers);
}

checkSchema().then(() => process.exit(0));
