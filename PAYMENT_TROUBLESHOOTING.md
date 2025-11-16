# Payment Processing Troubleshooting

## ✅ Issues Found & Fixed

### 1. ❌ "This feature is not available now" Error

**What it is:** iOS Simulator doesn't support Haptic feedback
**Impact:** Harmless - this is just a warning, not an actual error
**Location:** Appears when calling `Haptics.notificationAsync()` or `Haptics.impactAsync()`

**Solution:** This is expected in the Simulator. On a real device, haptics work fine.

**To suppress the warning (optional):**
```typescript
// Wrap haptic calls in try-catch
try {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
} catch (e) {
  // Silently fail on simulator
}
```

---

### 2. ✅ Payment Method Fixed

**Issue:** Payment modal was sending `paymentMethod: 'card'` instead of `'credit'`

**Fixed in:** `src/components/pos/POSPaymentModal.tsx`

**Change:**
```typescript
// Before:
paymentMethod: 'card'

// After:
paymentMethod: 'credit',
referenceId: `POS-${Date.now()}`,
```

This matches what the web app API expects (`'credit'` for card payments).

---

### 3. ⚠️ Loyalty API 401 Unauthorized

**Error in console:**
```
'⚠️ Loyalty program API returned non-OK status:', 401
```

**Cause:** The loyalty API endpoint requires authentication

**Check:**
1. Is the user logged in? ✅
2. Is the bearer token being sent? ✅
3. Does the API have correct CORS headers? Need to verify
4. Is the vendor ID correct? ✅

**Next steps:**
- Check web app API logs for the loyalty endpoint
- Verify `/api/vendor/loyalty/program` endpoint authentication
- May need to add vendor context to the request

---

### 4. ✅ Enhanced Logging Added

Added detailed console logging to `processCardPayment()` to help debug:

```typescript
console.log('💳 processCardPayment started', { locationId, registerId, total })
console.log('💳 Making API request to:', url)
console.log('💳 Request body:', requestBody)
console.log('💳 Response status:', status)
console.log('💳 Response body:', result)
```

This will help identify exactly where payment processing fails.

---

## 🧪 Testing Payment Processing

### Test Cash Payment

1. Add product to cart
2. Click "Charge"
3. Select **Cash** payment
4. Enter amount (e.g., $20)
5. Verify change calculated
6. Click **Complete**
7. Should complete successfully ✅

### Test Card Payment (with Terminal)

**Prerequisites:**
- Payment processor configured in database
- Terminal linked to register
- Terminal powered on and connected

**Steps:**
1. Add product to cart
2. Click "Charge"
3. Select **Card** payment
4. Should see:
   - 🟢 Connected status
   - Processor name
   - "Ready to process $X.XX" message
5. Click **Complete**
6. Watch console for:
   ```
   💳 processCardPayment started
   💳 Making API request to: https://whaletools.dev/api/pos/payment/process
   💳 Request body: {...}
   💳 Response status: 200 OK
   💳 Response body: { success: true, ... }
   💳 Payment successful!
   ```
7. Terminal should display amount
8. Customer completes payment on terminal
9. Sale completes ✅

### Test Card Payment (No Terminal)

If no payment processor is configured:

1. Add product to cart
2. Click "Charge"
3. Select **Card** payment
4. Should see: "Loading payment terminal..." or "Manual card entry - No terminal configured"
5. Clicking Complete will show error: "Payment processor not configured"

---

## 🔍 Debugging Checklist

### If Card Payment Fails

**Check Console Logs:**
```
💳 processCardPayment started { locationId: '...', registerId: '...', total: 10.66 }
💳 Making API request to: https://whaletools.dev/api/pos/payment/process
💳 Request body: { locationId, registerId, amount, paymentMethod: 'credit', referenceId: 'POS-...' }
💳 Response status: 400 Bad Request  // ❌ ERROR HERE
💳 Response body: { success: false, error: '...' }
💳 Payment failed: ...
```

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Location ID required" | `locationId` is null/undefined | Ensure location selected before checkout |
| "Authentication required" | Not logged in | Check user session |
| "Missing required field: locationId" | API validation failed | Check request body has all fields |
| "Payment processor not configured" | No processor linked to register | Link processor in database |
| "Terminal not available" | Terminal offline | Check terminal power/network |
| "Invalid TPN configuration" | Wrong Terminal Profile Number | Verify TPN in database matches Dejavoo account |

---

### If Loyalty Points Don't Load

**Error:**
```
'⚠️ Loyalty program API returned non-OK status:', 401
```

**Check:**
1. Is vendor ID set?
   ```typescript
   console.log('Vendor ID:', vendorId)
   ```
2. Is endpoint correct?
   ```
   GET https://whaletools.dev/api/vendor/loyalty/program
   Headers: { 'x-vendor-id': vendorId }
   ```
3. Check web app API response:
   ```bash
   # In web app terminal
   tail -f logs/api.log | grep loyalty
   ```

---

## 📊 Payment Flow Diagram

```
User clicks "Charge $X.XX"
    ↓
POSPaymentModal opens
    ↓
User selects payment method:
    ├─ Cash → Enter amount → Calculate change → Complete ✅
    ├─ Card → processCardPayment()
    │    ├─ Check locationId ✅
    │    ├─ Get auth session ✅
    │    ├─ POST /api/pos/payment/process
    │    │    ├─ Request: { locationId, registerId, amount, paymentMethod: 'credit' }
    │    │    └─ Response: { success: true, authorizationCode, transactionId, cardType, cardLast4 }
    │    └─ Return payment data → Complete ✅
    └─ Split → Add multiple payments → Complete ✅
    ↓
onPaymentComplete({ paymentMethod, authorizationCode, ... })
    ↓
POSScreen → handlePaymentComplete()
    ↓
POST /api/pos/sales/create
    ├─ Create order ✅
    ├─ Deduct inventory ✅
    ├─ Process loyalty points ✅
    └─ Update session totals ✅
    ↓
Clear cart → Show success ✅
```

---

## 🎯 Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Cash Payments | ✅ Working | No issues |
| Card Payments (Terminal) | ⚠️ Needs Testing | Code complete, needs physical terminal |
| Card Payments (No Terminal) | ✅ Shows Error | Correctly shows "No terminal configured" |
| Split Payments | ⚠️ Partial | Cash works, card needs terminal |
| Loyalty Points Display | ✅ Working | Points shown in cart |
| Loyalty Points Redemption | ⚠️ Needs Fix | API returns 401 |
| Payment Processor Display | ✅ Working | Shows status, name, type |
| Error Handling | ✅ Enhanced | Detailed logging added |

---

## 🚀 Next Steps

1. **Fix Loyalty API 401 Error**
   - Check web app `/api/vendor/loyalty/program` endpoint
   - Verify authentication requirements
   - May need to add vendor context

2. **Test with Physical Terminal**
   - Link Dejavoo terminal to register in database
   - Test card payment with real terminal
   - Verify auth codes and transaction IDs

3. **Test on Real Device**
   - Haptics will work properly
   - Better performance
   - Test complete checkout flow

4. **Remove Debug Logging (Optional)**
   - Once payment processing is stable
   - Remove `console.log` statements from `processCardPayment()`
   - Or wrap in `if (process.env.NODE_ENV === 'development')`

---

## 📞 Support

**If payment processing fails:**
1. Check console logs for detailed error messages
2. Verify all prerequisites (location, register, auth, processor)
3. Test with cash payment first (simpler flow)
4. Check web app API logs
5. Review `DEJAVOO_SETUP_GUIDE.md` for terminal configuration

**Console shows:**
- 💳 = Payment processing logs
- 🔍 = Customer/loyalty logs
- 📊 = Calculation logs
- ✅ = Success
- ❌ = Error
- ⚠️ = Warning
