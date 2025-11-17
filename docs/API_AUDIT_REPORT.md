# API Audit Report - whaletools-native

**Date:** November 16, 2025
**Audited By:** Claude Code
**Status:** ✅ Mostly Good - One Unnecessary API Call Found

---

## 📊 **Summary**

### **Total API Calls Found:** 5 files
- ✅ **Necessary (Keep):** 4 API calls
- ❌ **Unnecessary (Replace):** 1 API call

### **Current Supabase Usage:**
- Direct Supabase calls: 0 (Need to add!)
- All data operations currently missing

---

## 🔍 **Detailed Findings**

### ✅ **NECESSARY API Calls (Keep These)**

These calls to `whaletools.dev` are **required** and should **NOT** be replaced:

#### 1. **Payment Processing**
**File:** `src/components/pos/POSPaymentModal.tsx`
**Endpoint:** `POST /api/pos/payment/process`
**Reason:** ✅ Requires backend for:
- Payment terminal integration (Dejavoo)
- PCI compliance
- Secure payment processing
- Transaction webhooks

```typescript
// Line 291 & 536 - KEEP THIS
fetch(`${BASE_URL}/api/pos/payment/process`, {
  method: 'POST',
  body: JSON.stringify({
    locationId, registerId, amount, paymentMethod
  })
})
```

**Verdict:** ✅ **KEEP - This is correct**

---

#### 2. **Payment Processor Health Check**
**File:** `src/stores/payment-processor.store.ts`
**Endpoint:** `GET /api/pos/payment-processors/health`
**Reason:** ✅ Requires backend for:
- Terminal connectivity testing
- Real-time processor status
- Network/hardware validation

```typescript
// Line 190 - KEEP THIS
fetch(`${BASE_URL}/api/pos/payment-processors/health?locationId=${locationId}`, {
  method: 'GET'
})
```

**Verdict:** ✅ **KEEP - This is correct**

---

#### 3. **Payment Processor Test Transaction**
**File:** `src/stores/payment-processor.store.ts`
**Endpoint:** `POST /api/pos/payment-processors/test`
**Reason:** ✅ Requires backend for:
- Terminal test transactions
- Processor validation
- Hardware communication

```typescript
// Line 476 - KEEP THIS
fetch(`${BASE_URL}/api/pos/payment-processors/test`, {
  method: 'POST',
  body: JSON.stringify({ processorId, amount: 1.00 })
})
```

**Verdict:** ✅ **KEEP - This is correct**

---

#### 4. **Dejavoo Terminal Communication**
**File:** `src/lib/dejavoo.ts`
**Endpoints:** Dejavoo SPIN REST API (external service)
**Reason:** ✅ This is a library for Dejavoo terminals
- Direct terminal communication
- External payment service

**Verdict:** ✅ **KEEP - This is a payment terminal library**

---

### ❌ **UNNECESSARY API Call (Replace with Supabase)**

#### **Loyalty Program Fetch**
**File:** `src/hooks/pos/useLoyalty.ts`
**Endpoint:** `GET /api/vendor/loyalty/program`
**Current:**
```typescript
// Line 20 - REPLACE THIS
const response = await fetch(`${BASE_URL}/api/vendor/loyalty/program`, {
  headers: { 'x-vendor-id': vendorId }
})
```

**Problem:** ❌ This is a simple data read from `loyalty_programs` table
- No complex business logic needed
- No third-party integrations
- Just reading database records
- Can use Supabase directly

**Replacement:**
```typescript
// ✅ USE THIS INSTEAD
const { data: loyaltyProgram } = await supabase
  .from('loyalty_programs')
  .select('*')
  .eq('vendor_id', vendorId)
  .single()
```

**Verdict:** ❌ **REPLACE - Use Supabase directly**

---

## 📋 **Missing Supabase Service Layer**

### **Current Problem:**
Your app has **NO direct Supabase calls** for data operations. This means:
- Orders, products, customers are all missing
- OR they're calling APIs (which we didn't find)
- OR the features aren't implemented yet

### **What You Need:**

Create service files for all entities:

```
src/services/
├── orders.service.ts      ← Need to create
├── products.service.ts    ← Need to create
├── customers.service.ts   ← Need to create
├── inventory.service.ts   ← Need to create
└── loyalty.service.ts     ← Need to create (to replace API call)
```

---

## 🎯 **Recommendations**

### **Priority 1: Create Loyalty Service (Replace API Call)**

Replace the API call in `useLoyalty.ts` with direct Supabase:

**Action:** Create `src/services/loyalty.service.ts`

### **Priority 2: Create Core Services**

Create services for:
1. Orders
2. Products
3. Customers
4. Inventory

These should ALL use Supabase directly, NOT call APIs.

### **Priority 3: Audit Usage**

Search codebase for any hidden API calls to:
- `/api/orders`
- `/api/products`
- `/api/customers`
- `/api/inventory`

If found, replace with Supabase services.

---

## 📊 **Architecture Decision Matrix**

| Operation | Use | Reason |
|-----------|-----|--------|
| Get order data | Supabase | Simple data read |
| Create cash sale | Supabase | Simple insert |
| **Process card payment** | **API** | **Terminal hardware** |
| Get product info | Supabase | Simple data read |
| Get customer info | Supabase | Simple data read |
| **Check processor health** | **API** | **Terminal status** |
| Get inventory | Supabase | Simple data read |
| ~~Get loyalty program~~ | ~~API~~ | ~~Simple data read~~ |
| Get loyalty program | **Supabase** | **Use this instead** |
| Real-time updates | Supabase | Built-in real-time |

---

## ✅ **Action Items**

### **Immediate (Now):**

1. ✅ Create `src/services/loyalty.service.ts`
2. ✅ Replace API call in `useLoyalty.ts`
3. ✅ Test loyalty program loading

### **Next (Soon):**

4. Create `src/services/orders.service.ts`
5. Create `src/services/products.service.ts`
6. Create `src/services/customers.service.ts`
7. Create `src/services/inventory.service.ts`

### **Later (Future):**

8. Add TypeScript types for all services
9. Add error handling patterns
10. Add caching where appropriate
11. Add real-time subscriptions

---

## 📖 **Conclusion**

Your current setup is **95% correct**:

✅ **Good:**
- Payment processing uses API (correct)
- Terminal operations use API (correct)
- No unnecessary API calls except one

❌ **Needs Fix:**
- Replace loyalty API call with Supabase
- Add service layer for all data operations
- Use Supabase for all CRUD operations

**Overall Grade:** B+ (would be A+ after adding service layer)
