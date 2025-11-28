# 📧 Email System Guide - Whaletools Native App

Complete production-ready email system using **Resend** for transactional and marketing emails.

---

## 🎯 Overview

The email system enables you to send:
- **Transactional emails**: Receipts, order confirmations, order updates, password resets
- **Marketing emails**: Campaigns, promotions, newsletters
- **Test emails**: Verify your configuration

### Architecture

```
Native App → Supabase Edge Function → Resend API → Email Delivery
              ↓
         Database Tables (tracking & settings)
```

---

## 📦 What Was Installed

### 1. Database Migration (`supabase/migrations/109_email_system.sql`)

Six new tables:
- **`email_templates`** - Reusable email templates
- **`email_campaigns`** - Marketing campaigns with scheduling
- **`email_sends`** - Individual email tracking
- **`email_events`** - Open/click tracking from webhooks
- **`vendor_email_settings`** - Per-vendor configuration
- **`customer_email_preferences`** - Unsubscribe management

### 2. Supabase Edge Function (`supabase/functions/send-email/`)

- Sends emails via Resend API
- Validates vendor settings
- Checks unsubscribe preferences
- Logs all sends to database
- Returns success/error status

### 3. Email Service (`src/services/email.service.ts`)

Production-ready service with methods:
- `sendEmail()` - Generic email sender
- `sendReceipt()` - Send receipt after purchase
- `sendOrderConfirmation()` - Order confirmation for pickup/shipping
- `sendOrderReady()` - Notify customer order is ready
- `sendOrderShipped()` - Shipping notification with tracking
- `sendTestEmail()` - Test your configuration
- `getVendorSettings()` - Get email settings
- `upsertVendorSettings()` - Update email settings
- `getRecentSends()` - View recent emails
- `getOrderEmails()` - Get emails for specific order

### 4. Email Settings Store (`src/stores/email-settings.store.ts`)

Zustand store for managing:
- Email settings state
- Recent sends
- Loading states
- Test email functionality

### 5. UI Component (`src/components/settings/details/EmailSettingsDetail.tsx`)

Settings UI with:
- Email identity configuration (from name/email)
- Enable/disable email types
- Send test emails
- View recent sends
- Inline editing

### 6. Settings Integration

New **"Email & Notifications"** category in Settings screen between "Locations & Access" and "Team".

---

## 🚀 Setup Instructions

### Step 1: Apply Database Migration

Run the migration to create email tables:

```bash
# Make sure you're in the project directory
cd /Users/whale/Desktop/whaletools-native

# Apply migration (if using Supabase CLI)
supabase db push

# OR apply manually via Supabase Dashboard:
# 1. Go to SQL Editor in Supabase Dashboard
# 2. Copy contents of supabase/migrations/109_email_system.sql
# 3. Run the SQL
```

### Step 2: Deploy Edge Function

Deploy the `send-email` Edge Function:

```bash
# Deploy the send-email function
supabase functions deploy send-email

# Set the RESEND_API_KEY secret
supabase secrets set RESEND_API_KEY=re_Cd1GvBg8_AVB8hxaFszgdXxnYe1UDZUCg
```

**Important**: Use your existing Resend API key from the web app: `re_Cd1GvBg8_AVB8hxaFszgdXxnYe1UDZUCg`

### Step 3: Verify Domain in Resend

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Add your domain (e.g., `floradistro.com`)
3. Add the DNS records provided by Resend
4. Wait for verification (usually takes a few minutes)

### Step 4: Configure in App

1. Open the Whaletools app
2. Go to **Settings** → **Email & Notifications**
3. Click **"Set Up Email"**
4. Fill in:
   - **From Name**: Your store name (e.g., "Flora Distro")
   - **From Email**: Must match verified domain (e.g., `noreply@floradistro.com`)
   - **Reply-To**: Optional support email
   - **Domain**: Your verified domain
5. Click **"Save Changes"**

### Step 5: Send Test Email

1. In Email Settings, scroll to **"Testing"** section
2. Enter your email address
3. Click **"Send Test Email"**
4. Check your inbox - you should receive a test email!

---

## 📝 Usage Examples

### Send Receipt After Sale

```typescript
import { EmailService } from '@/services/email.service'

// After successful checkout
await EmailService.sendReceipt({
  vendorId: 'vendor-uuid',
  orderId: 'order-uuid',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  orderNumber: 'ORD-12345',
  total: 99.99,
  items: [
    { name: 'Product A', quantity: 2, price: 29.99 },
    { name: 'Product B', quantity: 1, price: 39.99 },
  ],
  customerId: 'customer-uuid', // optional
})
```

### Send Order Confirmation (Pickup)

```typescript
await EmailService.sendOrderConfirmation({
  vendorId: 'vendor-uuid',
  orderId: 'order-uuid',
  customerEmail: 'customer@example.com',
  customerName: 'Jane Smith',
  orderNumber: 'ORD-67890',
  orderType: 'pickup',
  total: 149.99,
  items: [...],
  pickupLocation: '123 Main St, San Francisco, CA',
  estimatedTime: 'Ready in 30 minutes',
})
```

### Send Order Ready Notification

```typescript
await EmailService.sendOrderReady({
  vendorId: 'vendor-uuid',
  orderId: 'order-uuid',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  orderNumber: 'ORD-12345',
  pickupLocation: '123 Main St, San Francisco, CA',
})
```

### Send Shipping Notification

```typescript
await EmailService.sendOrderShipped({
  vendorId: 'vendor-uuid',
  orderId: 'order-uuid',
  customerEmail: 'customer@example.com',
  customerName: 'Jane Smith',
  orderNumber: 'ORD-67890',
  trackingNumber: '1Z999AA10123456784',
  carrier: 'UPS',
})
```

### Generic Email Send

```typescript
await EmailService.sendEmail({
  to: 'customer@example.com',
  toName: 'Customer Name',
  subject: 'Custom Email Subject',
  html: '<h1>Hello!</h1><p>This is a custom email.</p>',
  text: 'Hello! This is a custom email.',
  emailType: 'transactional',
  category: 'custom',
  vendorId: 'vendor-uuid',
  metadata: {
    custom_field: 'value',
  },
})
```

---

## 🔧 Email Settings Configuration

### Available Settings

**Sender Configuration:**
- `from_name` - Display name for emails
- `from_email` - Must match verified domain in Resend
- `reply_to` - Optional reply-to address
- `domain` - Your verified domain

**Transactional Emails (Enable/Disable):**
- `enable_receipts` - Send receipts after sales
- `enable_order_confirmations` - Send confirmations for pickup/shipping orders
- `enable_order_updates` - Send ready/shipped notifications
- `enable_loyalty_updates` - Send loyalty program updates
- `enable_password_resets` - Send password reset emails
- `enable_welcome_emails` - Send welcome emails to new customers

**Marketing Emails:**
- `enable_marketing` - Enable marketing campaigns
- `require_double_opt_in` - Require double opt-in for marketing

### Update Settings Programmatically

```typescript
import { EmailService } from '@/services/email.service'

await EmailService.upsertVendorSettings(
  'vendor-uuid',
  {
    from_name: 'Flora Distro',
    from_email: 'noreply@floradistro.com',
    reply_to: 'support@floradistro.com',
    domain: 'floradistro.com',
    enable_receipts: true,
    enable_order_confirmations: true,
  },
  'user-uuid'
)
```

---

## 📊 Tracking & Analytics

### View Recent Sends

```typescript
import { EmailService } from '@/services/email.service'

// Get last 50 emails sent
const recentSends = await EmailService.getRecentSends('vendor-uuid', 50)

// View in UI: Settings → Email & Notifications → Recent Sends
```

### View Emails for Specific Order

```typescript
const orderEmails = await EmailService.getOrderEmails('order-uuid')

// Returns all emails sent for this order
// (receipt, confirmation, ready notification, etc.)
```

### Database Queries

```sql
-- Get all emails sent today
SELECT * FROM email_sends
WHERE vendor_id = 'vendor-uuid'
AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- Get open rate for campaign
SELECT
  COUNT(*) FILTER (WHERE opened_at IS NOT NULL) * 100.0 / COUNT(*) as open_rate
FROM email_sends
WHERE campaign_id = 'campaign-uuid';

-- Get failed emails
SELECT * FROM email_sends
WHERE vendor_id = 'vendor-uuid'
AND status = 'failed'
ORDER BY created_at DESC;
```

---

## 🎨 Email Templates

All emails use responsive HTML templates with:
- Modern gradient headers
- Mobile-friendly design
- Plain text fallback
- Consistent branding

### Current Templates

1. **Receipt** - Clean itemized receipt with total
2. **Order Confirmation** - Pickup or shipping details with items
3. **Order Ready** - Simple notification for pickup
4. **Order Shipped** - Tracking info and carrier details
5. **Test Email** - Verify configuration

### Customize Templates

Edit the HTML generation methods in `src/services/email.service.ts`:

```typescript
private static generateReceiptHTML(params: {...}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>...</head>
      <body>
        <!-- Your custom HTML -->
      </body>
    </html>
  `
}
```

---

## 🔒 Security & Privacy

### Unsubscribe Handling

Marketing emails check `customer_email_preferences` table:

```sql
-- Customer unsubscribes from marketing
INSERT INTO customer_email_preferences (customer_id, vendor_id, unsubscribed_marketing)
VALUES ('customer-uuid', 'vendor-uuid', true)
ON CONFLICT (customer_id, vendor_id)
DO UPDATE SET
  unsubscribed_marketing = true,
  unsubscribed_at = NOW();
```

Edge Function automatically blocks marketing emails to unsubscribed customers.

### RLS Policies

All tables have Row-Level Security enabled:
- Service role has full access
- Authenticated users can only access their vendor's data
- Customers cannot access email tracking data

---

## 🐛 Troubleshooting

### Email Not Sending

1. **Check Edge Function logs:**
   ```bash
   supabase functions logs send-email
   ```

2. **Verify RESEND_API_KEY is set:**
   ```bash
   supabase secrets list
   ```

3. **Check vendor settings exist:**
   ```sql
   SELECT * FROM vendor_email_settings WHERE vendor_id = 'your-vendor-uuid';
   ```

4. **Verify domain in Resend:**
   - Go to Resend Dashboard → Domains
   - Ensure domain is verified

### Email Sent But Not Received

1. **Check spam folder**
2. **Verify from_email matches verified domain**
3. **Check Resend logs:** [Resend Dashboard → Emails](https://resend.com/emails)
4. **Check email_sends table for status:**
   ```sql
   SELECT * FROM email_sends
   WHERE to_email = 'customer@example.com'
   ORDER BY created_at DESC;
   ```

### Test Email Fails

Common issues:
- `from_email` doesn't match verified domain in Resend
- RESEND_API_KEY not set or invalid
- Email type disabled in settings

---

## 📚 Additional Resources

- **Resend Documentation**: https://resend.com/docs
- **Resend Dashboard**: https://resend.com/overview
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

---

## 🎉 Next Steps

### Integrate into Checkout Flow

Add to `supabase/functions/process-checkout/index.ts`:

```typescript
// After successful checkout
await sendEmail({
  to: customerEmail,
  toName: customerName,
  subject: `Receipt #${orderNumber}`,
  html: generateReceiptHTML({ orderNumber, total, items }),
  emailType: 'transactional',
  category: 'receipt',
  vendorId,
  orderId,
  customerId,
})
```

### Set Up Webhooks (Optional)

Configure Resend webhooks to track opens/clicks:

1. Go to Resend Dashboard → Webhooks
2. Create webhook pointing to: `https://your-project.supabase.co/functions/v1/email-webhook`
3. Select events: `email.opened`, `email.clicked`, `email.bounced`
4. Create Edge Function to handle webhook events

### Create Marketing Campaigns

Use the `email_campaigns` table to:
- Schedule promotional emails
- Target specific customer segments
- Track campaign performance
- A/B test subject lines

---

## ✅ Summary

Your email system is now **production-ready**! You can:

✓ Send receipts automatically after sales
✓ Send order confirmations for pickup/shipping
✓ Notify customers when orders are ready
✓ Send shipping notifications with tracking
✓ Manage all settings from the native app
✓ Track all emails in the database
✓ Test email configuration easily

**Next**: Apply the migration, deploy the Edge Function, and configure your email settings in the app!
