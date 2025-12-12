import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function analyze() {
  // Get categories
  const { data: categories } = await supabase.from('categories').select('id, name, slug');
  const catMap = {};
  categories?.forEach(c => catMap[c.id] = c.name);

  // Get all products with their category
  const { data: products } = await supabase.from('products').select('id, name, primary_category_id');
  const productCatMap = {};
  products?.forEach(p => {
    productCatMap[p.id] = catMap[p.primary_category_id] || 'Unknown';
    productCatMap[p.name] = catMap[p.primary_category_id] || 'Unknown';
  });

  // Paginate through ALL order items
  const allItems = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('order_items')
      .select('product_id, product_name, quantity, line_total')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;

    allItems.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log('Total order items:', allItems.length);

  // Aggregate by category
  const byCat = {};
  let unknownProducts = [];

  allItems.forEach(item => {
    // Try product_id first, then product_name
    let category = productCatMap[item.product_id] || productCatMap[item.product_name];

    // If still unknown, try fuzzy match on product name
    if (!category || category === 'Unknown') {
      const name = (item.product_name || '').toLowerCase();

      // Beverages
      if (name.includes('fizz') || name.includes('cola') || name.includes('sprite') || name.includes('clementine') || name.includes('lemon ginger') || name.includes('berry twist')) {
        category = 'Beverages';
      }
      // Gummies/Edibles
      else if (name.includes('gumm') || name.includes('cookie') || name.includes('brownie') || name.includes('chocolate') || name.includes('oreo') || name.includes('fig bar')) {
        category = 'Edibles';
      }
      // Pre-rolls
      else if (name.includes('pre roll') || name.includes('pre-roll') || name.includes('1.3g') || name.includes('2.5g')) {
        category = 'Hash Holes';
      }
      // Concentrates
      else if (name.includes('badder') || name.includes('cocktail') || name.includes('hot gas')) {
        category = 'Concentrates';
      }
      // Default to Flower for strain names
      else {
        category = 'Flower';
        if (item.product_id) unknownProducts.push(item.product_name);
      }
    }

    if (!byCat[category]) byCat[category] = { qty: 0, revenue: 0, items: 0 };
    byCat[category].qty += item.quantity || 1;
    byCat[category].revenue += item.line_total || 0;
    byCat[category].items += 1;
  });

  console.log('\n=== SALES BY CATEGORY ===');
  Object.entries(byCat)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .forEach(([cat, data]) => {
      console.log(`${cat}: ${data.items} line items, ${data.qty} units, $${Math.round(data.revenue)} revenue`);
    });

  // Show top sellers per category
  console.log('\n=== TOP SELLERS BY CATEGORY ===');

  const catSales = {};
  allItems.forEach(item => {
    let category = productCatMap[item.product_id] || productCatMap[item.product_name] || 'Flower';
    if (!catSales[category]) catSales[category] = {};
    const name = item.product_name || 'Unknown';
    if (!catSales[category][name]) catSales[category][name] = { qty: 0, revenue: 0 };
    catSales[category][name].qty += item.quantity || 1;
    catSales[category][name].revenue += item.line_total || 0;
  });

  Object.entries(catSales).forEach(([cat, products]) => {
    console.log('\n' + cat + ':');
    Object.entries(products)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5)
      .forEach(([name, data]) => {
        console.log(`  ${data.qty}x ${name} = $${Math.round(data.revenue)}`);
      });
  });

  if (unknownProducts.length > 0) {
    console.log('\n=== Products defaulted to Flower (may need reclassification) ===');
    console.log([...new Set(unknownProducts)].slice(0, 20).join(', '));
  }
}

analyze();
