import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function createSegments() {
  // Get vendor ID - use Flora Distro which has the most data
  const { data: vendors } = await supabase.from('vendors').select('id, store_name').eq('store_name', 'Flora Distro').limit(1);
  if (!vendors || vendors.length === 0) {
    console.error('No vendor found');
    return;
  }
  const vendorId = vendors[0].id;
  console.log('Creating segments for vendor:', vendors[0].store_name, '(', vendorId, ')');

  // Get category IDs
  const { data: categories } = await supabase.from('categories').select('id, name, slug');
  const catMap = {};
  categories?.forEach(c => catMap[c.slug] = c.id);
  console.log('Categories:', Object.keys(catMap));

  // Define product-based segments (no segment_type field - doesn't exist in schema)
  const segments = [
    // Product Affinity Segments
    {
      vendor_id: vendorId,
      name: 'Flower Lovers',
      description: 'Customers who primarily buy flower products',
      filter_criteria: { category_affinity: { flower: { min: 0.5 } } },
      segment_rules: { category_slug: 'flower', min_orders: 2 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 100,
      color: '#10B981', // Green
      icon: 'leaf',
      ai_description: 'These customers love flower. Target them with new strains, bulk deals, and harvest announcements.',
      targeting_tips: ['New strain arrivals', 'Bulk flower deals', 'Terpene profile highlights'],
    },
    {
      vendor_id: vendorId,
      name: 'Vape Enthusiasts',
      description: 'Customers who prefer disposable vapes',
      filter_criteria: { category_affinity: { vape: { min: 0.3 } } },
      segment_rules: { category_slug: 'vape', min_orders: 1 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 90,
      color: '#8B5CF6', // Purple
      icon: 'cloud',
      ai_description: 'Vape lovers prefer convenience and discretion. Target them with new flavors and portable options.',
      targeting_tips: ['New vape flavors', 'Portable/discreet options', 'Battery life promotions'],
    },
    {
      vendor_id: vendorId,
      name: 'Edible Fans',
      description: 'Customers who enjoy edibles and gummies',
      filter_criteria: { category_affinity: { edibles: { min: 0.3 } } },
      segment_rules: { category_slug: 'edibles', min_orders: 1 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 80,
      color: '#F59E0B', // Amber
      icon: 'nutrition',
      ai_description: 'Edible fans prefer smokeless options. Target them with new flavors, dosing guides, and variety packs.',
      targeting_tips: ['New gummy flavors', 'Dosage variety packs', 'Baked goods specials'],
    },
    {
      vendor_id: vendorId,
      name: 'Beverage Lovers',
      description: 'Customers who buy THC beverages',
      filter_criteria: { category_affinity: { beverages: { min: 0.2 } } },
      segment_rules: { category_slug: 'beverages', min_orders: 1 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 70,
      color: '#06B6D4', // Cyan
      icon: 'beer',
      ai_description: 'Beverage customers enjoy social, drinkable options. Perfect for party packs and new flavor drops.',
      targeting_tips: ['New drink flavors', 'Party pack deals', 'Low-dose social options'],
    },
    {
      vendor_id: vendorId,
      name: 'Concentrate Connoisseurs',
      description: 'Customers who buy concentrates and extracts',
      filter_criteria: { category_affinity: { concentrates: { min: 0.3 } } },
      segment_rules: { category_slug: 'concentrates', min_orders: 1 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 60,
      color: '#EC4899', // Pink
      icon: 'flame',
      ai_description: 'Concentrate lovers are experienced users seeking potency. Target with premium extracts and dabbing accessories.',
      targeting_tips: ['Premium extracts', 'High potency options', 'Dabbing accessories'],
    },
    // Behavioral Segments
    {
      vendor_id: vendorId,
      name: 'VIP Customers',
      description: 'Top 10% spenders - your most valuable customers',
      filter_criteria: { total_spent: { min: 500 } },
      segment_rules: { metric: 'total_spent', percentile: 90 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 200,
      color: '#FFD700', // Gold
      icon: 'star',
      ai_description: 'Your most valuable customers. Give them VIP treatment with exclusive offers and early access.',
      targeting_tips: ['Exclusive early access', 'VIP-only deals', 'Personalized recommendations'],
    },
    {
      vendor_id: vendorId,
      name: 'At Risk',
      description: 'Previously active customers who have not ordered recently',
      filter_criteria: { days_since_last_order: { min: 30, max: 90 } },
      segment_rules: { metric: 'days_since_last_order', range: [30, 90] },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 150,
      color: '#EF4444', // Red
      icon: 'warning',
      ai_description: 'These customers are slipping away. Win them back with personalized offers and we miss you campaigns.',
      targeting_tips: ['Win-back offers', 'Personalized discounts', 'New product highlights'],
    },
    {
      vendor_id: vendorId,
      name: 'New Customers',
      description: 'Customers who joined in the last 30 days',
      filter_criteria: { days_since_first_order: { max: 30 } },
      segment_rules: { metric: 'days_since_first_order', max: 30 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 120,
      color: '#3B82F6', // Blue
      icon: 'person-add',
      ai_description: 'Fresh customers need nurturing. Welcome them with educational content and first-time buyer deals.',
      targeting_tips: ['Welcome series', 'Product education', 'Second purchase incentives'],
    },
    {
      vendor_id: vendorId,
      name: 'Weekly Regulars',
      description: 'Customers who order at least once per week',
      filter_criteria: { order_frequency_days: { max: 7 } },
      segment_rules: { metric: 'order_frequency_days', max: 7 },
      is_system: true,
      is_dynamic: true,
      is_active: true,
      priority: 110,
      color: '#22C55E', // Green
      icon: 'calendar',
      ai_description: 'Your most frequent visitors. Reward their loyalty with exclusive perks and early notifications.',
      targeting_tips: ['Loyalty rewards', 'Early restock alerts', 'Exclusive previews'],
    },
  ];

  // Delete existing segments for clean slate
  const { error: deleteError } = await supabase
    .from('customer_segments')
    .delete()
    .eq('vendor_id', vendorId);

  if (deleteError) {
    console.error('Error deleting existing segments:', deleteError);
  }

  // Insert segments
  const { data, error } = await supabase
    .from('customer_segments')
    .insert(segments)
    .select();

  if (error) {
    console.error('Error creating segments:', error);
    return;
  }

  console.log(`\nCreated ${data.length} segments:`);
  data.forEach(s => {
    console.log(`  - ${s.name} (${s.color})`);
  });

  // Now calculate customer counts for each segment
  console.log('\nCalculating segment counts...');
  await calculateSegmentCounts(vendorId, data);
}

async function calculateSegmentCounts(vendorId, segments) {
  // Get all customer order data
  const { data: customers } = await supabase
    .from('customers')
    .select('id, created_at')
    .eq('vendor_id', vendorId);

  // Get order summaries per customer
  const allOrders = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('customer_id, created_at, total')
      .eq('vendor_id', vendorId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;
    allOrders.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  // Get order items with categories
  const allItems = [];
  page = 0;

  while (true) {
    const { data, error } = await supabase
      .from('order_items')
      .select('product_id, quantity, line_total, orders!inner(customer_id, vendor_id)')
      .eq('orders.vendor_id', vendorId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) break;
    allItems.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  // Get products with categories
  const { data: products } = await supabase
    .from('products')
    .select('id, name, primary_category_id');

  const { data: categories } = await supabase.from('categories').select('id, slug');
  const catMap = {};
  categories?.forEach(c => catMap[c.id] = c.slug);
  const productCatMap = {};
  products?.forEach(p => productCatMap[p.id] = catMap[p.primary_category_id] || 'unknown');

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
    };
  });

  // Process orders
  allOrders.forEach(o => {
    if (!customerProfiles[o.customer_id]) return;
    const profile = customerProfiles[o.customer_id];
    profile.total_spent += o.total || 0;
    profile.order_count++;
    const orderDate = new Date(o.created_at);
    if (!profile.first_order || orderDate < profile.first_order) profile.first_order = orderDate;
    if (!profile.last_order || orderDate > profile.last_order) profile.last_order = orderDate;
  });

  // Process order items for category affinity
  allItems.forEach(item => {
    const customerId = item.orders?.customer_id;
    if (!customerId || !customerProfiles[customerId]) return;
    const category = productCatMap[item.product_id] || 'unknown';
    const profile = customerProfiles[customerId];
    profile.category_counts[category] = (profile.category_counts[category] || 0) + (item.quantity || 1);
  });

  // Calculate segment counts
  for (const segment of segments) {
    let count = 0;
    const rules = segment.segment_rules;

    for (const [customerId, profile] of Object.entries(customerProfiles)) {
      let matches = false;

      // Product affinity segments
      if (rules.category_slug) {
        const totalItems = Object.values(profile.category_counts).reduce((a, b) => a + b, 0);
        const categoryItems = profile.category_counts[rules.category_slug] || 0;
        const affinity = totalItems > 0 ? categoryItems / totalItems : 0;
        matches = affinity >= 0.2 && profile.order_count >= (rules.min_orders || 1);
      }
      // Behavioral segments
      else if (rules.metric === 'total_spent') {
        matches = profile.total_spent >= 500;
      }
      else if (rules.metric === 'days_since_last_order') {
        if (profile.last_order) {
          const daysSince = Math.floor((now - profile.last_order) / (1000 * 60 * 60 * 24));
          matches = daysSince >= rules.range[0] && daysSince <= rules.range[1];
        }
      }
      else if (rules.metric === 'days_since_first_order') {
        if (profile.first_order) {
          const daysSince = Math.floor((now - profile.first_order) / (1000 * 60 * 60 * 24));
          matches = daysSince <= rules.max;
        }
      }
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

    console.log(`  ${segment.name}: ${count} customers`);
  }
}

createSegments().catch(console.error);
