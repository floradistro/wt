# iPad Testing - Atomic Operations Test Sheet

## Setup Instructions

### Step 1: Connect iPad to Mac
1. Connect iPad via USB cable
2. Trust the computer on iPad (enter passcode if prompted)
3. Open Xcode: `ios/Whaletools.xcworkspace` (NOT .xcodeproj)
4. In Xcode, select your iPad from device dropdown (top bar)
5. Verify signing: Product → Build Settings → Search "signing" → Set your team

### Step 2: Start Development Server
```bash
cd /Users/whale/Desktop/whaletools-native
npm run start:dev
```

### Step 3: Build and Run on iPad
**Option A: Via Xcode**
1. Press CMD+R or click Play button
2. Wait for build to complete
3. App should launch on iPad

**Option B: Via Terminal**
```bash
npx expo run:ios --device
```

### Step 4: Verify Connection
- Check iPad shows "Connected to Development Server"
- Shake iPad to open Developer Menu
- Verify "Connected to http://localhost:8081"

---

## 🧪 TEST SHEET - Atomic Operations

**Tester:** _____________
**Date:** _____________
**Device:** iPad (Model: _________)
**Environment:** DEV (`zwcwrwctomlnvyswovhb`)

---

## TEST 1: Atomic Inventory Adjustment ✅

**Purpose:** Verify inventory adjustments are atomic (all-or-nothing)

### Test 1A: Normal Adjustment (Increase)
- [ ] Navigate to Inventory → Select a product
- [ ] Tap "Adjust Inventory"
- [ ] Select "Count Correction" type
- [ ] Enter +10 quantity
- [ ] Enter reason: "Test atomic increase"
- [ ] Tap Submit

**Expected:**
- ✅ Success message shown
- ✅ Inventory quantity increases by 10
- ✅ Product total stock updated
- ✅ No error messages

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 1B: Adjustment (Decrease)
- [ ] Same product from Test 1A
- [ ] Tap "Adjust Inventory"
- [ ] Select "Shrinkage" type
- [ ] Enter -5 quantity
- [ ] Enter reason: "Test atomic decrease"
- [ ] Tap Submit

**Expected:**
- ✅ Success message shown
- ✅ Inventory quantity decreases by 5
- ✅ Product total stock updated correctly

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 1C: Negative Inventory Prevention
- [ ] Same product
- [ ] Note current quantity: _______
- [ ] Tap "Adjust Inventory"
- [ ] Try to decrease MORE than current quantity
- [ ] Enter reason: "Test negative prevention"
- [ ] Tap Submit

**Expected:**
- ❌ Error message: "Insufficient inventory"
- ✅ Inventory NOT changed
- ✅ No partial update

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 1D: Idempotency (Retry Safety)
**Setup:** Turn on Airplane Mode on iPad

- [ ] Navigate to Inventory → Select product
- [ ] Tap "Adjust Inventory"
- [ ] Enter +3 quantity, reason: "Idempotency test"
- [ ] Tap Submit
- [ ] Wait for timeout/error
- [ ] Turn OFF Airplane Mode
- [ ] Tap Submit AGAIN (retry)

**Expected:**
- ✅ Only ONE adjustment created (not two)
- ✅ Quantity increased by 3 (not 6)
- ✅ Idempotency key worked

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## TEST 2: Atomic Purchase Order Creation ✅

**Purpose:** Verify POs and items created atomically (no orphaned records)

### Test 2A: Create Inbound PO
- [ ] Navigate to Purchase Orders → Create New
- [ ] Select "Inbound" type
- [ ] Select a supplier
- [ ] Add 3 products with quantities
- [ ] Tap Submit

**Expected:**
- ✅ Success message shown
- ✅ PO created with unique number (e.g., PO-20251120-0001)
- ✅ All 3 items visible in PO details
- ✅ Totals calculated correctly

**Actual Result:** ___________________________

**PO Number Created:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 2B: Verify No Orphaned Records
**Setup:** Create network failure scenario

- [ ] Turn on Airplane Mode
- [ ] Try to create another PO
- [ ] Enter details and tap Submit
- [ ] Wait for error
- [ ] Turn OFF Airplane Mode
- [ ] Navigate to PO list

**Expected:**
- ✅ No partial PO created (either complete PO or none)
- ✅ No orphaned items in database
- ✅ Clean failure

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## TEST 3: Checkout with Inventory Reservations ✅

**Purpose:** Verify inventory reserved BEFORE payment (prevents overselling)

### Test 3A: Normal Checkout Flow
**Setup:** Find product with 5+ units in stock

- [ ] Navigate to POS
- [ ] Add product to cart (quantity: 2)
- [ ] Note product's current inventory: _______
- [ ] Tap "Checkout"
- [ ] Select payment method (Cash for easy testing)
- [ ] Complete payment

**Expected:**
- ✅ Order created successfully
- ✅ Inventory decreased by 2
- ✅ Stock movement logged
- ✅ No errors

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 3B: Insufficient Inventory (Pre-Payment Check)
**Setup:** Find product with LOW stock (1-2 units)

- [ ] Note product inventory: _______
- [ ] Add MORE than available to cart
- [ ] Tap "Checkout"

**Expected:**
- ❌ Error BEFORE payment screen
- ❌ Message: "Insufficient inventory"
- ✅ No payment attempted
- ✅ Inventory unchanged

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 3C: Payment Failure Releases Holds
**Setup:** Product with adequate inventory

- [ ] Add product to cart (quantity: 2)
- [ ] Tap "Checkout"
- [ ] Select Card payment
- [ ] When card reader prompt appears, CANCEL payment

**Expected:**
- ✅ Order cancelled
- ✅ Inventory NOT deducted
- ✅ Inventory hold released
- ✅ Inventory available again

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 3D: Concurrent Checkouts (Overselling Prevention)
**Setup:** Product with EXACTLY 5 units in stock
**Requires:** Two iPads or iPad + computer

- [ ] iPad 1: Add 3 units to cart
- [ ] iPad 2: Add 3 units to cart
- [ ] iPad 1: Start checkout (don't complete)
- [ ] iPad 2: Try to checkout

**Expected:**
- ✅ First checkout reserves 3 units
- ❌ Second checkout fails with "Insufficient inventory" (only 2 remaining)
- ✅ No overselling (total sold ≤ 5)

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## TEST 4: Product Audit Trail ✅

**Purpose:** Verify all product changes are logged

### Test 4A: Product Update Tracking
- [ ] Navigate to Products → Select product
- [ ] Tap Edit
- [ ] Change name: Add " (EDITED)" to end
- [ ] Change price: Add $5.00
- [ ] Save changes

**Expected:**
- ✅ Changes saved
- ✅ Audit trail created
- ✅ Your user ID logged as editor
- ✅ Timestamp recorded

**Verification (via monitoring):**
Check if audit record created with correct details

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 4B: Product Creation Tracking
- [ ] Navigate to Products → Create New
- [ ] Enter details (name, SKU, price, etc.)
- [ ] Tap Save

**Expected:**
- ✅ Product created
- ✅ Creation audit logged automatically
- ✅ Trigger fired successfully

**Verification (via monitoring):**
Check if creation event logged in product_audit

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## TEST 5: Edge Cases & Error Handling ✅

### Test 5A: Rapid Consecutive Operations
**Purpose:** Test race condition prevention

- [ ] Select product
- [ ] Tap "Adjust Inventory" → +5
- [ ] IMMEDIATELY tap Submit 3 times rapidly

**Expected:**
- ✅ Only ONE adjustment created
- ✅ Quantity increased by 5 (not 15)
- ✅ Duplicate protection working

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 5B: Network Interruption Recovery
- [ ] Start creating PO
- [ ] Add items
- [ ] Turn on Airplane Mode
- [ ] Tap Submit
- [ ] Wait 10 seconds
- [ ] Turn OFF Airplane Mode
- [ ] Check if auto-retry or shows error

**Expected:**
- ✅ Clear error message
- ✅ No partial record created
- ✅ Can retry successfully

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 5C: Hold Expiration (10 min timeout)
**Setup:** Product with limited stock

- [ ] Add product to cart
- [ ] Start checkout but DON'T complete
- [ ] Leave app idle for 11 minutes
- [ ] Return and try to complete checkout

**Expected:**
- ❌ Hold expired
- ✅ Need to re-add to cart
- ✅ Inventory released back to available

**Actual Result:** ___________________________

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## TEST 6: Performance & User Experience ✅

### Test 6A: Response Time
- [ ] Create inventory adjustment
- [ ] Time from Submit tap to success message: _______ seconds

**Expected:** < 2 seconds

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 6B: Loading States
- [ ] Observe loading indicators during:
  - [ ] Inventory adjustment
  - [ ] PO creation
  - [ ] Checkout

**Expected:**
- ✅ Loading indicator shown during operation
- ✅ Buttons disabled during processing
- ✅ Clear feedback

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

### Test 6C: Error Messages
- [ ] Trigger various errors (negative inventory, etc.)
- [ ] Read error messages

**Expected:**
- ✅ Clear, user-friendly messages
- ✅ Specific to the error (not generic)
- ✅ Actionable (tells user what to do)

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## TEST 7: Reconciliation System ✅

### Test 7A: Failed Operation Logging
**Setup:** Force a failure (simulate by stopping dev server)

- [ ] Stop development server
- [ ] Try to create inventory adjustment
- [ ] Wait for timeout
- [ ] Restart server

**Expected:**
- ✅ Error logged to reconciliation queue
- ✅ Operation can be retried manually
- ✅ Admin can view failed operations

**Verification (via monitoring):**
Check reconciliation_queue for logged error

**Pass/Fail:** ⬜ Pass ⬜ Fail

---

## OVERALL SUMMARY

**Total Tests:** 21
**Passed:** _______
**Failed:** _______
**Pass Rate:** _______%

### Critical Issues Found:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Minor Issues Found:
1. _______________________________________________
2. _______________________________________________

### Positive Observations:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Recommendations:
1. _______________________________________________
2. _______________________________________________

---

## Sign-Off

**Tester Signature:** _______________
**Date Completed:** _______________
**Ready for Production:** ⬜ Yes ⬜ No ⬜ With Fixes

---

## Notes Section

Use this space for any additional observations, screenshots references, or details:

_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
