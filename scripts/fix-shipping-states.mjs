import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function fix() {
  // Get all e-commerce orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, shipping_state')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'paid')
    .is('pickup_location_id', null);

  console.log('Total e-commerce orders:', orders?.length);

  let updated = 0;
  let fixed = 0;

  for (const order of orders || []) {
    const state = order.shipping_state;
    let newState = null;

    // Empty states -> NC
    if (!state || state.trim() === '') {
      newState = 'NC';
    }
    // Inconsistent state names
    else if (state === 'Nc' || state === 'NC ' || state === 'North Carolina') {
      newState = 'NC';
    }
    else if (state === 'Al') {
      newState = 'AL';
    }

    if (newState) {
      const { error } = await supabase
        .from('orders')
        .update({ shipping_state: newState })
        .eq('id', order.id);

      if (error) {
        console.log('Error updating', order.id, ':', error.message);
      } else {
        if (!state || state.trim() === '') {
          updated++;
        } else {
          fixed++;
        }
      }
    }
  }

  console.log('Updated', updated, 'empty shipping_state to NC');
  console.log('Fixed', fixed, 'inconsistent state names');

  // Verify
  const { data: check } = await supabase
    .from('orders')
    .select('shipping_state')
    .eq('vendor_id', vendorId)
    .eq('payment_status', 'paid')
    .is('pickup_location_id', null);

  const byState = {};
  for (const o of check || []) {
    const s = o.shipping_state || 'EMPTY';
    byState[s] = (byState[s] || 0) + 1;
  }
  console.log('\nVerification - shipping states now:');
  console.log(byState);
}

fix();
