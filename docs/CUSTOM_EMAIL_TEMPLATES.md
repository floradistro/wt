# Custom Email Templates - Future Implementation

## Overview
Allow vendors to create custom email templates from the app UI, with variable injection and custom triggers.

## Current Architecture
- **React Email components** in `supabase/functions/send-email/_templates/`
- **Resend** for delivery
- **Edge function** renders templates and sends via Resend
- **Preview system** renders HTML and displays in WebView

## Proposed Addition

### Database Schema
```sql
create table custom_email_templates (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) not null,
  name text not null,
  slug text not null,
  subject text not null,
  html_content text not null,
  variables jsonb default '[]', -- ["customer_name", "order_total", "custom_field"]
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(vendor_id, slug)
);

-- Optional: triggers for automated sends
create table email_triggers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references vendors(id) not null,
  template_id uuid references custom_email_templates(id) not null,
  trigger_type text not null, -- 'manual', 'on_order_status', 'on_signup', 'scheduled'
  trigger_config jsonb, -- e.g., {"status": "delivered"} or {"cron": "0 9 * * 1"}
  is_active boolean default true
);
```

### Edge Function Update
In `supabase/functions/send-email/index.ts`, before the switch statement:

```typescript
// Check for custom template first
const { data: customTemplate } = await supabase
  .from('custom_email_templates')
  .select('*')
  .eq('vendor_id', vendorId)
  .eq('slug', templateSlug)
  .eq('is_active', true)
  .single()

if (customTemplate) {
  let html = customTemplate.html_content
  let subject = customTemplate.subject

  // Replace {{variable}} placeholders with actual data
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    html = html.replace(regex, String(value ?? ''))
    subject = subject.replace(regex, String(value ?? ''))
  }

  return { html, subject }
}

// Fall through to built-in React Email templates...
```

### Available Variables
Standard variables to document for users:
- `{{customer_name}}` - Customer's full name
- `{{customer_first_name}}` - First name only
- `{{customer_email}}` - Email address
- `{{order_number}}` - Order ID
- `{{order_total}}` - Formatted total
- `{{order_items}}` - HTML list of items
- `{{tracking_number}}` - Shipping tracking
- `{{tracking_url}}` - Tracking link
- `{{shop_url}}` - Store URL
- `{{vendor_name}}` - Store name
- `{{loyalty_points}}` - Current points balance

### UI Components Needed

1. **CustomEmailTemplatesList** - List of vendor's custom templates
2. **CustomEmailTemplateEditor** - Create/edit template
   - Name & slug input
   - Subject line input
   - HTML editor (textarea v1, rich text v2)
   - Variable picker/inserter
   - Preview button (reuse existing preview modal)
   - Test send button
3. **TriggerConfiguration** - When to auto-send (optional v2)

### V1 Scope (1-2 days)
- [ ] Database table
- [ ] Edge function custom template lookup
- [ ] Simple HTML textarea editor
- [ ] Variable documentation/picker
- [ ] Preview integration
- [ ] Test send

### V2 Scope (future)
- [ ] Rich text / block editor (react-email-editor or similar)
- [ ] Automated triggers
- [ ] Template duplication
- [ ] Version history
- [ ] A/B testing
- [ ] Analytics (open rates, clicks)

## Integration Points
- Settings > Email Settings > Custom Templates (new section)
- Reuse `EmailTemplatePreviewModal` for previews
- Reuse `sendTestEmail` pattern for test sends
