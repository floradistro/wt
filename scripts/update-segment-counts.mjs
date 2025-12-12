import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'; // Flora Distro

async function calculateSegmentCounts() {
  // Get all segments
  const { data: segments } = await supabase
    .from('customer_segments')
    .select('*')
    .eq('vendor_id', vendorId);

  console.log(`Found ${segments?.length || 0} segments`);

  // Get all customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, created_at')
    .eq('vendor_id', vendorId);

  console.log(`Found ${customers?.length || 0} customers`);

  // Get all orders with customer_id
  const allOrders = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('orders')
      .select('id, customer_id, created_at, total_amount')
      .eq('vendor_id', vendorId)
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!data || data.length === 0) break;
    allOrders.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Found ${allOrders.length} orders`);

  // Get products with categories
  const { data: products } = await supabase.from('products').select('id, name, primary_category_id');
  const { data: categories } = await supabase.from('categories').select('id, slug');
  const catMap = {};
  categories?.forEach(c => catMap[c.id] = c.slug);
  const productCatMap = {};
  products?.forEach(p => productCatMap[p.id] = catMap[p.primary_category_id] || 'unknown');

  console.log(`Mapped ${Object.keys(productCatMap).length} products to categories`);

  // Get order_items - join order_id to get customer_id
  const allItems = [];
  page = 0;
  while (true) {
    const { data } = await supabase
      .from('order_items')
      .select('order_id, product_id, quantity')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!data || data.length === 0) break;
    allItems.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`Found ${allItems.length} order items`);

  // Map order_id -> customer_id
  const orderToCustomer = {};
  allOrders.forEach(o => orderToCustomer[o.id] = o.customer_id);

  // Build customer profiles
  const customerProfiles = {};
  const now = new Date();

  customers?.forEach(c => {
    customerProfiles[c.id] = {
      total_spent: 0,
      order_count: 0,
      first_order: null,
      last_order: null,
      category_counts: {},
      customer_created: new Date(c.created_at),
    };
  });

  // Process orders
  allOrders.forEach(o => {
    if (!customerProfiles[o.customer_id]) return;
    const profile = customerProfiles[o.customer_id];
    profile.total_spent += o.total_amount || 0;
    profile.order_count++;
    const orderDate = new Date(o.created_at);
    if (!profile.first_order || orderDate < profile.first_order) profile.first_order = orderDate;
    if (!profile.last_order || orderDate > profile.last_order) profile.last_order = orderDate;
  });

  // Process order items for category affinity
  allItems.forEach(item => {
    const customerId = orderToCustomer[item.order_id];
    if (!customerId || !customerProfiles[customerId]) return;
    const category = productCatMap[item.product_id] || 'unknown';
    const profile = customerProfiles[customerId];
    profile.category_counts[category] = (profile.category_counts[category] || 0) + (item.quantity || 1);
  });

  // Show some sample profiles
  const sampleProfiles = Object.entries(customerProfiles).slice(0, 3);
  console.log('\nSample customer profiles:');
  sampleProfiles.forEach(([id, p]) => {
    console.log(`  ${id}: ${p.order_count} orders, $${Math.round(p.total_spent)}, categories:`, p.category_counts);
  });

  // Count customers with orders
  const customersWithOrders = Object.values(customerProfiles).filter(p => p.order_count > 0).length;
  console.log(`\nCustomers with orders: ${customersWithOrders}`);

  // Calculate counts for each segment
  for (const segment of segments || []) {
    let count = 0;
    const rules = segment.segment_rules;

    for (const [customerId, profile] of Object.entries(customerProfiles)) {
      let matches = false;

      // Product affinity segments
      if (rules.category_slug) {
        const totalItems = Object.values(profile.category_counts).reduce((a, b) => a + b, 0);
        const categoryItems = profile.category_counts[rules.category_slug] || 0;
        const affinity = totalItems > 0 ? categoryItems / totalItems : 0;
        // 20% affinity threshold and at least 1 order
        matches = affinity >= 0.2 && profile.order_count >= 1;
      }
      // VIP: total_spent >= 500
      else if (rules.metric === 'total_spent') {
        matches = profile.total_spent >= 500;
      }
      // At Risk: 30-90 days since last order
      else if (rules.metric === 'days_since_last_order' && profile.last_order) {
        const daysSince = Math.floor((now - profile.last_order) / (1000 * 60 * 60 * 24));
        matches = daysSince >= rules.range[0] && daysSince <= rules.range[1];
      }
      // New Customers: first order within 30 days
      else if (rules.metric === 'days_since_first_order' && profile.first_order) {
        const daysSince = Math.floor((now - profile.first_order) / (1000 * 60 * 60 * 24));
        matches = daysSince <= rules.max;
      }
      // Weekly Regulars: order frequency <= 7 days
      else if (rules.metric === 'order_frequency_days') {
        if (profile.order_count >= 2 && profile.first_order && profile.last_order) {
          const daysBetween = Math.floor((profile.last_order - profile.first_order) / (1000 * 60 * 60 * 24));
          const avgFrequency = daysBetween / (profile.order_count - 1);
          matches = avgFrequency <= rules.max;
        }
      }

      if (matches) count++;
    }

    // Update segment count
    await supabase
      .from('customer_segments')
      .update({ customer_count: count })
      .eq('id', segment.id);

    console.log(`${segment.name}: ${count} customers`);
  }
}

calculateSegmentCounts().catch(console.error);
