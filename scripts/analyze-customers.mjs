import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function analyze() {
  // First, get the categories lookup
  const { data: categories } = await supabase.from('categories').select('id, name');
  const catMap = {};
  for (const c of (categories || [])) {
    catMap[c.id] = c.name;
  }

  // Get products lookup - use primary_category_id
  const { data: products } = await supabase.from('products').select('id, name, primary_category_id, custom_fields');
  const prodMap = {};
  for (const p of (products || [])) {
    prodMap[p.id] = p;
  }

  // Get customers with their orders and items
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, customer_id, total_amount, order_type, created_at, status,
      customer:customers(id, first_name, last_name),
      items:order_items(quantity, product_id)
    `)
    .in('status', ['completed', 'delivered', 'shipped', 'ready_for_pickup', 'picked_up'])
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Aggregate by customer
  const customerData = {};

  for (const order of orders) {
    if (!order.customer) continue;
    const cid = order.customer.id;

    if (!customerData[cid]) {
      customerData[cid] = {
        name: order.customer.first_name + ' ' + order.customer.last_name,
        orders: 0,
        ltv: 0,
        categories: {},
        strains: { Sativa: 0, Indica: 0, Hybrid: 0 },
        pickup: 0,
        shipping: 0,
        lastOrder: null
      };
    }

    const c = customerData[cid];
    c.orders++;
    c.ltv += order.total_amount || 0;
    if (order.order_type === 'pickup') c.pickup++;
    if (order.order_type === 'shipping') c.shipping++;
    if (!c.lastOrder || new Date(order.created_at) > new Date(c.lastOrder)) {
      c.lastOrder = order.created_at;
    }

    for (const item of (order.items || [])) {
      const product = prodMap[item.product_id];
      if (!product) continue;
      const cat = catMap[product.primary_category_id] || 'Other';
      c.categories[cat] = (c.categories[cat] || 0) + 1;

      // Normalize strain type (handle "Indica Hybrid" -> "Hybrid" etc)
      let strain = product.custom_fields?.strain_type;
      if (strain) {
        if (strain.includes('Sativa')) strain = 'Sativa';
        else if (strain.includes('Indica')) strain = 'Indica';
        else if (strain.includes('Hybrid')) strain = 'Hybrid';
      }
      if (strain && c.strains[strain] !== undefined) {
        c.strains[strain]++;
      }
    }
  }

  // Sort by LTV and show top customers
  const sorted = Object.entries(customerData)
    .filter(([_, c]) => c.orders >= 2)
    .sort((a, b) => b[1].ltv - a[1].ltv)
    .slice(0, 15);

  console.log('\n=== TOP REPEAT CUSTOMERS (Last 90 Days) ===\n');
  console.log('Name                    | Orders | LTV     | Flower | Edibles | Sativa | Indica | Hybrid | Pickup | Ship');
  console.log('-'.repeat(105));

  for (const [_, c] of sorted) {
    const name = c.name.padEnd(23).slice(0, 23);
    const flower = c.categories['Flower'] || 0;
    const edibles = c.categories['Edibles'] || 0;
    console.log(
      name + ' | ' +
      String(c.orders).padStart(6) + ' | ' +
      ('$' + c.ltv.toFixed(0)).padStart(7) + ' | ' +
      String(flower).padStart(6) + ' | ' +
      String(edibles).padStart(7) + ' | ' +
      String(c.strains.Sativa).padStart(6) + ' | ' +
      String(c.strains.Indica).padStart(6) + ' | ' +
      String(c.strains.Hybrid).padStart(6) + ' | ' +
      String(c.pickup).padStart(6) + ' | ' +
      String(c.shipping).padStart(4)
    );
  }

  console.log('\n=== SEGMENT INSIGHTS ===');

  // Calculate segments
  let sativaLovers = [], indicaLovers = [], flowerBuyers = [], highLTV = [], pickupOnly = [], shippingOnly = [];

  for (const [id, c] of Object.entries(customerData)) {
    if (c.strains.Sativa > c.strains.Indica && c.strains.Sativa > c.strains.Hybrid) sativaLovers.push(c.name);
    if (c.strains.Indica > c.strains.Sativa && c.strains.Indica > c.strains.Hybrid) indicaLovers.push(c.name);
    if ((c.categories['Flower'] || 0) >= 2) flowerBuyers.push(c.name);
    if (c.ltv >= 200) highLTV.push(c.name);
    if (c.pickup > 0 && c.shipping === 0) pickupOnly.push(c.name);
    if (c.shipping > 0 && c.pickup === 0) shippingOnly.push(c.name);
  }

  console.log('\nSativa Lovers (' + sativaLovers.length + '): ' + sativaLovers.slice(0, 5).join(', '));
  console.log('Indica Lovers (' + indicaLovers.length + '): ' + indicaLovers.slice(0, 5).join(', '));
  console.log('Flower Regulars (' + flowerBuyers.length + '): ' + flowerBuyers.slice(0, 5).join(', '));
  console.log('High LTV (>$200) (' + highLTV.length + '): ' + highLTV.slice(0, 5).join(', '));
  console.log('Pickup Only (' + pickupOnly.length + '): ' + pickupOnly.slice(0, 5).join(', '));
  console.log('Shipping Only (' + shippingOnly.length + '): ' + shippingOnly.slice(0, 5).join(', '));
}

async function checkProducts() {
  // Check product columns - select all to see what's there
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .limit(5);

  console.log('\n=== SAMPLE PRODUCTS (columns) ===');
  if (error) console.log('Product error:', error.message);

  if (products && products.length > 0) {
    console.log('Columns:', Object.keys(products[0]).join(', '));
    console.log('\nSample product data:');
    for (const p of products) {
      console.log(JSON.stringify({
        id: p.id?.slice(0, 8),
        name: p.name,
        category: p.category,
        custom_fields: p.custom_fields
      }, null, 2));
    }
  }

  // Also check product count
  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
  console.log('\nTotal products in DB:', count);
}

analyze().then(checkProducts).catch(console.error);
