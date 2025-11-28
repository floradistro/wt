# 🚀 Apply Pricing Migration - URGENT

## What This Does

This migration enables **instant cascade pricing updates** across all products and POS terminals with **zero refresh required**.

### Before Migration:
- ❌ Pricing changes don't update existing products
- ❌ Need to manually refresh to see changes
- ❌ Inconsistent pricing across products

### After Migration:
- ✅ Update pricing template → all products update instantly
- ✅ Real-time sync across all POS terminals
- ✅ Atomic bulk updates (no spam logging)
- ✅ Zero refresh required

---

## How to Apply (2 minutes)

### Step 1: Go to Supabase SQL Editor
Open this link in your browser:
```
https://supabase.com/dashboard/project/uaednwpxursknmwdeejn/sql/new
```

### Step 2: Copy the SQL
Copy the entire contents of this file:
```
supabase/migrations/APPLY_THIS_NOW.sql
```

### Step 3: Paste and Run
1. Paste the SQL into the SQL Editor
2. Click the **"RUN"** button (or press Cmd+Enter)
3. Wait for success message

### Step 4: Verify
Run this command in your terminal:
```bash
node scripts/verify-migration.js
```

You should see:
```
✅ Function exists and is accessible!
🎉 Migration verified successfully!
```

---

## What Gets Created

1. **Real-time subscriptions** for `pricing_tier_templates` and `products` tables
2. **Atomic bulk update function**: `update_products_pricing_from_template()`
3. **Schema cache reload** so the function is immediately accessible

---

## Troubleshooting

### If you get "Function not found" after applying:
Run this SQL to reload the schema cache:
```sql
NOTIFY pgrst, 'reload schema';
```

Wait 5 seconds, then run the verify script again.

### If you see "already exists" errors:
That's OK! It means parts are already applied. The migration will skip those parts.

---

## Testing After Migration

1. Open a category in the app
2. Edit a pricing template (change a price)
3. Save the template
4. Open POS → Products should show new prices instantly
5. No refresh required!

---

## Files Reference

- **Migration SQL**: `supabase/migrations/APPLY_THIS_NOW.sql`
- **Individual migration**: `supabase/migrations/102_bulk_update_product_pricing.sql`
- **Verification script**: `scripts/verify-migration.js`
- **This file**: `APPLY_PRICING_MIGRATION_NOW.md`
