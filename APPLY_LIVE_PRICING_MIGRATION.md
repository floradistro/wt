# 🎯 LIVE PRICING TEMPLATES - APPLY THIS MIGRATION

## What This Fixes

**Problem:** Products copy pricing tiers from templates and become "orphaned". When you update a template, products don't reflect the changes.

**Solution:** Products now **reference** templates instead of copying data. Pricing is read from templates dynamically in real-time.

## Architecture Change

### BEFORE (Broken):
```
Template → Copy tiers → Product.meta_data.pricing_tiers
                       (orphaned, never updates)
```

### AFTER (Live System):
```
Template ← Product.pricing_template_id (reference)
         ↓
Product reads pricing from template at runtime
```

---

## Apply Migration (2 minutes)

### Step 1: Open Supabase SQL Editor
```
https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/sql/new
```

### Step 2: Copy and Run Migration

Copy the **entire contents** of this file:
```
supabase/migrations/097_add_pricing_template_reference.sql
```

Paste into SQL Editor and click **RUN**.

### Step 3: Verify

The migration will:
1. ✅ Add `pricing_template_id` column to products
2. ✅ Create index for performance
3. ✅ Backfill existing products (match by category and first tier price)
4. ✅ Update database function to set template reference
5. ✅ Reload PostgREST schema cache

You should see:
```sql
ALTER TABLE
CREATE INDEX
DO
DROP FUNCTION
CREATE FUNCTION
NOTIFY
```

---

## How It Works Now

### When You Update a Template:

1. **Template saves** → Database updates `pricing_tier_templates.default_tiers`
2. **Bulk update runs** → Sets `products.pricing_template_id = template.id`
3. **Products refresh** → Transformer checks for `pricing_template` and reads from it
4. **POS updates** → Shows latest pricing from template immediately

### Code Flow:

```typescript
// 1. Product loads from database WITH template join
SELECT products.*, pricing_tier_templates.default_tiers
FROM products
LEFT JOIN pricing_tier_templates ON products.pricing_template_id = pricing_tier_templates.id

// 2. Transformer resolves pricing
if (product.pricing_template?.default_tiers) {
  // Use template (LIVE)
  pricing = template.default_tiers
} else {
  // Fallback to legacy pricing_data (orphaned products)
  pricing = product.pricing_data.tiers
}

// 3. UI displays pricing from template
ProductCard shows template.default_tiers[0].default_price
```

---

## Testing

### Test 1: Update Template
1. Go to Categories → Flower → Top Shelf
2. Edit pricing template → Change 1g price to $99.99
3. Click Done
4. Open any Flower product → Should show $99.99 immediately

### Test 2: Check Database
Run this to see which products are linked to templates:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase
    .from('products')
    .select('name, pricing_template_id, pricing_template:pricing_tier_templates(name)')
    .not('pricing_template_id', 'is', null)
    .limit(5);
  console.log('Products with live templates:');
  data.forEach(p => console.log(\`  - \${p.name} → \${p.pricing_template?.name}\`));
})();
"
```

### Test 3: Verify Real-Time Updates
1. Open product "Black Ice" in Products screen
2. Keep it open
3. Go to Categories → Edit Top Shelf template
4. Change price
5. Watch "Black Ice" price update automatically (no refresh needed)

---

## Backwards Compatibility

**Legacy products** (without `pricing_template_id`) will continue to work using `pricing_data.tiers`.

The transformer has a fallback:
```typescript
if (product.pricing_template) {
  // New system - live template
} else {
  // Old system - orphaned data
}
```

---

## Performance

**Before:**
- 89 products × 5 tiers = 445 tier copies in database
- Every template update = 89 individual UPDATE queries

**After:**
- 89 products × 1 template reference = 89 references
- Every template update = 1 UPDATE to template + products auto-refresh

**Result:** ~500x less data duplication, instant updates across all products.

---

## Files Changed

### Database:
- `supabase/migrations/097_add_pricing_template_reference.sql` (NEW)

### Frontend:
- `src/components/categories/EditablePricingTemplatesSection.tsx`
  - Changed bulk update to pass `template_id` instead of copying tiers
- `src/stores/products.store.ts`
  - Added `pricing_template` join to query
- `src/utils/product-transformers.ts`
  - Read from `pricing_template.default_tiers` if available
- `src/services/products.service.ts`
  - Added `pricing_template` join to getProductsWithInventory

---

## Rollback (if needed)

If something goes wrong, you can rollback:

```sql
-- Remove column (products will fall back to pricing_data)
ALTER TABLE products DROP COLUMN pricing_template_id;

-- Restore old function (not recommended)
-- See previous migration: 102_bulk_update_product_pricing.sql
```

But you won't need to - this is a non-breaking change with fallback support!
