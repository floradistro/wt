import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function analyze() {
  // Get product categories
  const { data: categories } = await supabase.from('categories').select('id, name, slug');
  console.log('CATEGORIES:', JSON.stringify(categories, null, 2));

  // Get products with their category
  const { data: products } = await supabase
    .from('products')
    .select('id, name, primary_category_id')
    .eq('status', 'published');

  // Map products to categories
  const catMap = {};
  categories?.forEach(c => catMap[c.id] = c.name);

  const byCat = {};
  products?.forEach(p => {
    const catName = catMap[p.primary_category_id] || 'Uncategorized';
    if (!byCat[catName]) byCat[catName] = [];
    byCat[catName].push(p.name);
  });

  console.log('\nPRODUCTS BY CATEGORY:');
  Object.entries(byCat).sort((a,b) => b[1].length - a[1].length).forEach(([cat, names]) => {
    console.log('\n' + cat + ' (' + names.length + '):');
    console.log('  ' + names.slice(0, 15).join(', ') + (names.length > 15 ? '...' : ''));
  });
}

analyze();
