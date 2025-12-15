# Authorize.Net Payment Gateway Integration

## Architecture Overview

### Two Separate Payment Systems

```
┌─────────────────────────────────────────────────────────────┐
│                      WHALETOOLS PAYMENTS                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐         ┌─────────────────────┐    │
│  │   POS (In-Store)   │         │    E-Commerce       │    │
│  │   Dejavoo SPIN     │         │   Authorize.Net     │    │
│  └────────────────────┘         └─────────────────────┘    │
│           │                              │                  │
│  • Location-based              • Vendor-level              │
│  • Tied to registers           • Single gateway            │
│  • Physical terminals          • Online payments           │
│  • Multiple per vendor         • One per vendor            │
│  • location_id NOT NULL        • location_id IS NULL       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
payment_processors
├── id (UUID)
├── vendor_id (UUID) ─────────► Both use this
├── location_id (UUID) ───────► NULL for e-commerce, set for POS
├── processor_type ───────────► 'authorizenet' | 'dejavoo' | ...
├── processor_name
├── is_active
├── environment ──────────────► 'production' | 'sandbox'
│
├── -- Dejavoo fields (POS)
├── authkey ──────────────────► Dejavoo SPIN auth key
├── tpn ──────────────────────► Dejavoo terminal ID
│
├── -- Authorize.Net fields (E-commerce)
├── api_login_id ─────────────► Authorize.Net API Login ID
├── transaction_key ──────────► Authorize.Net Transaction Key
├── signature_key ────────────► Authorize.Net Signature Key
│
├── -- E-commerce specific
├── is_ecommerce_processor ───► TRUE = vendor-level e-commerce
├── webhook_url ──────────────► For payment notifications
└── webhook_secret ───────────► For webhook verification
```

### Constraints

1. **One e-commerce processor per vendor:**
   ```sql
   UNIQUE INDEX idx_payment_processors_ecommerce_per_vendor
     ON payment_processors (vendor_id)
     WHERE is_ecommerce_processor = TRUE
   ```

2. **E-commerce processors MUST be vendor-level (no location):**
   ```sql
   CHECK (
     (is_ecommerce_processor = FALSE) OR
     (is_ecommerce_processor = TRUE AND location_id IS NULL)
   )
   ```

3. **Credentials required per processor type:**
   ```sql
   CHECK (
     (processor_type = 'dejavoo' AND authkey IS NOT NULL AND tpn IS NOT NULL)
     OR (processor_type = 'authorizenet' AND api_login_id IS NOT NULL AND transaction_key IS NOT NULL)
     OR (processor_type IN ('pax', 'stripe', 'square', 'clover'))
   )
   ```

## Database Functions

### For POS (In-Store)
```sql
SELECT * FROM get_processor_for_register('register-uuid');
```
Returns the Dejavoo processor tied to a specific register/location.

### For E-Commerce (Online)
```sql
SELECT * FROM get_ecommerce_processor('vendor-uuid');
```
Returns the single vendor-level Authorize.Net processor.

## Edge Function Integration

### Process Checkout Function
`supabase/functions/process-checkout/index.ts`

**Already supports both flows:**

1. **POS Flow:**
   - Get processor via `get_processor_for_register(registerId)`
   - Routes to Dejavoo SPIN if `processor_type = 'dejavoo'`
   - Routes to Authorize.Net if `processor_type = 'authorizenet'`

2. **E-Commerce Flow (future):**
   - Get processor via `get_ecommerce_processor(vendorId)`
   - Always uses Authorize.Net
   - Card data tokenized via Accept.js (client-side)

### Authorize.Net Client (Lines 340-535)

```typescript
class AuthorizeNetClient {
  constructor(apiLoginId, transactionKey, environment)

  async processSale(request, cardToken?) {
    // authCaptureTransaction (auth + capture in one call)
    // Returns: responseCode, transId, authCode, accountNumber, accountType
  }

  async voidTransaction(transactionId) {
    // Void before settlement
  }
}
```

**Response Codes:**
- `1` = Approved
- `2` = Declined
- `3` = Error
- `4` = Held for review

## Configuration

### Example: Create E-Commerce Processor

```sql
INSERT INTO payment_processors (
  vendor_id,
  processor_type,
  processor_name,
  is_ecommerce_processor,
  is_active,
  environment,
  api_login_id,
  transaction_key,
  signature_key
) VALUES (
  'your-vendor-uuid',
  'authorizenet',
  'E-Commerce Gateway',
  TRUE,  -- Vendor-level e-commerce processor
  TRUE,
  'sandbox',  -- or 'production'
  'your-api-login-id',
  'your-transaction-key',
  'your-signature-key'  -- optional
);
```

### Example: Create POS Processor

```sql
INSERT INTO payment_processors (
  vendor_id,
  location_id,
  processor_type,
  processor_name,
  is_ecommerce_processor,
  is_active,
  environment,
  authkey,
  tpn
) VALUES (
  'your-vendor-uuid',
  'your-location-uuid',  -- Tied to specific location
  'dejavoo',
  'Downtown Location Terminal',
  FALSE,  -- POS processor, not e-commerce
  TRUE,
  'production',
  'your-spin-authkey',
  'your-terminal-id'
);
```

## UI Integration

### Settings Location

**POS Processors:**
- Settings → Locations → [Select Location] → Payment Processors
- Shows location-specific Dejavoo terminals
- File: `src/components/settings/details/LocationConfigurationDetail.tsx`

**E-Commerce Processor:**
- Settings → Account → E-Commerce Gateway (NEW SECTION NEEDED)
- Shows single vendor-level Authorize.Net gateway
- File: `src/components/settings/details/AccountDetail.tsx` (TO BE MODIFIED)

### UI Components Needed

1. **E-Commerce Processor Section** (in AccountDetail.tsx)
   ```typescript
   // Add section similar to LocationConfigurationDetail
   // But for vendor-level e-commerce processor

   - Display current Authorize.Net gateway (if configured)
   - "Configure E-Commerce Gateway" button
   - Test connection button
   - Shows: API Login ID (masked), Environment, Status
   ```

2. **ECommerceProcessorModal.tsx** (NEW)
   ```typescript
   interface ECommerceProcessorModalProps {
     visible: boolean
     vendorId: string
     existingProcessor?: PaymentProcessor | null
     onClose: () => void
     onSave: () => void
   }

   // Form fields:
   // - Processor Name (default: "E-Commerce Gateway")
   // - Environment (Sandbox / Production)
   // - API Login ID
   // - Transaction Key (password field)
   // - Signature Key (optional, password field)
   // - Test Connection button
   ```

3. **Test Connection Edge Function** (NEW)
   ```typescript
   // supabase/functions/test-authorizenet/index.ts
   // Performs $0.01 auth + immediate void
   // Returns success/failure
   ```

## Payment Flow

### E-Commerce Checkout (Future Next.js)

```typescript
// 1. Client-side: Tokenize card with Accept.js
const { opaqueData } = await AcceptUI.dispatchData({
  authData: { clientKey, apiLoginId },
  cardData: { cardNumber, expirationDate, cardCode }
})

// 2. Send to Edge Function
const response = await fetch('/process-checkout', {
  method: 'POST',
  body: JSON.stringify({
    vendorId: 'vendor-uuid',
    locationId: null,  // No location for e-commerce
    registerId: null,  // No register for e-commerce
    items: [...],
    total: 99.99,
    paymentMethod: 'credit',
    metadata: {
      cardToken: opaqueData.dataValue,  // Accept.js token
      source: 'ecommerce'
    }
  })
})

// 3. Edge Function detects e-commerce order (no registerId)
//    Gets processor via get_ecommerce_processor(vendorId)
//    Routes to AuthorizeNetClient
//    Creates atomic order (payment + inventory + loyalty)
```

### POS Checkout (Current)

```typescript
// Same as before, but now supports Authorize.Net if configured
// Gets processor via get_processor_for_register(registerId)
// Routes to appropriate client (SPIN or Authorize.Net)
```

## Testing

### Sandbox Credentials
Sign up at: https://developer.authorize.net/hello_world/sandbox/

**Test Cards (Sandbox):**
- **Approved:** 4111111111111111
- **Declined:** 4000300011112220
- **AVS Mismatch:** 4222222222222

**Test Data:**
- Expiration: Any future date (e.g., 12/2025)
- CVV: Any 3 digits (e.g., 123)
- Zip: Any 5 digits (e.g., 12345)

### Test Scenarios

1. **$0.01 Auth + Void** (Test Connection)
   ```typescript
   const result = await anetClient.processSale({ amount: 0.01, invoiceNumber: 'TEST' })
   if (result.transactionResponse.responseCode === '1') {
     await anetClient.voidTransaction(result.transactionResponse.transId)
   }
   ```

2. **Full E-Commerce Order**
   - Create product in inventory
   - Process payment via Authorize.Net
   - Verify atomic order creation
   - Check inventory deduction
   - Verify loyalty points update

3. **Error Handling**
   - Declined card
   - Network timeout
   - Invalid credentials
   - Inventory rollback on payment failure

## Migration Path

### Step 1: Apply Migrations
```bash
# Development database
supabase db push

# Or manually:
psql $DATABASE_URL < supabase/migrations/107_add_authorizenet_support.sql
psql $DATABASE_URL < supabase/migrations/108_add_ecommerce_processor_flags.sql
```

### Step 2: Configure E-Commerce Processor
```sql
-- Via SQL (or build UI)
INSERT INTO payment_processors (...) VALUES (...);
```

### Step 3: Test Connection
```bash
# Create test Edge Function
supabase functions new test-authorizenet
# Implement $0.01 auth + void test
```

### Step 4: Build UI (AccountDetail.tsx)
- Add "E-Commerce Gateway" section
- Show processor status
- Add configure/edit button
- Create ECommerceProcessorModal component

### Step 5: Integrate Next.js Website
- Use Accept.js for client-side card tokenization
- Send token to process-checkout Edge Function
- Edge Function uses `get_ecommerce_processor(vendorId)`
- Atomic order creation

## Security

### PCI Compliance
- **POS:** Card data handled by Dejavoo terminal (PCI compliant device)
- **E-Commerce:** Card data tokenized client-side via Accept.js (never touches your server)
- **Backend:** Only stores transaction IDs, auth codes, last 4 digits

### Data Storage
**Never store:**
- ❌ Full card numbers
- ❌ CVV codes
- ❌ Raw card data

**Safe to store:**
- ✅ Transaction IDs
- ✅ Authorization codes
- ✅ Last 4 digits
- ✅ Card type (Visa, MC, etc.)
- ✅ Tokenized data (Accept.js tokens are single-use)

### Credentials Protection
- API Login ID + Transaction Key stored in database (encrypted at rest)
- Never logged or sent to Sentry
- process-checkout scrubs credentials from breadcrumbs
- Use environment variables for Signature Key (webhook validation)

## Next Steps

### Immediate (Backend Complete ✅)
- [x] Database migrations
- [x] Authorize.Net API client
- [x] Edge Function integration
- [x] TypeScript types
- [x] Architecture documentation

### Short Term (Native App UI)
- [ ] Build E-Commerce section in AccountDetail.tsx
- [ ] Create ECommerceProcessorModal component
- [ ] Build test connection Edge Function
- [ ] Test with Authorize.Net sandbox

### Long Term (Next.js Integration)
- [ ] Implement Accept.js in Next.js checkout
- [ ] Configure webhook endpoint for payment notifications
- [ ] Add e-commerce order management UI
- [ ] Production testing with live credentials

## Support

**Authorize.Net Documentation:**
- API Reference: https://developer.authorize.net/api/reference/
- Accept.js Guide: https://developer.authorize.net/api/reference/features/acceptjs.html
- Sandbox: https://developer.authorize.net/hello_world/sandbox/

**Dejavoo SPIN Documentation:**
- API Spec: https://docs.ipospays.com/spin-specification
- REST API: https://app.theneo.io/dejavoo/spin/spin-rest-api-methods

---

**Status:** ✅ Backend integration complete, ready for UI implementation
