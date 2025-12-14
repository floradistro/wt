import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';

async function topProducts() {
  // Get all order_items for this vendor
  const { data: items, error } = await supabase
    .from('order_items')
    .select('product_name, quantity, line_total')
    .eq('vendor_id', vendorId);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Total order items:', items?.length);

  const byProduct = {};
  items?.forEach(item => {
    const name = item.product_name || 'Unknown';
    if (!byProduct[name]) byProduct[name] = { qty: 0, revenue: 0 };
    byProduct[name].qty += (item.quantity || 1);
    byProduct[name].revenue += (item.line_total || 0);
  });

  console.log('\n=== TOP 20 SELLING PRODUCTS (All Time) ===\n');
  Object.entries(byProduct)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 20)
    .forEach(([name, data], i) => {
      console.log((i+1).toString().padStart(2) + '. ' + name.substring(0, 42).padEnd(42) + ' | ' + data.qty.toString().padStart(4) + ' sold | $' + data.revenue.toFixed(2));
    });

  // By category
  console.log('\n=== SALES BY CATEGORY ===\n');
  const { data: products } = await supabase.from('products').select('name, primary_category_id');
  const { data: categories } = await supabase.from('categories').select('id, name');

  const catMap = {};
  categories?.forEach(c => catMap[c.id] = c.name);
  const prodCatMap = {};
  products?.forEach(p => prodCatMap[p.name] = catMap[p.primary_category_id] || 'Uncategorized');

  const byCategory = {};
  items?.forEach(item => {
    const cat = prodCatMap[item.product_name] || 'Uncategorized';
    if (!byCategory[cat]) byCategory[cat] = { qty: 0, revenue: 0 };
    byCategory[cat].qty += (item.quantity || 1);
    byCategory[cat].revenue += (item.line_total || 0);
  });

  Object.entries(byCategory)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .forEach(([cat, data]) => {
      console.log('  ' + cat.padEnd(25) + ': ' + data.qty.toString().padStart(5) + ' items | $' + data.revenue.toFixed(2));
    });
}

topProducts().catch(console.error);
