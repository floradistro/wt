-- ============================================
-- STANDARDIZED DARK EMAIL TEMPLATES
-- Single source of truth for all emails
-- Black background, white text, minimal design
-- ============================================

-- Function to create/update standardized dark templates for a vendor
CREATE OR REPLACE FUNCTION seed_vendor_email_templates(p_vendor_id UUID)
RETURNS void AS $$
BEGIN
  -- ==========================================
  -- RECEIPT TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Receipt',
    'receipt',
    'transactional',
    'receipt',
    'Receipt #{{order_number}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Title -->
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Receipt
        </h1>
        <p style="margin: 16px 0 0 0; font-size: 15px; color: #71717a; letter-spacing: 0.05em; text-transform: uppercase;">
          Order #{{order_number}}
        </p>
      </div>

      <!-- Items -->
      <div style="margin-bottom: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Items
        </p>
        <table style="width: 100%; border-collapse: collapse;">
          {{#each items}}
          <tr>
            <td style="padding: 16px 0; border-bottom: 1px solid #27272a;">
              <div style="font-size: 15px; color: #ffffff; font-weight: 500;">{{name}}</div>
              <div style="font-size: 13px; color: #71717a; margin-top: 4px;">Qty: {{quantity}}</div>
            </td>
            <td style="padding: 16px 0; border-bottom: 1px solid #27272a; text-align: right; vertical-align: top;">
              <div style="font-size: 15px; color: #ffffff;">{{price}}</div>
            </td>
          </tr>
          {{/each}}
        </table>
      </div>

      <!-- Totals -->
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px;">
        <table style="width: 100%;">
          {{#if subtotal}}
          <tr>
            <td style="font-size: 14px; color: #71717a; padding: 4px 0;">Subtotal</td>
            <td style="text-align: right; font-size: 14px; color: #a1a1aa;">{{subtotal}}</td>
          </tr>
          {{/if}}
          {{#if tax_amount}}
          <tr>
            <td style="font-size: 14px; color: #71717a; padding: 4px 0;">Tax</td>
            <td style="text-align: right; font-size: 14px; color: #a1a1aa;">{{tax_amount}}</td>
          </tr>
          {{/if}}
          {{#if discount_amount}}
          <tr>
            <td style="font-size: 14px; color: #71717a; padding: 4px 0;">Discount</td>
            <td style="text-align: right; font-size: 14px; color: #10b981;">-{{discount_amount}}</td>
          </tr>
          {{/if}}
          <tr>
            <td colspan="2" style="padding: 12px 0 0 0;">
              <div style="border-top: 1px solid #27272a;"></div>
            </td>
          </tr>
          <tr>
            <td style="font-size: 17px; font-weight: 500; color: #ffffff; padding: 12px 0 0 0;">Total</td>
            <td style="text-align: right; font-size: 21px; font-weight: 500; color: #ffffff; padding: 12px 0 0 0;">{{total}}</td>
          </tr>
        </table>
      </div>

      <!-- Thank You -->
      <div style="text-align: center; margin-top: 32px;">
        <p style="margin: 0; font-size: 17px; color: #71717a;">Thank you for your purchase</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Receipt #{{order_number}}

{{#each items}}
{{name}} x {{quantity}} - {{price}}
{{/each}}

Total: {{total}}

Thank you for your purchase!',
    '["order_number", "items", "subtotal", "tax_amount", "discount_amount", "total", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- ORDER CONFIRMATION TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Order Confirmation',
    'order_confirmation',
    'transactional',
    'order_confirmation',
    'Order Confirmed #{{order_number}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Success Icon & Title -->
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #10b981; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: #10b981; font-size: 36px;">&#10003;</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Order Confirmed
        </h1>
        <p style="margin: 16px 0 0 0; font-size: 15px; color: #71717a; letter-spacing: 0.05em; text-transform: uppercase;">
          Order #{{order_number}}
        </p>
      </div>

      <!-- Thank You Message -->
      <div style="text-align: center; margin-bottom: 40px;">
        <p style="margin: 0; font-size: 17px; color: #a1a1aa; line-height: 1.7;">
          Thank you for your order, {{customer_name}}.<br>
          {{#if is_pickup}}We''ll notify you when it''s ready for pickup.{{else}}We''ll notify you when it ships.{{/if}}
        </p>
      </div>

      <!-- Delivery/Pickup Info -->
      {{#if is_pickup}}
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Pickup Location
        </p>
        <p style="margin: 0; font-size: 17px; color: #ffffff; font-weight: 500;">{{pickup_location}}</p>
        {{#if estimated_time}}
        <p style="margin: 8px 0 0 0; font-size: 15px; color: #71717a;">Ready in {{estimated_time}}</p>
        {{/if}}
      </div>
      {{else}}
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Shipping To
        </p>
        <p style="margin: 0; font-size: 15px; color: #a1a1aa; line-height: 1.8;">
          {{shipping_name}}<br>
          {{shipping_address}}
        </p>
      </div>
      {{/if}}

      <!-- Order Items -->
      <div style="margin-bottom: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Items
        </p>
        <table style="width: 100%; border-collapse: collapse;">
          {{#each items}}
          <tr>
            <td style="padding: 16px 0; border-bottom: 1px solid #27272a;">
              <div style="font-size: 15px; color: #ffffff; font-weight: 500;">{{name}}</div>
              <div style="font-size: 13px; color: #71717a; margin-top: 4px;">Qty: {{quantity}}</div>
            </td>
            <td style="padding: 16px 0; border-bottom: 1px solid #27272a; text-align: right; vertical-align: top;">
              <div style="font-size: 15px; color: #ffffff;">{{price}}</div>
            </td>
          </tr>
          {{/each}}
        </table>
      </div>

      <!-- Order Summary -->
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
        <table style="width: 100%;">
          {{#if subtotal}}
          <tr>
            <td style="font-size: 14px; color: #71717a; padding: 4px 0;">Subtotal</td>
            <td style="text-align: right; font-size: 14px; color: #a1a1aa;">{{subtotal}}</td>
          </tr>
          {{/if}}
          {{#if shipping_cost}}
          <tr>
            <td style="font-size: 14px; color: #71717a; padding: 4px 0;">Shipping</td>
            <td style="text-align: right; font-size: 14px; color: #a1a1aa;">{{shipping_cost}}</td>
          </tr>
          {{/if}}
          {{#if tax_amount}}
          <tr>
            <td style="font-size: 14px; color: #71717a; padding: 4px 0;">Tax</td>
            <td style="text-align: right; font-size: 14px; color: #a1a1aa;">{{tax_amount}}</td>
          </tr>
          {{/if}}
          <tr>
            <td colspan="2" style="padding: 12px 0 0 0;">
              <div style="border-top: 1px solid #27272a;"></div>
            </td>
          </tr>
          <tr>
            <td style="font-size: 17px; font-weight: 500; color: #ffffff; padding: 12px 0 0 0;">Total</td>
            <td style="text-align: right; font-size: 21px; font-weight: 500; color: #ffffff; padding: 12px 0 0 0;">{{total}}</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align: center;">
        <a href="{{shop_url}}" style="display: inline-block; background-color: #ffffff; color: #000000; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; text-decoration: none;">
          Continue Shopping
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Order Confirmed! #{{order_number}}

Thank you for your order, {{customer_name}}.

{{#if is_pickup}}
Pickup at: {{pickup_location}}
{{else}}
Shipping to: {{shipping_name}}
{{shipping_address}}
{{/if}}

{{#each items}}
{{name}} x {{quantity}} - {{price}}
{{/each}}

Total: {{total}}',
    '["order_number", "customer_name", "items", "subtotal", "shipping_cost", "tax_amount", "total", "is_pickup", "pickup_location", "estimated_time", "shipping_name", "shipping_address", "shop_url", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- ORDER READY TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Order Ready',
    'order_ready',
    'transactional',
    'order_update',
    'Your order #{{order_number}} is ready for pickup!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Success Icon & Title -->
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #10b981; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: #10b981; font-size: 36px;">&#10003;</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Your Order is Ready!
        </h1>
        <p style="margin: 16px 0 0 0; font-size: 15px; color: #71717a; letter-spacing: 0.05em; text-transform: uppercase;">
          Order #{{order_number}}
        </p>
      </div>

      <!-- Pickup Location -->
      <div style="background-color: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 24px; margin-bottom: 32px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; color: #10b981; letter-spacing: 0.15em; text-transform: uppercase;">
          Pickup Location
        </p>
        <p style="margin: 0; font-size: 20px; font-weight: 500; color: #ffffff;">{{pickup_location}}</p>
        {{#if pickup_address}}
        <p style="margin: 8px 0 0 0; font-size: 15px; color: #a1a1aa;">{{pickup_address}}</p>
        {{/if}}
      </div>

      <!-- Message -->
      <div style="text-align: center;">
        <p style="margin: 0; font-size: 17px; color: #a1a1aa; line-height: 1.7;">
          We can''t wait to see you!
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Your order #{{order_number}} is ready for pickup!

Pickup Location: {{pickup_location}}
{{#if pickup_address}}{{pickup_address}}{{/if}}

We can''t wait to see you!',
    '["order_number", "pickup_location", "pickup_address", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- ORDER SHIPPED TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Order Shipped',
    'order_shipped',
    'transactional',
    'order_update',
    'Your order #{{order_number}} has shipped!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Shipped</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Icon & Title -->
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #8b5cf6; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: #8b5cf6; font-size: 32px;">&#128230;</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Your Order Has Shipped!
        </h1>
        <p style="margin: 16px 0 0 0; font-size: 15px; color: #71717a; letter-spacing: 0.05em; text-transform: uppercase;">
          Order #{{order_number}}
        </p>
      </div>

      <!-- Tracking Info -->
      {{#if tracking_number}}
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Tracking Number
        </p>
        <p style="margin: 0; font-size: 20px; font-weight: 500; color: #ffffff;">{{tracking_number}}</p>
        {{#if carrier}}
        <p style="margin: 8px 0 0 0; font-size: 15px; color: #71717a;">via {{carrier}}</p>
        {{/if}}
      </div>
      {{#if tracking_url}}
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="{{tracking_url}}" style="display: inline-block; background-color: #ffffff; color: #000000; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; text-decoration: none;">
          Track Package
        </a>
      </div>
      {{/if}}
      {{/if}}

      <!-- Shipping Address -->
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Shipping To
        </p>
        <p style="margin: 0; font-size: 15px; color: #a1a1aa; line-height: 1.8;">
          {{customer_name}}<br>
          {{shipping_address}}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Your order #{{order_number}} has shipped!

{{#if tracking_number}}
Tracking: {{tracking_number}}
{{#if carrier}}via {{carrier}}{{/if}}
{{#if tracking_url}}Track: {{tracking_url}}{{/if}}
{{/if}}

Shipping to:
{{customer_name}}
{{shipping_address}}',
    '["order_number", "tracking_number", "tracking_url", "carrier", "customer_name", "shipping_address", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- WELCOME EMAIL TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Welcome',
    'welcome',
    'transactional',
    'welcome',
    'Welcome to {{vendor_name}}!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Icon & Title -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #ffffff; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: #ffffff; font-size: 32px;">&#128075;</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Welcome to {{vendor_name}}
        </h1>
      </div>

      <!-- Message -->
      <div style="text-align: center; margin-bottom: 32px;">
        <p style="margin: 0 0 24px 0; font-size: 17px; color: #a1a1aa; line-height: 1.7;">
          Hi {{customer_name}},<br><br>
          Thanks for creating an account with us. We''re excited to have you as part of our community.
        </p>
      </div>

      <!-- Features -->
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          What You Can Do
        </p>
        <ul style="margin: 0; padding: 0 0 0 20px; color: #a1a1aa; font-size: 15px; line-height: 2;">
          <li>Browse our premium selection of products</li>
          <li>Track your orders in real-time</li>
          <li>Earn loyalty points on every purchase</li>
          <li>Get exclusive member-only deals</li>
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align: center;">
        <a href="{{shop_url}}" style="display: inline-block; background-color: #ffffff; color: #000000; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; text-decoration: none;">
          Start Shopping
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Welcome to {{vendor_name}}!

Hi {{customer_name}},

Thanks for creating an account with us. We''re excited to have you as part of our community.

What You Can Do:
- Browse our premium selection of products
- Track your orders in real-time
- Earn loyalty points on every purchase
- Get exclusive member-only deals

Start shopping: {{shop_url}}',
    '["customer_name", "shop_url", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- PASSWORD RESET TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Password Reset',
    'password_reset',
    'transactional',
    'password_reset',
    'Reset Your Password',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Icon & Title -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #f59e0b; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: #f59e0b; font-size: 32px;">&#128274;</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Reset Your Password
        </h1>
      </div>

      <!-- Message -->
      <div style="text-align: center; margin-bottom: 32px;">
        <p style="margin: 0 0 24px 0; font-size: 17px; color: #a1a1aa; line-height: 1.7;">
          Hi {{customer_name}},<br><br>
          We received a request to reset your password. Click the button below to create a new one.
        </p>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="{{reset_url}}" style="display: inline-block; background-color: #ffffff; color: #000000; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; text-decoration: none;">
          Reset Password
        </a>
      </div>

      <!-- Warning -->
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
        <p style="margin: 0; font-size: 13px; color: #71717a; line-height: 1.6;">
          If you didn''t request this, you can safely ignore this email. The link will expire in 24 hours.
        </p>
      </div>

      <!-- Fallback Link -->
      <div style="text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #52525b;">
          Button not working? Copy and paste this link:<br>
          <span style="color: #71717a; word-break: break-all;">{{reset_url}}</span>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Reset Your Password

Hi {{customer_name}},

We received a request to reset your password. Click the link below to create a new one:

{{reset_url}}

If you didn''t request this, you can safely ignore this email. The link will expire in 24 hours.',
    '["customer_name", "reset_url", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- LOYALTY UPDATE TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Loyalty Update',
    'loyalty_update',
    'transactional',
    'loyalty',
    'You {{action}} {{points}} points!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loyalty Points Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Icon & Title -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #10b981; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: #10b981; font-size: 32px;">&#11088;</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Points {{action}}!
        </h1>
      </div>

      <!-- Message -->
      <div style="text-align: center; margin-bottom: 32px;">
        <p style="margin: 0; font-size: 17px; color: #a1a1aa; line-height: 1.7;">
          Hi {{customer_name}}, you {{action}} <span style="color: #10b981; font-weight: 600;">{{points}} points</span>{{#if order_number}} on order #{{order_number}}{{/if}}.
        </p>
      </div>

      <!-- Points Balance -->
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 32px; margin-bottom: 32px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Your Balance
        </p>
        <p style="margin: 0; font-size: 48px; font-weight: 300; color: #10b981;">
          {{total_points}}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #71717a;">
          points
        </p>
      </div>

      <!-- CTA -->
      <div style="text-align: center;">
        <a href="{{rewards_url}}" style="display: inline-block; background-color: #ffffff; color: #000000; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; text-decoration: none;">
          View Rewards
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Points {{action}}!

Hi {{customer_name}}, you {{action}} {{points}} points{{#if order_number}} on order #{{order_number}}{{/if}}.

Your Balance: {{total_points}} points

View your rewards: {{rewards_url}}',
    '["customer_name", "action", "points", "total_points", "order_number", "rewards_url", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- BACK IN STOCK TEMPLATE
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Back in Stock',
    'back_in_stock',
    'transactional',
    'back_in_stock',
    '{{product_name}} is Back in Stock!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Back in Stock</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Icon & Title -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #8b5cf6; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: #8b5cf6; font-size: 32px;">&#128276;</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          Back in Stock!
        </h1>
      </div>

      <!-- Message -->
      <div style="text-align: center; margin-bottom: 32px;">
        <p style="margin: 0; font-size: 17px; color: #a1a1aa; line-height: 1.7;">
          Hi {{customer_name}}, great news! The product you wanted is back in stock.
        </p>
      </div>

      <!-- Product -->
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 32px;">
        {{#if product_image}}
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="{{product_image}}" alt="{{product_name}}" style="max-width: 200px; height: auto; border-radius: 8px;">
        </div>
        {{/if}}
        <p style="margin: 0; font-size: 19px; color: #ffffff; text-align: center; font-weight: 500;">
          {{product_name}}
        </p>
      </div>

      <!-- CTA -->
      <div style="text-align: center;">
        <a href="{{product_url}}" style="display: inline-block; background-color: #ffffff; color: #000000; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; text-decoration: none;">
          Shop Now
        </a>
      </div>

      <!-- Urgency -->
      <div style="text-align: center; margin-top: 24px;">
        <p style="margin: 0; font-size: 13px; color: #52525b;">
          Hurry - popular items sell out fast!
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    '{{product_name}} is Back in Stock!

Hi {{customer_name}}, great news! The product you wanted is back in stock.

{{product_name}}

Shop now: {{product_url}}

Hurry - popular items sell out fast!',
    '["customer_name", "product_name", "product_url", "product_image", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

  -- ==========================================
  -- ORDER STATUS UPDATE (GENERIC)
  -- ==========================================
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Order Status Update',
    'order_status_update',
    'transactional',
    'order_update',
    'Order #{{order_number}} - {{status_title}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''SF Pro Display'', ''Helvetica Neue'', Helvetica, Arial, sans-serif; background-color: #000000;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000;">

    <!-- Header -->
    <div style="padding: 48px 40px; text-align: center; border-bottom: 1px solid #27272a;">
      {{#if email_header_image}}
        <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; height: auto;" />
      {{else}}
        {{#if vendor_logo}}
          <img src="{{vendor_logo}}" alt="{{vendor_name}}" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
        {{/if}}
        <div style="font-size: 24px; color: #ffffff; font-weight: 300; letter-spacing: 0.05em;">{{vendor_name}}</div>
      {{/if}}
    </div>

    <!-- Content -->
    <div style="padding: 48px 40px;">

      <!-- Icon & Title -->
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid {{status_color}}; margin: 0 auto 24px auto; line-height: 76px; text-align: center;">
          <span style="color: {{status_color}}; font-size: 32px;">{{status_icon}}</span>
        </div>
        <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.02em;">
          {{status_title}}
        </h1>
        <p style="margin: 16px 0 0 0; font-size: 15px; color: #71717a; letter-spacing: 0.05em; text-transform: uppercase;">
          Order #{{order_number}}
        </p>
      </div>

      <!-- Message -->
      <div style="text-align: center; margin-bottom: 32px;">
        <p style="margin: 0; font-size: 17px; color: #a1a1aa; line-height: 1.7;">
          {{status_message}}
        </p>
      </div>

      <!-- Tracking (if shipped) -->
      {{#if tracking_number}}
      <div style="background-color: #0a0a0a; border: 1px solid #27272a; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 500; color: #71717a; letter-spacing: 0.15em; text-transform: uppercase;">
          Tracking Number
        </p>
        <p style="margin: 0; font-size: 20px; font-weight: 500; color: #ffffff;">{{tracking_number}}</p>
        {{#if carrier}}
        <p style="margin: 8px 0 0 0; font-size: 15px; color: #71717a;">via {{carrier}}</p>
        {{/if}}
      </div>
      {{#if tracking_url}}
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="{{tracking_url}}" style="display: inline-block; background-color: #ffffff; color: #000000; font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; padding: 14px 32px; text-decoration: none;">
          Track Package
        </a>
      </div>
      {{/if}}
      {{/if}}

      <!-- Location (if pickup) -->
      {{#if pickup_location}}
      <div style="background-color: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 600; color: #10b981; letter-spacing: 0.15em; text-transform: uppercase;">
          Pickup Location
        </p>
        <p style="margin: 0; font-size: 20px; font-weight: 500; color: #ffffff;">{{pickup_location}}</p>
      </div>
      {{/if}}

      <!-- Contact -->
      <div style="text-align: center; margin-top: 32px;">
        <p style="margin: 0; font-size: 13px; color: #52525b;">
          Questions? Contact us at {{support_email}}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 40px; border-top: 1px solid #27272a;">
      <p style="margin: 0; font-size: 11px; color: #52525b; letter-spacing: 0.1em; text-transform: uppercase;">
        {{vendor_name}} &copy; {{year}}
      </p>
    </div>
  </div>
</body>
</html>',
    'Order #{{order_number}} - {{status_title}}

{{status_message}}

{{#if tracking_number}}
Tracking: {{tracking_number}}
{{#if tracking_url}}Track: {{tracking_url}}{{/if}}
{{/if}}

{{#if pickup_location}}
Pickup at: {{pickup_location}}
{{/if}}

Questions? Contact us at {{support_email}}',
    '["order_number", "status_title", "status_message", "status_color", "status_icon", "tracking_number", "tracking_url", "carrier", "pickup_location", "support_email", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO UPDATE SET
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    updated_at = NOW();

END;
$$ LANGUAGE plpgsql;

-- Re-seed templates for all existing vendors
DO $$
DECLARE
  v_record RECORD;
BEGIN
  FOR v_record IN SELECT vendor_id FROM vendor_email_settings LOOP
    PERFORM seed_vendor_email_templates(v_record.vendor_id);
  END LOOP;
END $$;

COMMENT ON FUNCTION seed_vendor_email_templates IS 'Seeds standardized dark email templates for a vendor - single source of truth';
