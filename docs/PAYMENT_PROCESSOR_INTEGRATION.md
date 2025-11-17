# Payment Processor Integration - Architecture & Flow

## Overview
WhaleTools Native integrates with Dejavoo payment terminals via the WhaleTools backend API using the SPIN protocol. This document outlines the complete architecture to prevent future integration issues.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Native App (iOS)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POSScreen.tsx                                                   │
│    └─> POSCheckout.tsx                                          │
│          ├─> POSPaymentModal.tsx  ← USER PAYMENT INTERFACE     │
│          └─> POSCheckout.handlePaymentComplete()               │
│                                                                  │
│  Payment Processor Store (Zustand)                              │
│    └─> payment-processor.store.ts                              │
│          ├─> checkStatus()         ← HEALTH MONITORING         │
│          ├─> currentProcessor      ← ACTIVE TERMINAL           │
│          └─> processorStatus       ← CONNECTION STATE          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    HTTPS (Authorization: Bearer)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              WhaleTools Backend API (Next.js)                   │
│                   https://whaletools.dev                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /api/pos/payment-processors/health                             │
│    ├─> Checks terminal connectivity                            │
│    └─> Returns: { is_live, processor_id, processor_name }      │
│                                                                  │
│  /api/pos/payment/process                                       │
│    ├─> Validates request (locationId, amount, paymentMethod)   │
│    ├─> Gets processor config from Supabase                     │
│    ├─> Calls DejavooClient.processSale()                       │
│    └─> Returns: { success, transactionId, authCode, cardType } │
│                                                                  │
│  DejavooClient (lib/payment-processors/dejavoo.ts)              │
│    ├─> SPIN API integration                                    │
│    ├─> sale() - Process card payment                           │
│    ├─> ping() - Health check                                   │
│    └─> Configuration: authKey, TPN, environment                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    SPIN Protocol (HTTPS)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Dejavoo Payment Terminal                      │
│                      (Physical Hardware)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Integration Points

### 1. Environment Configuration
**File:** `.env`
```bash
# REQUIRED: Backend API URL
EXPO_PUBLIC_API_URL=https://whaletools.dev

# REQUIRED: Supabase for auth
EXPO_PUBLIC_SUPABASE_URL=https://uaednwpxursknmwdeejn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

**⚠️ CRITICAL:** After changing `.env`, you MUST rebuild the iOS app in Xcode. Expo Metro bundler does NOT reload environment variables.

### 2. Payment Flow Sequence

#### A. Health Check (Continuous Monitoring)
```typescript
// src/stores/payment-processor.store.ts
checkStatus(locationId, registerId) {
  // 1. Validate enabled and locationId
  // 2. GET /api/pos/payment-processors/health?locationId={id}
  // 3. Update store state: processors[], currentProcessor, status
  // 4. Runs every 30 seconds via startPaymentProcessorMonitoring()
}
```

**Backend:** `/app/api/pos/payment-processors/health/route.ts`
- Queries `payment_processors` table
- Calls `DejavooClient.ping()` for each processor
- Returns health status array

#### B. Card Payment Processing
```typescript
// src/components/pos/POSPaymentModal.tsx
handleCardPayment() {
  // 1. Validate currentProcessor exists
  // 2. Get Supabase auth session
  // 3. POST /api/pos/payment/process
  //    Body: { locationId, registerId, amount, paymentMethod: 'credit' }
  // 4. Receive: { success, transactionId, authorizationCode, cardType, cardLast4 }
  // 5. Call onPaymentComplete(paymentData)
}
```

**Backend:** `/app/api/pos/payment/process/route.ts`
- Validates: locationId, amount, paymentMethod
- Gets processor via `getPaymentProcessorForRegister()` or `getPaymentProcessor()`
- Calls `processor.processSale(request)`
- DejavooClient sends SPIN API request to terminal
- Returns transaction result

#### C. Transaction Save
```typescript
// src/components/pos/checkout/POSCheckout.tsx
handlePaymentComplete(paymentData) {
  // 1. Normalize payment method: 'card' → 'credit'
  // 2. Call Supabase RPC: create_pos_sale()
  //    - Saves order
  //    - Saves payment transaction
  //    - Updates inventory
  //    - Adds loyalty points
  // 3. Show success modal
  // 4. Clear cart
}
```

---

## Payment Method Mapping

**⚠️ CRITICAL:** Database constraint requires lowercase payment methods.

| Frontend | Backend API | Database |
|----------|-------------|----------|
| `'card'` | `'credit'` | `'credit'` |
| `'cash'` | `'cash'` | `'cash'` |

**Mapping Function:**
```typescript
// src/components/pos/checkout/POSCheckout.tsx:168
const normalizePaymentMethod = (method: string): string => {
  if (method === 'card') return 'credit'
  return method.toLowerCase()
}
```

---

## State Management

### Payment Processor Store
**File:** `src/stores/payment-processor.store.ts`

**State:**
```typescript
{
  status: 'connected' | 'disconnected' | 'error' | 'checking'
  processors: ProcessorInfo[]          // All processors for location
  currentProcessor: ProcessorInfo       // Active processor (first online)
  onlineCount: number                   // Number of live processors
  totalCount: number                    // Total processors configured
  isEnabled: boolean                    // Feature flag
  locationId: string | null             // Current location
  registerId: string | null             // Current register
  activityLog: ActivityLog[]            // Last 20 health checks
}
```

**Actions:**
- `checkStatus()` - Query backend health endpoint
- `setLocationId()` - Update location and auto-check
- `setRegisterId()` - Update register and auto-check
- `setEnabled()` - Enable/disable processor
- `addActivityLog()` - Track health check events

**Monitoring:**
```typescript
// Auto-started on POS screen mount
startPaymentProcessorMonitoring(locationId, registerId)
// Checks every 30 seconds
// Stops on unmount: stopPaymentProcessorMonitoring()
```

---

## Error Handling

### Common Issues & Solutions

#### 1. "No payment processor configured"
**Cause:** `currentProcessor` is null
**Check:**
- Is `isEnabled` true?
- Is `locationId` set?
- Are processors in database? Query: `SELECT * FROM payment_processors WHERE location_id = ?`
- Is RLS allowing access? Use service role key for backend queries

#### 2. "Network request failed"
**Cause:** Wrong API URL or app not rebuilt
**Fix:**
1. Check `.env`: `EXPO_PUBLIC_API_URL=https://whaletools.dev`
2. Rebuild in Xcode (environment variables don't hot reload)
3. Verify backend is running

#### 3. "Payment method constraint violation"
**Cause:** Sending 'card' instead of 'credit' to database
**Fix:** Use `normalizePaymentMethod()` before calling RPC

#### 4. Mock payment data appearing
**Cause:** POSPaymentModal using hardcoded mock values instead of API
**Fix:** Ensure `handleCardPayment()` calls `/api/pos/payment/process` API endpoint

---

## Testing Checklist

### Manual Testing
- [ ] Health check shows terminal as "connected"
- [ ] Card payment sends to real terminal (not mock data)
- [ ] Transaction saves to database successfully
- [ ] Authorization code from real terminal (not `AUTH{timestamp}`)
- [ ] Card type and last 4 digits from real card
- [ ] Split payment works for card portion
- [ ] Cash payment works without processor
- [ ] Success modal shows correct transaction data

### Integration Tests
See: `src/hooks/pos/__tests__/payment-processor.test.ts`

### Validation
```bash
# Check processor health
curl -H "Authorization: Bearer <token>" \
  "https://whaletools.dev/api/pos/payment-processors/health?locationId=<id>"

# Should return:
# { results: [{ processor_id, is_live: true, processor_name }] }
```

---

## Database Schema

### payment_processors
```sql
CREATE TABLE payment_processors (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL,
  location_id UUID NOT NULL,
  processor_name TEXT,
  processor_type TEXT DEFAULT 'dejavoo',
  dejavoo_authkey TEXT,
  dejavoo_tpn TEXT,
  environment TEXT DEFAULT 'production',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### payment_transactions
```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  payment_method TEXT CHECK (payment_method IN (
    'credit', 'debit', 'ebt_food', 'ebt_cash', 'gift', 'cash', 'check'
  )),
  amount DECIMAL(10,2),
  authorization_code TEXT,
  transaction_id TEXT,
  card_type TEXT,
  card_last4 TEXT,
  payment_processor_id UUID REFERENCES payment_processors(id),
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Maintenance Guidelines

### Before Making Changes
1. Read this document completely
2. Review `MODAL_RENDERING_PATTERNS.md` for modal best practices
3. Check existing tests in `src/hooks/pos/__tests__/`

### After Making Changes
1. Update this document if architecture changes
2. Add/update tests for new functionality
3. Test on real hardware (Dejavoo terminal)
4. Verify no mock data in production code

### Code Review Checklist
- [ ] No mock payment data (`AUTH${Date.now()}`, hardcoded card numbers)
- [ ] All payment methods normalized before database insert
- [ ] Error handling for network failures
- [ ] Timeout handling (60s for payments, 10s for health checks)
- [ ] Proper TypeScript types for payment data
- [ ] Activity logging for debugging

---

## Troubleshooting Commands

```bash
# Check environment variables in running app
# Add to POSPaymentModal.tsx temporarily:
console.log('API URL:', process.env.EXPO_PUBLIC_API_URL)

# Query processors in database
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  '<SERVICE_ROLE_KEY>'
);
supabase.from('payment_processors')
  .select('*')
  .eq('location_id', '<LOCATION_ID>')
  .then(r => console.log(JSON.stringify(r.data, null, 2)));
"

# Test health endpoint
curl -H "Authorization: Bearer <TOKEN>" \
  "https://whaletools.dev/api/pos/payment-processors/health?locationId=<ID>"

# Test payment endpoint
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"locationId":"<ID>","amount":1.00,"paymentMethod":"credit"}' \
  "https://whaletools.dev/api/pos/payment/process"
```

---

## Version History

- **2025-11-17:** Initial documentation after fixing mock payment data issue
- Issue: POSPaymentModal was using mock data instead of calling real API
- Fix: Added API calls to `/api/pos/payment/process` endpoint
- Added: Payment method normalization to prevent database constraint violations

---

## Related Documentation
- `MODAL_RENDERING_PATTERNS.md` - Modal architecture best practices
- `APP_THEMING_GUIDE.md` - UI/UX guidelines
- Backend: `/Users/whale/Desktop/whaletools/lib/payment-processors/dejavoo.ts`
- Backend API: `/Users/whale/Desktop/whaletools/app/api/pos/payment-processors/`
