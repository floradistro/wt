import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function analyzeProductTypes() {
  // Get products with their categories
  const { data: products } = await supabase
    .from('products')
    .select('id, name, primary_category_id, custom_fields')
    .eq('status', 'published');

  // Group by what type they actually are
  const byType = {};
  products?.forEach(p => {
    const cf = p.custom_fields || {};
    let type = 'Unknown';

    if (cf.edible_type) type = 'Edible - ' + cf.edible_type;
    else if (cf.strain_type) type = 'Flower/Concentrate - ' + cf.strain_type;
    else if (cf.thca_percentage && parseFloat(cf.thca_percentage) > 50) type = 'Concentrate/Vape';
    else if (cf.total_mg_per_package) type = 'Edible';

    if (!byType[type]) byType[type] = [];
    byType[type].push(p.name);
  });

  console.log('=== PRODUCTS BY TYPE ===');
  Object.entries(byType).forEach(([type, names]) => {
    console.log('\n' + type + ' (' + names.length + '):');
    console.log('  ' + names.slice(0, 10).join(', ') + (names.length > 10 ? '...' : ''));
  });

  // Show all product names to understand what they sell
  console.log('\n=== ALL PRODUCT NAMES ===');
  products?.map(p => p.name).sort().forEach(n => console.log('  ' + n));
}

async function analyze() {
  await analyzeProductTypes();
  // Paginate through all order items
  const allItems = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from('order_items')
      .select('product_name, quantity, line_total, tier_name, quantity_grams')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (data && data.length > 0) {
      allItems.push(...data);
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  console.log('Total order items:', allItems.length);

  // Analyze by product
  const productSales = {};
  allItems.forEach(item => {
    const name = item.product_name || 'Unknown';
    if (!productSales[name]) {
      productSales[name] = { qty: 0, revenue: 0, grams: 0 };
    }
    productSales[name].qty += item.quantity || 1;
    productSales[name].revenue += item.line_total || 0;
    productSales[name].grams += item.quantity_grams || 0;
  });

  console.log('\n=== TOP 20 PRODUCTS BY QUANTITY ===');
  Object.entries(productSales)
    .sort((a,b) => b[1].qty - a[1].qty)
    .slice(0, 20)
    .forEach(([name, data]) => {
      const gramsInfo = data.grams > 0 ? ` (${Math.round(data.grams)}g)` : '';
      console.log(`${data.qty}x ${name}${gramsInfo} = $${Math.round(data.revenue)}`);
    });

  // Categorize by product name patterns
  let flower = 0, flowerRev = 0;
  let vapes = 0, vapesRev = 0;
  let edibles = 0, ediblesRev = 0;
  let prerolls = 0, prerollsRev = 0;

  // Keywords for each category
  const vapeKeywords = ['vape', 'cart', 'disposable'];
  const edibleKeywords = ['gumm', 'cookie', 'brownie', 'chocolate', 'candy', 'caramel', 'peanut butter', 'rice crispy'];
  const prerollKeywords = ['preroll', 'pre-roll', 'joint', 'blunt', 'infused roll'];

  allItems.forEach(item => {
    const name = (item.product_name || '').toLowerCase();
    const total = item.line_total || 0;
    const qty = item.quantity || 1;

    if (edibleKeywords.some(k => name.includes(k))) {
      edibles += qty; ediblesRev += total;
    } else if (vapeKeywords.some(k => name.includes(k))) {
      vapes += qty; vapesRev += total;
    } else if (prerollKeywords.some(k => name.includes(k))) {
      prerolls += qty; prerollsRev += total;
    } else {
      flower += qty; flowerRev += total;
    }
  });

  console.log('\n=== CATEGORY BREAKDOWN ===');
  console.log(`Flower: ${flower} items, $${Math.round(flowerRev)} revenue`);
  console.log(`Edibles: ${edibles} items, $${Math.round(ediblesRev)} revenue`);
  console.log(`Vapes: ${vapes} items, $${Math.round(vapesRev)} revenue`);
  console.log(`Prerolls: ${prerolls} items, $${Math.round(prerollsRev)} revenue`);

  // Analyze purchase sizes (tier_name)
  const tierCounts = {};
  allItems.forEach(item => {
    const tier = item.tier_name || 'Single';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  });

  console.log('\n=== PURCHASE SIZES ===');
  Object.entries(tierCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([tier, count]) => console.log(`${tier}: ${count}`));
}

analyze();
