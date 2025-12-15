# WhaleTools Native - Payment System Documentation

## Quick Start

### For New Developers
1. Read `PAYMENT_INTEGRATION_COMPLETE.md` - Start here for overview
2. Read `PAYMENT_PROCESSOR_INTEGRATION.md` - Detailed architecture
3. Run tests: `npm test payment-processor.test.ts`

### For Code Reviews
See **Code Review Checklist** in `PAYMENT_INTEGRATION_COMPLETE.md`

### For Debugging
See **Monitoring & Debugging** section in `PAYMENT_INTEGRATION_COMPLETE.md`

---

## File Structure

```
whaletools-native/
├── PAYMENT_INTEGRATION_COMPLETE.md       ← START HERE
├── PAYMENT_PROCESSOR_INTEGRATION.md      ← Architecture details
│
├── src/
│   ├── components/pos/
│   │   ├── POSPaymentModal.tsx           ← Payment UI + API calls
│   │   └── checkout/
│   │       └── POSCheckout.tsx           ← Transaction saving
│   │
│   ├── stores/
│   │   └── payment-processor.store.ts    ← Health monitoring
│   │
│   ├── utils/
│   │   └── payment-validation.ts         ← Runtime safeguards
│   │
│   └── hooks/pos/__tests__/
│       └── payment-processor.test.ts     ← Integration tests
│
└── .env                                   ← EXPO_PUBLIC_API_URL
```

---

## Payment Flow Overview

```
┌─────────────────┐
│   User Taps     │
│  "Card Payment" │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  POSPaymentModal.handleCardPayment()        │
│  ├─ Validate processor is online            │
│  ├─ POST /api/pos/payment/process           │
│  ├─ Validate API response                   │
│  └─ Return real transaction data            │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  POSCheckout.handlePaymentComplete()        │
│  ├─ Validate payment data is real           │
│  ├─ Normalize payment method                │
│  ├─ Validate payment method                 │
│  ├─ Call create_pos_sale() RPC              │
│  └─ Show success modal                      │
└─────────────────────────────────────────────┘
```

---

## Critical Rules

### 🚨 NEVER:
- Use mock payment data (`AUTH${Date.now()}`, etc.)
- Hardcode card numbers in production code
- Skip payment method normalization
- Bypass validation functions
- Commit `.env` to version control

### ✅ ALWAYS:
- Call `/api/pos/payment/process` for card payments
- Use `normalizePaymentMethod()` before saving
- Use validation functions from `payment-validation.ts`
- Run tests before committing
- Rebuild in Xcode after changing `.env`

---

## Environment Setup

### Required Environment Variables
```bash
# .env (NEVER commit this file!)
EXPO_PUBLIC_API_URL=https://whaletools.dev
EXPO_PUBLIC_SUPABASE_URL=https://uaednwpxursknmwdeejn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### After Changing `.env`:
**CRITICAL:** Rebuild the iOS app in Xcode. Metro bundler does NOT hot-reload environment variables.

---

## Testing

### Run Tests
```bash
npm test payment-processor.test.ts
```

### Manual Testing Checklist
- [ ] Health check shows processor connected
- [ ] Card payment sends to real terminal (watch terminal display)
- [ ] Transaction appears in database with real auth code
- [ ] Success modal shows correct transaction details
- [ ] No console errors about mock data

---

## Common Issues

### "No payment processor configured"
**Cause:** Processor is offline or not in database
**Fix:** Check database, verify RLS policies, check health endpoint

### "Payment method constraint violation"
**Cause:** Forgot to normalize payment method
**Fix:** Always use `normalizePaymentMethod()` before saving

### "AUTH1234567890 appears to be mocked"
**Cause:** Mock payment code still in POSPaymentModal
**Fix:** Ensure API call to `/api/pos/payment/process` is working

### "Network request failed"
**Cause:** Wrong API URL or app not rebuilt
**Fix:** Check `.env`, rebuild in Xcode

---

## Code Examples

### ✅ Correct Payment Processing
```typescript
// POSPaymentModal.tsx
const response = await fetch(`${BASE_URL}/api/pos/payment/process`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    locationId,
    registerId,
    amount: total,
    paymentMethod: 'credit',
  }),
})

const result = await response.json()
validatePaymentResponse(result) // ← ALWAYS validate

const paymentData: PaymentData = {
  paymentMethod: 'card',
  authorizationCode: result.authorizationCode, // ← Real data
  transactionId: result.transactionId,          // ← Real data
  cardType: result.cardType,
  cardLast4: result.cardLast4,
}
```

### ✅ Correct Transaction Saving
```typescript
// POSCheckout.tsx
validateRealPaymentData(paymentData) // ← ALWAYS validate

const normalizedPaymentMethod = normalizePaymentMethod(paymentData.paymentMethod)
validatePaymentMethod(normalizedPaymentMethod) // ← ALWAYS validate

await supabase.rpc('create_pos_sale', {
  p_payment_method: normalizedPaymentMethod, // ← Use normalized value
  p_authorization_code: paymentData.authorizationCode,
  p_payment_transaction_id: paymentData.transactionId,
  // ... other fields
})
```

---

## Monitoring

### Check Logs
```bash
# Payment processing
'💳 Processing card payment:'
'💳 Payment successful:'

# Health monitoring
'🔍 checkStatus called'
'🔍 Health check response:'

# Validation
'✅ Payment Environment: API URL = ...'
```

### Check Sentry
- Filter by: `payment`, `processor`, `transaction`
- Look for validation errors
- Check network request failures

### Check Database
```sql
-- Recent transactions
SELECT * FROM payment_transactions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Processor health
SELECT id, processor_name, is_active
FROM payment_processors
WHERE location_id = '<YOUR_LOCATION_ID>';
```

---

## Related Documentation

- `PAYMENT_INTEGRATION_COMPLETE.md` - Complete summary
- `PAYMENT_PROCESSOR_INTEGRATION.md` - Architecture deep dive
- `MODAL_RENDERING_PATTERNS.md` - Modal best practices
- `APP_THEMING_GUIDE.md` - UI/UX guidelines

---

## Support

### Questions?
1. Check the docs above
2. Read the code comments
3. Run the tests to understand expected behavior
4. Check Sentry for production errors

### Making Changes?
1. Read `PAYMENT_PROCESSOR_INTEGRATION.md` completely
2. Understand the validation rules
3. Write/update tests
4. Test on real hardware
5. Update documentation

---

**Last Updated:** 2025-11-17
**Status:** Production Ready ✅
**Test Coverage:** Comprehensive
**Documentation:** Complete
