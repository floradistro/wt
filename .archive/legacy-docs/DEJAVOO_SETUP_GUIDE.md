# Dejavoo Payment Terminal Setup Guide

## 🎯 Overview

This guide shows you how to set up Dejavoo payment terminals with your POS system.

---

## 📋 Prerequisites

1. **Dejavoo Merchant Account**
   - Sign up at https://dejavoo.com
   - Contact their sales team for merchant onboarding
   - You'll receive:
     - Auth Key (API authentication)
     - TPN (Terminal Profile Number for each terminal)
     - Merchant credentials

2. **Physical Terminal**
   - Dejavoo Z-Series or QD-Series terminal
   - Connected to internet (WiFi or Ethernet)
   - Powered on and activated

3. **Database Access**
   - Admin access to your Supabase database
   - Ability to insert/update records

---

## 🔧 Step 1: Create Payment Processor Record

### Option A: Using Supabase Dashboard

1. Navigate to **Table Editor** → `payment_processors`
2. Click **Insert** → **Insert row**
3. Fill in the fields:

```
vendor_id: [Select your vendor from dropdown]
processor_name: "Dejavoo Terminal 1" (or any name you want)
processor_type: "dejavoo"
authkey: "your-auth-key-from-dejavoo"
tpn: "your-terminal-profile-number"
is_active: true
environment: "production" (or "sandbox" for testing)
config: {
  "timeout": 120,
  "location_id": "your-location-id"
}
```

4. Click **Save**
5. Copy the generated `id` (you'll need this for Step 2)

### Option B: Using SQL Editor

```sql
INSERT INTO payment_processors (
  vendor_id,
  processor_name,
  processor_type,
  authkey,
  tpn,
  is_active,
  environment,
  config
) VALUES (
  'your-vendor-id',          -- Replace with your vendor ID
  'Dejavoo Terminal 1',      -- Friendly name for the terminal
  'dejavoo',                 -- Don't change this
  'your-auth-key-here',      -- From Dejavoo
  'your-tpn-here',           -- From Dejavoo
  true,                      -- Active
  'production',              -- or 'sandbox'
  '{"timeout": 120, "location_id": "your-location-id"}'::jsonb
) RETURNING id;
```

**Copy the returned `id` - you'll need it next!**

---

## 🔧 Step 2: Link Processor to Register

### Option A: Using Supabase Dashboard

1. Navigate to **Table Editor** → `pos_registers`
2. Find the register you want to link
3. Click **Edit**
4. Set `payment_processor_id` to the processor ID from Step 1
5. Click **Save**

### Option B: Using SQL Editor

```sql
-- Link processor to a specific register
UPDATE pos_registers
SET payment_processor_id = 'processor-id-from-step-1'
WHERE id = 'your-register-id';

-- To find your register IDs:
SELECT id, register_name, location_id
FROM pos_registers
WHERE vendor_id = 'your-vendor-id';
```

---

## 🧪 Step 3: Test Terminal Connection

### Via Web App (Recommended)

1. Log in to your web app
2. Navigate to **Settings** → **Operations** → **Payment Processors**
3. Find your terminal in the list
4. Click **Test Connection**
5. The terminal should display a $0.01 test charge
6. Cancel on the terminal (no actual charge)
7. Verify "Test Successful" message

### Via Native App

1. Open the native POS app
2. Select location
3. Select register (the one with processor linked)
4. Wait for Payment Processor Status to load
5. Status should show:
   - 🟢 **Connected** (green dot)
   - Processor name
   - "Last checked: just now"
6. Click **Test** button
7. Terminal should display $0.01 test charge
8. Cancel on terminal
9. Verify success message

### Via API (Advanced)

```bash
# Get your access token first
export ACCESS_TOKEN="your-jwt-token"

# Test payment processor health
curl -X GET "https://your-domain.com/api/pos/payment-processors/health?locationId=your-location-id" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Should return:
{
  "results": [
    {
      "processor_id": "...",
      "processor_name": "Dejavoo Terminal 1",
      "processor_type": "dejavoo",
      "is_live": true,
      "last_checked": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## 🧪 Step 4: Test Real Transaction

### Important: Use a TEST CARD first!

**Dejavoo Test Cards (Sandbox Environment):**
- Visa: `4111 1111 1111 1111`
- Mastercard: `5555 5555 5555 4444`
- Amex: `3782 822463 10005`
- Expiry: Any future date
- CVV: Any 3-4 digits

**Testing Steps:**

1. **Add test product to cart**
   - Use a low-value product (e.g., $1.00 item)

2. **Select card payment**
   - Click "Charge $X.XX"
   - Select "Card" payment method
   - Click "Complete"

3. **Terminal interaction**
   - Terminal displays amount
   - Terminal prompts for card
   - Swipe/insert test card
   - Wait for approval

4. **Verify result**
   - Native app shows success
   - Order number generated
   - Inventory deducted
   - Transaction recorded

5. **Check transaction in Dejavoo portal**
   - Log in to Dejavoo merchant portal
   - Navigate to Transactions
   - Verify transaction appears
   - Verify auth code matches

---

## 🚨 Troubleshooting

### Issue: "Terminal not available"

**Possible Causes:**
1. Terminal is powered off → Turn it on
2. Terminal not connected to internet → Check WiFi/Ethernet
3. TPN is incorrect → Verify TPN in Dejavoo portal
4. Terminal not activated → Contact Dejavoo support

**Solution:**
```sql
-- Verify TPN is correct
SELECT tpn, authkey FROM payment_processors
WHERE id = 'your-processor-id';
```

### Issue: "Invalid credentials"

**Possible Causes:**
1. Auth key is incorrect
2. Auth key expired
3. Using sandbox key with production environment

**Solution:**
```sql
-- Update auth key
UPDATE payment_processors
SET authkey = 'new-auth-key-from-dejavoo'
WHERE id = 'your-processor-id';
```

### Issue: "Transaction timeout"

**Possible Causes:**
1. Terminal not responding
2. Customer didn't complete transaction
3. Network latency

**Solution:**
```sql
-- Increase timeout to 3 minutes
UPDATE payment_processors
SET config = jsonb_set(
  config,
  '{timeout}',
  '180'
)
WHERE id = 'your-processor-id';
```

### Issue: "Payment processor status shows offline"

**Check:**
1. Verify processor record exists:
```sql
SELECT * FROM payment_processors
WHERE id = 'your-processor-id';
```

2. Verify register linkage:
```sql
SELECT r.id, r.register_name, r.payment_processor_id, p.processor_name
FROM pos_registers r
LEFT JOIN payment_processors p ON r.payment_processor_id = p.id
WHERE r.id = 'your-register-id';
```

3. Check health endpoint manually:
```bash
curl -X GET "https://your-domain.com/api/pos/payment-processors/health?locationId=your-location-id" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## 📊 Monitoring Terminal Health

### Auto-Monitoring

The native app automatically monitors terminal health:
- **Frequency:** Every 30 seconds
- **Endpoint:** `/api/pos/payment-processors/health`
- **Status Updates:** Real-time in Payment Processor Status component
- **Activity Log:** Last 20 health checks visible

### Manual Health Check

```typescript
// In native app code
import { usePaymentProcessor } from '@/stores/payment-processor.store'

// Check status manually
const { checkStatus } = usePaymentProcessor.getState()
await checkStatus(locationId, registerId)

// Send test transaction
const { sendTestTransaction } = usePaymentProcessor.getState()
const result = await sendTestTransaction()
```

---

## 🔐 Security Best Practices

### 1. Protect Auth Keys

**NEVER commit auth keys to git:**

```bash
# In your .env file (web app):
DEJAVOO_AUTH_KEY=your-key-here

# Access in code:
const authkey = process.env.DEJAVOO_AUTH_KEY
```

### 2. Use Environment Variables

**Database config should reference env vars:**

```sql
-- Instead of storing key directly, store reference
UPDATE payment_processors
SET config = jsonb_set(
  config,
  '{authkey_env}',
  '"DEJAVOO_AUTH_KEY_TERMINAL_1"'
)
WHERE id = 'your-processor-id';
```

### 3. Rotate Keys Regularly

- Change auth keys every 90 days
- Update in Dejavoo portal
- Update in database
- Test after rotation

### 4. Restrict Database Access

```sql
-- Only allow service role to read auth keys
ALTER TABLE payment_processors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for auth keys"
ON payment_processors
FOR SELECT
TO service_role
USING (true);
```

---

## 📚 Additional Resources

### Dejavoo Documentation
- **API Docs:** https://app.theneo.io/dejavoo/spin/spin-rest-api-methods
- **Support Portal:** https://support.dejavoo.com
- **Merchant Portal:** https://portal.dejavoo.com

### Your Implementation Files
- **Dejavoo Client:** `/src/lib/dejavoo.ts` (native app)
- **Dejavoo Client:** `/lib/payment-processors/dejavoo.ts` (web app)
- **Payment API:** `/app/api/pos/payment/process/route.ts` (web app)
- **Payment Modal:** `/src/components/pos/POSPaymentModal.tsx` (native app)
- **Processor Store:** `/src/stores/payment-processor.store.ts` (native app)

### Database Tables
- `payment_processors` - Processor configuration
- `pos_registers` - Register configuration
- `payment_transactions` - Transaction records
- `pos_transactions` - POS transaction records
- `orders` - Order records

---

## ✅ Setup Checklist

- [ ] Dejavoo merchant account created
- [ ] Physical terminal received and activated
- [ ] Terminal connected to internet
- [ ] Payment processor record created in database
- [ ] Auth key and TPN configured
- [ ] Processor linked to register
- [ ] Terminal health check passing
- [ ] Test transaction successful (sandbox)
- [ ] Test transaction successful (production test card)
- [ ] Real transaction successful
- [ ] Transaction appears in Dejavoo portal
- [ ] Inventory deduction working
- [ ] Session totals updating
- [ ] Loyalty points working (if applicable)

---

## 🎉 You're Done!

Your Dejavoo terminal is now fully integrated with your POS system!

Customers can now:
- Pay with credit/debit cards
- Receive instant authorization
- Get automatic inventory deduction
- Earn loyalty points
- See transactions in your dashboard

Need help? Check the troubleshooting section or contact support.
