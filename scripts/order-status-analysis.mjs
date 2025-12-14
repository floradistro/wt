import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function analyzeOrderStatuses() {
  // Get all orders
  const { data: orders, error } = await supabase
    .from('orders')
    .select('status, payment_status, fulfillment_status, order_type, total_amount, created_at')
    .eq('vendor_id', vendorId);

  if (error) { console.error(error); return; }

  console.log('=== ORDER STATUS ANALYSIS ===');
  console.log('Total orders:', orders.length);

  // Count by status
  const byStatus = {};
  const byPaymentStatus = {};
  const byFulfillmentStatus = {};

  for (const o of orders) {
    byStatus[o.status || 'null'] = (byStatus[o.status || 'null'] || 0) + 1;
    byPaymentStatus[o.payment_status || 'null'] = (byPaymentStatus[o.payment_status || 'null'] || 0) + 1;
    byFulfillmentStatus[o.fulfillment_status || 'null'] = (byFulfillmentStatus[o.fulfillment_status || 'null'] || 0) + 1;
  }

  console.log('\n=== ORDER STATUS (main) ===');
  for (const [status, count] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`${status}: ${count}`);
  }

  console.log('\n=== PAYMENT STATUS ===');
  for (const [status, count] of Object.entries(byPaymentStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`${status}: ${count}`);
  }

  console.log('\n=== FULFILLMENT STATUS ===');
  for (const [status, count] of Object.entries(byFulfillmentStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`${status}: ${count}`);
  }

  // Revenue by status
  console.log('\n=== REVENUE BY ORDER STATUS ===');
  const revenueByStatus = {};
  for (const o of orders) {
    const s = o.status || 'null';
    if (!revenueByStatus[s]) revenueByStatus[s] = { count: 0, revenue: 0 };
    revenueByStatus[s].count++;
    revenueByStatus[s].revenue += parseFloat(o.total_amount || 0);
  }

  let totalRevenue = 0;
  let completedRevenue = 0;
  for (const [status, data] of Object.entries(revenueByStatus).sort((a, b) => b[1].revenue - a[1].revenue)) {
    const pct = ((data.revenue / orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)) * 100).toFixed(1);
    console.log(`${status.padEnd(15)}: ${String(data.count).padStart(5)} orders | $${data.revenue.toFixed(2).padStart(12)} (${pct}%)`);
    if (status !== 'cancelled') totalRevenue += data.revenue;
    if (status === 'completed') completedRevenue += data.revenue;
  }

  console.log('\n=== ACCOUNTING SUMMARY ===');
  console.log(`Total Revenue (all non-cancelled): $${totalRevenue.toFixed(2)}`);
  console.log(`Completed Revenue ONLY: $${completedRevenue.toFixed(2)}`);
  console.log(`Difference: $${(totalRevenue - completedRevenue).toFixed(2)}`);

  // Check status combinations that might be problematic
  console.log('\n=== POTENTIAL ISSUES ===');

  // Orders with payment_status=paid but status=cancelled
  const paidButCancelled = orders.filter(o => o.payment_status === 'paid' && o.status === 'cancelled');
  console.log(`Paid but cancelled: ${paidButCancelled.length} orders`);

  // Orders with payment_status=pending but status=completed
  const pendingButCompleted = orders.filter(o => o.payment_status === 'pending' && o.status === 'completed');
  console.log(`Pending payment but completed: ${pendingButCompleted.length} orders`);

  // E-commerce orders with various statuses
  console.log('\n=== E-COMMERCE ORDER STATUSES ===');
  const ecomOrders = orders.filter(o => o.order_type === 'shipping' || o.order_type === 'pickup');
  const ecomByStatus = {};
  for (const o of ecomOrders) {
    const s = o.status || 'null';
    if (!ecomByStatus[s]) ecomByStatus[s] = { count: 0, revenue: 0 };
    ecomByStatus[s].count++;
    ecomByStatus[s].revenue += parseFloat(o.total_amount || 0);
  }
  for (const [status, data] of Object.entries(ecomByStatus).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`${status.padEnd(15)}: ${String(data.count).padStart(4)} orders | $${data.revenue.toFixed(2).padStart(10)}`);
  }
}

analyzeOrderStatuses();
