# ✅ CUSTOMER LOYALTY ADJUSTMENT - FIXED

**Date**: November 22, 2025
**Status**: ✅ Fixed and Deployed

---

## 🐛 Problem

Customer detail screen's loyalty point adjustment was broken with error:
```
Could not find the function public.update_customer_loyalty_points(p_customer_id, p_points_change) in the schema cache
```

**Why**: The old function was removed when we implemented atomic checkout loyalty system. Customer adjustments need a different function than checkout.

---

## ✅ Solution

Created a new dedicated function for manual loyalty adjustments (separate from checkout):

### 1. **New Database Function** ✅
**File**: `supabase/migrations/063_add_manual_loyalty_adjustment.sql`

```sql
CREATE OR REPLACE FUNCTION adjust_customer_loyalty_points(
  p_customer_id UUID,
  p_points_change INTEGER,
  p_reason TEXT DEFAULT 'Manual adjustment'
)
```

**Features**:
- ✅ Allows positive or negative adjustments (+100, -50, etc.)
- ✅ Prevents balance from going below zero
- ✅ Creates audit trail in `loyalty_transactions` with type='adjusted'
- ✅ Uses existing trigger for balance updates (no double-counting)
- ✅ Row-level locking prevents race conditions

### 2. **Updated Service Function** ✅
**File**: `src/services/customers.service.ts`

**Before**:
```typescript
export async function updateCustomerLoyaltyPoints(
  customerId: string,
  pointsChange: number
): Promise<void> {
  const { error } = await supabase.rpc('update_customer_loyalty_points', {
    p_customer_id: customerId,
    p_points_change: pointsChange,
  })
}
```

**After**:
```typescript
export async function updateCustomerLoyaltyPoints(
  customerId: string,
  pointsChange: number,
  reason: string = 'Manual adjustment'
): Promise<void> {
  const { error } = await supabase.rpc('adjust_customer_loyalty_points', {
    p_customer_id: customerId,
    p_points_change: pointsChange,
    p_reason: reason,
  })
}
```

---

## 🎯 How It Works

### Customer Detail Screen
1. Tap on loyalty points stat
2. Modal opens with quick adjust buttons: -100, -50, -10, +10, +50, +100
3. Or enter custom amount
4. Click confirm

### Database Flow
1. `adjust_customer_loyalty_points()` function called
2. Validates customer exists and locks row (FOR UPDATE)
3. Validates new balance won't go negative
4. Inserts transaction into `loyalty_transactions`:
   - `transaction_type = 'adjusted'`
   - `reference_type = 'manual'`
   - `description = reason` (e.g., "Manual adjustment")
5. Existing trigger `update_loyalty_balance` updates `customers.loyalty_points`
6. Change is instant and shows in UI

---

## 🔍 Audit Trail

All manual adjustments are tracked in the database:

```sql
-- View recent manual adjustments
SELECT
  c.first_name || ' ' || c.last_name as customer,
  lt.points,
  lt.balance_before,
  lt.balance_after,
  lt.description,
  lt.created_at
FROM loyalty_transactions lt
JOIN customers c ON c.id = lt.customer_id
WHERE lt.transaction_type = 'adjusted'
  AND lt.reference_type = 'manual'
ORDER BY lt.created_at DESC
LIMIT 20;
```

---

## 🧪 Testing

### Test 1: Add Points
1. Go to Customers → Select customer
2. Current balance: 50 points
3. Tap loyalty points → Click "+100"
4. ✅ **Expect**: Balance updates to 150 points

### Test 2: Remove Points
1. Customer has 100 points
2. Tap loyalty points → Click "-50"
3. ✅ **Expect**: Balance updates to 50 points

### Test 3: Cannot Go Negative
1. Customer has 20 points
2. Try to remove 50 points
3. ✅ **Expect**: Error "Cannot adjust points below zero"

### Test 4: Custom Amount
1. Tap loyalty points → Enter "175" in custom field
2. Confirm
3. ✅ **Expect**: 175 points added

### Test 5: Real-Time Update
1. Open customer detail on Device A
2. Open same customer on Device B
3. Adjust points on Device A
4. ✅ **Expect**: Device B shows updated balance (real-time)

---

## 📊 Transaction Types

Your system now has 3 distinct loyalty transaction types:

| Type | Description | Where It's Used |
|------|-------------|-----------------|
| `earned` | Points earned from purchases | Checkout (automatic) |
| `spent` | Points redeemed at checkout | Checkout (automatic) |
| `adjusted` | Manual adjustment by staff | Customer detail screen (manual) |

**Example Query**:
```sql
SELECT
  transaction_type,
  COUNT(*) as count,
  SUM(points) as total_points
FROM loyalty_transactions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY transaction_type
ORDER BY count DESC;

-- Expected output:
-- earned    | 100 | 5000   (most common - automatic)
-- spent     | 20  | -1000  (redemptions)
-- adjusted  | 5   | 250    (rare - manual corrections)
```

---

## 🔐 Security

### Row-Level Locking
```sql
SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE;
```
- Prevents two staff members from adjusting same customer simultaneously
- Ensures balance calculations are atomic

### Validation
- Cannot adjust by 0 (pointless)
- Cannot make balance negative
- Customer must exist

### Audit Trail
- Every adjustment logged with:
  - Who: implicit via RLS/auth
  - What: points changed
  - When: timestamp
  - Why: reason field
  - Before/After: balance snapshots

---

## 🔄 Real-Time Updates

Customer loyalty points update in real-time across all screens:

1. **Customer Detail** → Shows updated balance instantly
2. **Customer List** → Updates if customer is visible
3. **POS** → If customer selected, balance updates
4. **All Devices** → Changes propagate via Supabase real-time

This is powered by the existing real-time subscription in `src/hooks/useCustomers.ts`.

---

## 📝 Files Changed

1. ✅ `supabase/migrations/063_add_manual_loyalty_adjustment.sql` - New function
2. ✅ `src/services/customers.service.ts` - Updated service call
3. ✅ `CUSTOMER_LOYALTY_ADJUSTMENT_FIX.md` - This documentation

**No changes needed** to:
- `src/components/customers/detail/CustomerDetail.tsx` - Already calls service correctly
- Real-time subscriptions - Already working

---

## 🎉 Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Manual Adjustments** | ❌ Broken (function not found) | ✅ Working (new function) |
| **Audit Trail** | ❌ No tracking | ✅ Full audit trail |
| **Validation** | ❌ Could go negative | ✅ Prevents negative balance |
| **Real-Time** | ✅ Already working | ✅ Still working |
| **Security** | ⚠️ No locking | ✅ Row-level locking |

---

## 🚀 What's Next?

You can now:

1. ✅ **Add points** to customer accounts (compensations, bonuses)
2. ✅ **Remove points** (corrections, expirations)
3. ✅ **Track adjustments** with full audit trail
4. ✅ **See changes instantly** across all devices

All loyalty features are now working end-to-end:
- ✅ Earn points at checkout (automatic)
- ✅ Redeem points at checkout (automatic)
- ✅ Adjust points manually (customer service)
- ✅ Live updates across all screens
- ✅ Complete audit trail

Try it now in the app! 🎯
