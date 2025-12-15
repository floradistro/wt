# Quick Test Commands Reference

## 🚀 SETUP (Run Once)

### 1. Connect iPad
```bash
# Physically connect iPad via USB
# Trust computer on iPad when prompted
```

### 2. Start Development Server
```bash
cd /Users/whale/Desktop/whaletools-native
npm run start:dev
```

### 3. Open Xcode and Run
```bash
open ios/Whaletools.xcworkspace
# Then press CMD+R to build and run on iPad
```

---

## 📊 MONITORING (Claude Runs These)

### Start Real-Time Monitor
```bash
./monitor-testing.sh
```

This shows:
- Recent inventory adjustments
- Recent purchase orders
- Active inventory holds
- Recent orders
- Product audit trail
- Reconciliation queue status

Updates every 3 seconds

---

## 🔍 MANUAL CHECKS (Quick Queries)

### Check Specific Product Inventory
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT p.name, i.quantity, i.location_id
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      WHERE p.name ILIKE '%PRODUCT_NAME%';"
```

### View Audit Trail for Product
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT * FROM get_product_history('PRODUCT_ID_HERE', 10);"
```

### Check Active Holds
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT * FROM inventory_holds WHERE released_at IS NULL;"
```

### Check Reconciliation Dashboard
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT * FROM get_reconciliation_dashboard('VENDOR_ID_HERE');"
```

### View Failed Operations
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "
  SELECT 'Inventory' as queue, COUNT(*) as failed
  FROM inventory_reconciliation_queue WHERE resolved = FALSE
  UNION ALL
  SELECT 'Adjustments', COUNT(*)
  FROM adjustment_reconciliation_queue WHERE resolved = FALSE
  UNION ALL
  SELECT 'POs', COUNT(*)
  FROM po_reconciliation_queue WHERE resolved = FALSE;
  "
```

---

## 🧪 TESTING WORKFLOW

### For Each Test:
1. **User performs action on iPad**
2. **Claude watches monitor** for database changes
3. **Claude verifies** expected behavior
4. **User marks Pass/Fail** on test sheet

### Expected Patterns:

**Inventory Adjustment:**
- ✅ New row in `inventory_adjustments` with idempotency_key
- ✅ `inventory.quantity` updated
- ✅ `products.stock_quantity` updated
- ✅ Stock movement created

**Purchase Order:**
- ✅ New row in `purchase_orders` with unique po_number
- ✅ Items in `purchase_order_items` match count
- ✅ Has idempotency_key

**Checkout:**
- ✅ Inventory hold created FIRST (before payment)
- ✅ Order created with PENDING status
- ✅ After payment: Hold released + inventory deducted
- ✅ Order status → COMPLETED

**Product Edit:**
- ✅ Product updated
- ✅ Audit record in `product_audit` with field_name, old_value, new_value

---

## 🐛 DEBUGGING

### View Recent Errors (Last hour)
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT * FROM inventory_reconciliation_queue
      WHERE created_at > NOW() - INTERVAL '1 hour';"
```

### Check for Negative Inventory (Should be NONE)
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT * FROM inventory WHERE quantity < 0;"
```

### View Function Execution Stats
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT proname, prokind
      FROM pg_proc
      WHERE proname LIKE 'process%' OR proname LIKE '%atomic%';"
```

---

## 📱 TROUBLESHOOTING

### iPad Not Showing in Xcode
```bash
# Check devices
xcrun xctrace list devices

# Restart Xcode
killall Xcode
open ios/Whaletools.xcworkspace
```

### Development Server Connection Issues
```bash
# Check Metro bundler
lsof -ti:8081 | xargs kill -9  # Kill old process
npm run start:dev               # Restart
```

### Build Errors
```bash
cd ios
pod install --repo-update
cd ..
npm run ios
```

### Database Connection Test
```bash
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT 1 as test;"
```

---

## 📋 CHECKLIST BEFORE STARTING

- [x] iPad connected via USB
- [x] iPad trusts computer
- [x] Xcode opened with .xcworkspace
- [x] Device selected in Xcode
- [x] Development server running (`npm run start:dev`)
- [x] Monitoring script running (`./monitor-testing.sh`)
- [x] Test sheet ready (`IPAD_TEST_SHEET.md`)
- [x] Environment confirmed: DEV

---

## 🎯 SUCCESS CRITERIA

All tests pass with:
- ✅ No negative inventory
- ✅ No orphaned records
- ✅ No duplicate operations (idempotency working)
- ✅ Inventory holds working correctly
- ✅ Audit trails created
- ✅ Clean error messages
- ✅ Fast response times (< 2 seconds)
- ✅ Reconciliation queues empty or properly logging

---

## 📞 EMERGENCY STOP

If something goes wrong:

```bash
# Stop development server
# Press Ctrl+C in terminal running npm start

# Stop monitoring
# Press Ctrl+C in monitoring terminal

# Check for damage
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "SELECT COUNT(*) as negative_inventory FROM inventory WHERE quantity < 0;"
```

If negative inventory found:
```bash
# This is DEV, so we can fix it
source .env && PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.zwcwrwctomlnvyswovhb.supabase.co \
  -p 5432 -U postgres -d postgres \
  -c "UPDATE inventory SET quantity = 0 WHERE quantity < 0;"
```

---

Ready to test! 🚀
