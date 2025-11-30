-- ============================================
-- SEED DEFAULT EMAIL TEMPLATES
-- Beautiful Apple-style email templates
-- ============================================

-- Function to seed default templates for a vendor
CREATE OR REPLACE FUNCTION seed_vendor_email_templates(p_vendor_id UUID)
RETURNS void AS $$
BEGIN
  -- Receipt Template
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
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', ''Helvetica Neue'', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 60px 30px;">
          {{#if email_header_image}}
            <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
          {{else}}
            {{#if vendor_logo}}
              <img src="{{vendor_logo}}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
            {{/if}}
            <div style="font-size: 32px; color: #ffffff; font-weight: 600;">{{vendor_name}}</div>
          {{/if}}
        </td>
      </tr>
    </table>

    <!-- Receipt Content -->
    <div style="padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 40px;">
        <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">Receipt</h2>
        <p style="margin: 0; font-size: 15px; color: #86868b;">Order #{{order_number}}</p>
      </div>

      <!-- Items -->
      <div style="margin-bottom: 32px;">
        {{#each items}}
        <div style="display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #d2d2d7;">
          <div>
            <span style="color: #1d1d1f; font-size: 17px; font-weight: 500;">{{name}}</span><br>
            <span style="color: #86868b; font-size: 15px;">Qty: {{quantity}}</span>
          </div>
          <div style="color: #1d1d1f; font-size: 17px; font-weight: 500;">{{price}}</div>
        </div>
        {{/each}}
      </div>

      <!-- Totals -->
      <div style="background-color: #f5f5f7; border-radius: 12px; padding: 20px;">
        {{#if subtotal}}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #86868b; font-size: 15px;">Subtotal</span>
          <span style="color: #1d1d1f; font-size: 15px;">{{subtotal}}</span>
        </div>
        {{/if}}
        {{#if tax_amount}}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #86868b; font-size: 15px;">Tax</span>
          <span style="color: #1d1d1f; font-size: 15px;">{{tax_amount}}</span>
        </div>
        {{/if}}
        {{#if discount_amount}}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #86868b; font-size: 15px;">Discount</span>
          <span style="color: #10b981; font-size: 15px;">-{{discount_amount}}</span>
        </div>
        {{/if}}
        <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #d2d2d7;">
          <span style="font-size: 19px; font-weight: 600; color: #1d1d1f;">Total</span>
          <span style="font-size: 24px; font-weight: 600; color: #1d1d1f;">{{total}}</span>
        </div>
      </div>

      <!-- Thank You -->
      <div style="text-align: center; margin-top: 32px;">
        <p style="margin: 0; font-size: 17px; color: #86868b;">Thank you for your purchase</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
      <p style="margin: 0; font-size: 12px; color: #86868b;">{{vendor_name}} &copy; {{year}}</p>
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
  ON CONFLICT (vendor_id, slug) DO NOTHING;

  -- Order Confirmation Template
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Order Confirmation',
    'order_confirmation',
    'transactional',
    'order_confirmation',
    'Order Confirmation #{{order_number}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', ''Helvetica Neue'', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 60px 30px;">
          {{#if email_header_image}}
            <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
          {{else}}
            {{#if vendor_logo}}
              <img src="{{vendor_logo}}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
            {{/if}}
            <div style="font-size: 32px; color: #ffffff; font-weight: 600;">{{vendor_name}}</div>
          {{/if}}
        </td>
      </tr>
    </table>

    <!-- Success Icon & Title -->
    <div style="text-align: center; padding: 40px 20px;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px;">
        <tr>
          <td align="center" style="width: 72px; height: 72px; background-color: #10b981; border-radius: 50%; font-size: 36px; color: #ffffff; line-height: 72px;">&#10003;</td>
        </tr>
      </table>
      <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">Order Confirmed</h2>
      <p style="margin: 0; font-size: 15px; color: #86868b;">Order #{{order_number}}</p>
    </div>

    <!-- Delivery/Pickup Info -->
    {{#if is_pickup}}
    <div style="margin: 0 20px 24px; background: #f5f5f7; border-radius: 12px; padding: 20px;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">Pickup Location</p>
      <p style="margin: 0; font-size: 17px; font-weight: 600; color: #1d1d1f;">{{pickup_location}}</p>
      {{#if estimated_time}}
      <p style="margin: 8px 0 0 0; font-size: 15px; color: #86868b;">Ready in {{estimated_time}}</p>
      {{/if}}
    </div>
    {{else}}
    <div style="margin: 0 20px 24px; background: #f5f5f7; border-radius: 12px; padding: 20px;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">Shipping To</p>
      <p style="margin: 0; font-size: 17px; font-weight: 600; color: #1d1d1f;">{{customer_name}}</p>
      <p style="margin: 4px 0 0 0; font-size: 15px; color: #1d1d1f;">{{shipping_address}}</p>
    </div>
    {{/if}}

    <!-- Order Items -->
    <div style="padding: 0 20px 40px;">
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">Order Items</p>
      {{#each items}}
      <div style="display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #d2d2d7;">
        <div>
          <span style="color: #1d1d1f; font-size: 17px; font-weight: 500;">{{name}}</span><br>
          <span style="color: #86868b; font-size: 15px;">Qty: {{quantity}}</span>
        </div>
        <div style="color: #1d1d1f; font-size: 17px; font-weight: 500;">{{price}}</div>
      </div>
      {{/each}}

      <!-- Total -->
      <div style="background-color: #f5f5f7; border-radius: 12px; padding: 20px; margin-top: 24px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 19px; font-weight: 600; color: #1d1d1f;">Total</span>
          <span style="font-size: 24px; font-weight: 600; color: #1d1d1f;">{{total}}</span>
        </div>
      </div>
    </div>

    <!-- Thank You Message -->
    <div style="text-align: center; padding: 0 20px 40px;">
      <p style="margin: 0; font-size: 17px; color: #86868b;">Thank you for your order!</p>
      {{#unless is_pickup}}
      <p style="margin: 8px 0 0 0; font-size: 15px; color: #86868b;">We''ll send you a shipping confirmation when your order ships.</p>
      {{/unless}}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
      <p style="margin: 0; font-size: 12px; color: #86868b;">{{vendor_name}} &copy; {{year}}</p>
    </div>
  </div>
</body>
</html>',
    'Order Confirmed! #{{order_number}}

{{#if is_pickup}}
Pickup at: {{pickup_location}}
{{else}}
Shipping to: {{customer_name}}
{{shipping_address}}
{{/if}}

{{#each items}}
{{name}} x {{quantity}} - {{price}}
{{/each}}

Total: {{total}}

Thank you for your order!',
    '["order_number", "items", "total", "is_pickup", "pickup_location", "estimated_time", "customer_name", "shipping_address", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO NOTHING;

  -- Order Ready Template
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Order Ready',
    'order_ready',
    'transactional',
    'order_update',
    'Your order #{{order_number}} is ready!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Ready</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', ''Helvetica Neue'', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 60px 30px;">
          {{#if email_header_image}}
            <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
          {{else}}
            {{#if vendor_logo}}
              <img src="{{vendor_logo}}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
            {{/if}}
            <div style="font-size: 32px; color: #ffffff; font-weight: 600;">{{vendor_name}}</div>
          {{/if}}
        </td>
      </tr>
    </table>

    <!-- Ready Message -->
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 64px; margin-bottom: 16px;">&#127881;</div>
      <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">Your Order is Ready!</h2>
      <p style="margin: 0; font-size: 15px; color: #86868b;">Order #{{order_number}}</p>
    </div>

    <!-- Pickup Location -->
    <div style="margin: 0 20px 40px; background: rgba(16, 185, 129, 0.1); border-radius: 12px; padding: 24px; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Pickup Location</p>
      <p style="margin: 0; font-size: 20px; font-weight: 600; color: #1d1d1f;">{{pickup_location}}</p>
    </div>

    <div style="text-align: center; padding: 0 20px 40px;">
      <p style="margin: 0; font-size: 17px; color: #86868b;">We can''t wait to see you!</p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
      <p style="margin: 0; font-size: 12px; color: #86868b;">{{vendor_name}} &copy; {{year}}</p>
    </div>
  </div>
</body>
</html>',
    'Your order is ready! #{{order_number}}

Pickup Location: {{pickup_location}}

We can''t wait to see you!',
    '["order_number", "pickup_location", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO NOTHING;

  -- Order Shipped Template
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
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', ''Helvetica Neue'', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 60px 30px;">
          {{#if email_header_image}}
            <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
          {{else}}
            {{#if vendor_logo}}
              <img src="{{vendor_logo}}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
            {{/if}}
            <div style="font-size: 32px; color: #ffffff; font-weight: 600;">{{vendor_name}}</div>
          {{/if}}
        </td>
      </tr>
    </table>

    <!-- Shipped Message -->
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 64px; margin-bottom: 16px;">&#128230;</div>
      <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">Your Order Has Shipped!</h2>
      <p style="margin: 0; font-size: 15px; color: #86868b;">Order #{{order_number}}</p>
    </div>

    <!-- Tracking Info -->
    {{#if tracking_number}}
    <div style="margin: 0 20px 24px; background: #f5f5f7; border-radius: 12px; padding: 20px; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">Tracking Number</p>
      <p style="margin: 0; font-size: 20px; font-weight: 600; color: #1d1d1f;">{{tracking_number}}</p>
      {{#if carrier}}
      <p style="margin: 8px 0 0 0; font-size: 15px; color: #86868b;">via {{carrier}}</p>
      {{/if}}
    </div>
    {{/if}}

    <!-- Shipping Address -->
    <div style="margin: 0 20px 40px; background: #f5f5f7; border-radius: 12px; padding: 20px;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">Shipping To</p>
      <p style="margin: 0; font-size: 17px; font-weight: 600; color: #1d1d1f;">{{customer_name}}</p>
      <p style="margin: 4px 0 0 0; font-size: 15px; color: #1d1d1f;">{{shipping_address}}</p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
      <p style="margin: 0; font-size: 12px; color: #86868b;">{{vendor_name}} &copy; {{year}}</p>
    </div>
  </div>
</body>
</html>',
    'Your order has shipped! #{{order_number}}

{{#if tracking_number}}
Tracking: {{tracking_number}}
{{#if carrier}}via {{carrier}}{{/if}}
{{/if}}

Shipping to:
{{customer_name}}
{{shipping_address}}',
    '["order_number", "tracking_number", "carrier", "customer_name", "shipping_address", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO NOTHING;

  -- Welcome Email Template
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
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', ''Helvetica Neue'', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 60px 30px;">
          {{#if email_header_image}}
            <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
          {{else}}
            {{#if vendor_logo}}
              <img src="{{vendor_logo}}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
            {{/if}}
            <div style="font-size: 32px; color: #ffffff; font-weight: 600;">{{vendor_name}}</div>
          {{/if}}
        </td>
      </tr>
    </table>

    <!-- Welcome Message -->
    <div style="text-align: center; padding: 40px 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">Welcome to {{vendor_name}}!</h2>
      <p style="margin: 0 0 24px 0; font-size: 17px; color: #86868b; max-width: 400px; margin-left: auto; margin-right: auto;">
        Thanks for joining our loyalty program. You''ll earn points on every purchase and get access to exclusive rewards.
      </p>
      <a href="{{shop_url}}" style="display: inline-block; background: #000000; color: white; padding: 14px 28px; border-radius: 8px; font-size: 17px; font-weight: 600; text-decoration: none;">
        Start Shopping
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
      <p style="margin: 0; font-size: 12px; color: #86868b;">{{vendor_name}} &copy; {{year}}</p>
    </div>
  </div>
</body>
</html>',
    'Welcome to {{vendor_name}}!

Thanks for joining our loyalty program. You''ll earn points on every purchase and get access to exclusive rewards.

Start shopping: {{shop_url}}',
    '["customer_name", "vendor_name", "vendor_logo", "email_header_image", "shop_url", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO NOTHING;

  -- Loyalty Update Template
  INSERT INTO email_templates (vendor_id, name, slug, type, category, subject, html_content, text_content, variables, is_active, is_default)
  VALUES (
    p_vendor_id,
    'Loyalty Update',
    'loyalty_update',
    'transactional',
    'loyalty',
    'You earned {{points_earned}} points!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loyalty Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', ''Helvetica Neue'', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 60px 30px;">
          {{#if email_header_image}}
            <img src="{{email_header_image}}" alt="{{vendor_name}}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
          {{else}}
            {{#if vendor_logo}}
              <img src="{{vendor_logo}}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto; border-radius: 12px;" />
            {{/if}}
            <div style="font-size: 32px; color: #ffffff; font-weight: 600;">{{vendor_name}}</div>
          {{/if}}
        </td>
      </tr>
    </table>

    <!-- Points Message -->
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 48px; margin-bottom: 16px;">&#127881;</div>
      <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #1d1d1f;">You earned {{points_earned}} points!</h2>
      <p style="margin: 0 0 24px 0; font-size: 17px; color: #86868b;">From your recent purchase</p>

      <div style="background: #f5f5f7; border-radius: 12px; padding: 24px; margin: 0 auto; max-width: 300px;">
        <p style="margin: 0 0 8px 0; font-size: 15px; color: #86868b;">Current Balance</p>
        <p style="margin: 0; font-size: 36px; font-weight: 700; color: #1d1d1f;">{{points_balance}} pts</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
      <p style="margin: 0; font-size: 12px; color: #86868b;">{{vendor_name}} &copy; {{year}}</p>
    </div>
  </div>
</body>
</html>',
    'You earned {{points_earned}} points!

From your recent purchase.

Current Balance: {{points_balance}} pts',
    '["points_earned", "points_balance", "vendor_name", "vendor_logo", "email_header_image", "year"]',
    true,
    true
  )
  ON CONFLICT (vendor_id, slug) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-seed templates when a vendor is created or when email settings are created
CREATE OR REPLACE FUNCTION auto_seed_email_templates()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_vendor_email_templates(NEW.vendor_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_seed_email_templates_trigger ON vendor_email_settings;
CREATE TRIGGER auto_seed_email_templates_trigger
  AFTER INSERT ON vendor_email_settings
  FOR EACH ROW
  EXECUTE FUNCTION auto_seed_email_templates();

-- Seed templates for existing vendors with email settings
DO $$
DECLARE
  v_record RECORD;
BEGIN
  FOR v_record IN SELECT vendor_id FROM vendor_email_settings LOOP
    PERFORM seed_vendor_email_templates(v_record.vendor_id);
  END LOOP;
END $$;

-- Add RLS policies for template management
DROP POLICY IF EXISTS users_insert_own_email_templates ON email_templates;
CREATE POLICY users_insert_own_email_templates ON email_templates
  FOR INSERT
  WITH CHECK (
    vendor_id = (SELECT vendor_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS users_update_own_email_templates ON email_templates;
CREATE POLICY users_update_own_email_templates ON email_templates
  FOR UPDATE
  USING (
    vendor_id = (SELECT vendor_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS users_delete_own_email_templates ON email_templates;
CREATE POLICY users_delete_own_email_templates ON email_templates
  FOR DELETE
  USING (
    vendor_id = (SELECT vendor_id FROM users WHERE id = auth.uid())
  );

-- Grant full access to authenticated users for their templates
GRANT INSERT, UPDATE, DELETE ON email_templates TO authenticated;

COMMENT ON FUNCTION seed_vendor_email_templates IS 'Seeds default email templates for a vendor';
