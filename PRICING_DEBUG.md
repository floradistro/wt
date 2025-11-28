# Pricing Tier Changes Not Working - Debug Checklist

## What to check in console when saving pricing:

### 1. Template Save Logs (should see):
```
💾 Saving template update {templateId, templateName, tierCount, firstTier}
✅ Template saved successfully {templateId, updatedData}
```

### 2. Bulk Update Logs (should see):
```
🔄 Triggering cascade update for template {templateId, templateName}
⚡ BULK UPDATE: Updating all products with new pricing {templateId, tierCount, categoryId}
✅ BULK UPDATE COMPLETE {updatedCount, firstFewIds, message}
```

### 3. Real-time Update (should trigger product refresh automatically)

## Common Issues:

### Issue 1: Database function not found
**Error**: `PGRST202 - Could not find the function`
**Solution**: Migration was applied but schema cache needs reload
**Fix**: Run in Supabase SQL Editor:
```sql
NOTIFY pgrst, 'reload schema';
```

### Issue 2: No products being updated
**Log**: `updatedCount: 0`
**Cause**: Products not matching category_id or vendor_id filter
**Debug**: Run this to check:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const categoryId = 'YOUR_CATEGORY_ID_HERE';
  const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf';
  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('primary_category_id', categoryId).eq('vendor_id', vendorId);
  console.log('Products in category:', count);
})();
"
```

### Issue 3: Real-time not working
**Symptom**: Template saves, bulk update works, but POS doesn't update
**Check**: Are you subscribed to real-time?
**Look for**: No errors, but products.store isn't refreshing

### Issue 4: Wrong field mapping
**Check**: Are tiers using correct field names?
- `quantity` not `qty`
- `default_price` not `price`

## Quick Test:

1. Open Category → Edit Pricing Template
2. Change a price (e.g., 1g from $10 to $15)
3. Click Save
4. Check console for BULK UPDATE logs
5. Open POS → Check product price
6. Should be $15 immediately (no refresh)

## Manual Verification:

Run this to see if products were actually updated:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('products').select('id, name, meta_data').eq('primary_category_id', 'YOUR_CATEGORY_ID').limit(3);
  console.log(JSON.stringify(data, null, 2));
})();
"
```

Check if `meta_data.pricing_tiers` has the new prices.
