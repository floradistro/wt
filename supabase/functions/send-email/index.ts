/**
 * Send Email Edge Function
 * Using React Email for templates + Resend for delivery
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Resend } from 'npm:resend@4.0.0'

// Import templates
import { Receipt } from './_templates/receipt.tsx'
import { OrderConfirmation } from './_templates/order-confirmation.tsx'
import { OrderReady } from './_templates/order-ready.tsx'
import { OrderShipped } from './_templates/order-shipped.tsx'
import { Welcome } from './_templates/welcome.tsx'
import { PasswordReset } from './_templates/password-reset.tsx'
import { LoyaltyUpdate } from './_templates/loyalty-update.tsx'
import { BackInStock } from './_templates/back-in-stock.tsx'
import { OrderStatusUpdate } from './_templates/order-status-update.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Check if email is a placeholder/fake email that should NOT receive emails
 * This prevents accidentally sending to walk-in, phone-only, or test customers
 */
function isPlaceholderEmail(email: string): boolean {
  if (!email) return true

  const emailLower = email.toLowerCase().trim()

  // Check for placeholder domain patterns
  const placeholderDomains = [
    '@walk-in.local',
    '@walkin.local',
    '@phone.local',
    '@alpine.local',
    '@pos.local',
    '@deleted.local',
    '@example.com',
    '@example.org',
    '@example.net',
    '@test.com',
    '@test.local',
  ]

  for (const domain of placeholderDomains) {
    if (emailLower.endsWith(domain)) {
      return true
    }
  }

  // Check for placeholder patterns in local part
  const placeholderPatterns = [
    /^walkin-/i,
    /^deleted\./i,
    /^merged\./i,
    /^test-/i,
    /^fake@/i,
    /^noemail/i,
    /^none@/i,
    /^na@/i,
    /^unknown@/i,
    /^placeholder/i,
    /^customer@/i,
    /^guest@/i,
    /^anonymous/i,
    /alpineiq/i,
  ]

  for (const pattern of placeholderPatterns) {
    if (pattern.test(emailLower)) {
      return true
    }
  }

  return false
}

interface SendEmailRequest {
  to: string
  toName?: string
  subject?: string
  html?: string // Legacy support
  text?: string
  templateSlug?: string
  data?: Record<string, any>
  emailType?: 'transactional' | 'marketing'
  category?: string
  vendorId: string
  customerId?: string
  orderId?: string
  campaignId?: string
  templateId?: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
  metadata?: Record<string, any>
}

interface EmailSendRecord {
  vendor_id: string
  customer_id?: string
  order_id?: string
  campaign_id?: string
  template_id?: string
  email_type: string
  to_email: string
  to_name?: string
  from_email: string
  from_name: string
  reply_to?: string
  subject: string
  resend_email_id?: string
  status: string
  error_message?: string
  sent_at?: string
  metadata?: Record<string, any>
}

/**
 * Render a React Email template to HTML
 */
async function renderTemplate(
  templateSlug: string,
  data: Record<string, any>,
  vendorName: string,
  logoUrl?: string,
  supportEmail?: string
): Promise<{ html: string; subject: string }> {
  const baseProps = { vendorName, logoUrl, supportEmail }

  let element: React.ReactElement
  let subject: string

  switch (templateSlug) {
    case 'receipt':
      element = React.createElement(Receipt, {
        ...baseProps,
        orderNumber: data.order_number || '',
        items: data.items || [],
        subtotal: data.subtotal,
        tax: data.tax_amount,
        shipping: data.shipping_cost,
        discount: data.discount_amount,
        total: data.total || '$0.00',
      })
      subject = `Receipt #${data.order_number}`
      break

    case 'order_confirmation':
      element = React.createElement(OrderConfirmation, {
        ...baseProps,
        customerName: data.customer_name || 'Customer',
        orderNumber: data.order_number || '',
        items: data.items || [],
        subtotal: data.subtotal,
        tax: data.tax_amount,
        shipping: data.shipping_cost,
        discount: data.discount_amount,
        total: data.total || '$0.00',
        isPickup: data.is_pickup || false,
        pickupLocation: data.pickup_location,
        estimatedTime: data.estimated_time,
        shippingName: data.shipping_name,
        shippingAddress: data.shipping_address,
        shopUrl: data.shop_url || '#',
      })
      subject = `Order Confirmed #${data.order_number}`
      break

    case 'order_ready':
      element = React.createElement(OrderReady, {
        ...baseProps,
        orderNumber: data.order_number || '',
        pickupLocation: data.pickup_location || '',
        pickupAddress: data.pickup_address,
      })
      subject = `Your order #${data.order_number} is ready for pickup`
      break

    case 'order_shipped':
      element = React.createElement(OrderShipped, {
        ...baseProps,
        orderNumber: data.order_number || '',
        customerName: data.customer_name || '',
        shippingAddress: data.shipping_address || '',
        trackingNumber: data.tracking_number,
        trackingUrl: data.tracking_url,
        carrier: data.carrier,
      })
      subject = `Your order #${data.order_number} has shipped`
      break

    case 'welcome':
      element = React.createElement(Welcome, {
        ...baseProps,
        customerName: data.customer_name || 'there',
        shopUrl: data.shop_url || '#',
      })
      subject = `Welcome to ${vendorName}`
      break

    case 'password_reset':
      element = React.createElement(PasswordReset, {
        ...baseProps,
        customerName: data.customer_name || 'there',
        resetUrl: data.reset_url || '#',
      })
      subject = 'Reset Your Password'
      break

    case 'loyalty_update':
      element = React.createElement(LoyaltyUpdate, {
        ...baseProps,
        customerName: data.customer_name || '',
        action: data.action || 'earned',
        points: data.points || 0,
        totalPoints: data.total_points || 0,
        orderNumber: data.order_number,
        rewardsUrl: data.rewards_url || '#',
      })
      subject = `You ${data.action || 'earned'} ${data.points || 0} points`
      break

    case 'back_in_stock':
      element = React.createElement(BackInStock, {
        ...baseProps,
        customerName: data.customer_name || '',
        productName: data.product_name || '',
        productUrl: data.product_url || '#',
        productImage: data.product_image,
      })
      subject = `${data.product_name} is Back in Stock`
      break

    case 'order_status_update':
      element = React.createElement(OrderStatusUpdate, {
        ...baseProps,
        orderNumber: data.order_number || '',
        statusTitle: data.status_title || 'Status Update',
        statusMessage: data.status_message || '',
        supportEmail: data.support_email || 'support@example.com',
        trackingNumber: data.tracking_number,
        trackingUrl: data.tracking_url,
        carrier: data.carrier,
        pickupLocation: data.pickup_location,
      })
      subject = `Order #${data.order_number} - ${data.status_title || 'Status Update'}`
      break

    default:
      throw new Error(`Unknown template: ${templateSlug}`)
  }

  const html = await renderAsync(element)
  return { html, subject }
}

// Sample data for template previews
const PREVIEW_DATA: Record<string, Record<string, any>> = {
  receipt: {
    order_number: 'ORD-12345',
    items: [
      { name: 'Premium Flower - OG Kush', quantity: 2, price: '$89.99' },
      { name: 'Edibles - Gummy Bears', quantity: 1, price: '$24.99' },
    ],
    subtotal: '$204.97',
    tax_amount: '$16.40',
    shipping_cost: '$10.00',
    total: '$231.37',
  },
  order_confirmation: {
    customer_name: 'John',
    order_number: 'ORD-12345',
    items: [
      { name: 'Premium Flower - Blue Dream', quantity: 1, price: '$49.99' },
      { name: 'Vape Cartridge - Sativa', quantity: 2, price: '$79.98' },
    ],
    subtotal: '$129.97',
    tax_amount: '$10.40',
    shipping_cost: 'FREE',
    total: '$140.37',
    is_pickup: false,
    shipping_name: 'John Doe',
    shipping_address: '123 Main Street\nPortland, OR 97201',
    shop_url: '#',
  },
  order_ready: {
    order_number: 'ORD-12345',
    pickup_location: 'Downtown Portland',
    pickup_address: '456 NW Burnside St, Portland, OR 97209',
  },
  order_shipped: {
    order_number: 'ORD-12345',
    customer_name: 'John',
    shipping_address: '123 Main Street, Portland, OR 97201',
    tracking_number: '9400111899223456789012',
    tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223456789012',
    carrier: 'USPS',
  },
  welcome: {
    customer_name: 'John',
    shop_url: '#',
  },
  password_reset: {
    customer_name: 'John',
    reset_url: '#',
  },
  loyalty_update: {
    customer_name: 'John',
    action: 'earned',
    points: 250,
    total_points: 1500,
    order_number: 'ORD-12345',
    rewards_url: '#',
  },
  back_in_stock: {
    customer_name: 'John',
    product_name: 'Premium Flower - Blue Dream',
    product_url: '#',
  },
  order_status_update: {
    order_number: 'ORD-12345',
    status_title: 'Out for Delivery',
    status_message: 'Your order is out for delivery and will arrive today!',
    support_email: 'support@example.com',
  },
}

serve(async (req) => {
  console.log('send-email function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  // Handle GET requests for template preview
  if (req.method === 'GET') {
    try {
      const templateSlug = url.searchParams.get('template')
      const vendorId = url.searchParams.get('vendorId')

      if (!templateSlug) {
        return new Response(
          JSON.stringify({ error: 'template query param is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Get vendor info for branding
      let vendorName = 'Your Store'
      let logoUrl: string | undefined
      let supportEmail: string | undefined

      if (vendorId) {
        const { data: vendorInfo } = await supabase
          .from('vendors')
          .select('store_name, logo_url')
          .eq('id', vendorId)
          .single()

        const { data: vendorSettings } = await supabase
          .from('vendor_email_settings')
          .select('reply_to, from_email')
          .eq('vendor_id', vendorId)
          .single()

        if (vendorInfo) {
          vendorName = vendorInfo.store_name || vendorName
          logoUrl = vendorInfo.logo_url
        }

        supportEmail = vendorSettings?.reply_to || 'support@floradistro.com'
      }

      // Get preview data for this template
      const previewData = PREVIEW_DATA[templateSlug] || {}

      // Render the template
      const { html } = await renderTemplate(templateSlug, previewData, vendorName, logoUrl, supportEmail)

      // Return HTML directly for WebView
      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      })
    } catch (error) {
      console.error('Preview error:', error)
      return new Response(
        `<html><body style="background:#000;color:#fff;font-family:system-ui;padding:40px;">
          <h1>Preview Error</h1>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body></html>`,
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      )
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    const resend = new Resend(resendApiKey)

    const body: SendEmailRequest = await req.json()
    const {
      to,
      toName,
      subject: providedSubject,
      html: providedHtml,
      text,
      templateSlug,
      data = {},
      emailType = 'transactional',
      category,
      vendorId,
      customerId,
      orderId,
      campaignId,
      templateId,
      fromName: overrideFromName,
      fromEmail: overrideFromEmail,
      replyTo: overrideReplyTo,
      metadata = {},
    } = body

    console.log(`Sending ${emailType} email to ${to}`, { templateSlug, vendorId })

    // CRITICAL: Block placeholder/fake emails from receiving any emails
    if (isPlaceholderEmail(to)) {
      console.warn(`Blocked email to placeholder address: ${to}`)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot send email to placeholder address. Customer needs a real email address.',
          isPlaceholder: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load vendor settings
    const { data: vendorSettings } = await supabase
      .from('vendor_email_settings')
      .select('*')
      .eq('vendor_id', vendorId)
      .single()

    // Check if email type is enabled
    if (vendorSettings) {
      const enabledChecks: Record<string, boolean | undefined> = {
        receipt: vendorSettings.enable_receipts,
        order_confirmation: vendorSettings.enable_order_confirmations,
        order_update: vendorSettings.enable_order_updates,
        loyalty_update: vendorSettings.enable_loyalty_updates,
        password_reset: vendorSettings.enable_password_resets,
        welcome: vendorSettings.enable_welcome_emails,
      }

      if (category && enabledChecks[category] === false) {
        console.warn(`Email type '${category}' is disabled for vendor ${vendorId}`)
        return new Response(
          JSON.stringify({ success: false, error: `Email type '${category}' is disabled` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (emailType === 'marketing' && !vendorSettings.enable_marketing) {
        return new Response(
          JSON.stringify({ success: false, error: 'Marketing emails are disabled' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check customer unsubscribe (marketing only)
    if (emailType === 'marketing' && customerId) {
      const { data: preferences } = await supabase
        .from('customer_email_preferences')
        .select('unsubscribed_marketing')
        .eq('vendor_id', vendorId)
        .eq('customer_id', customerId)
        .single()

      if (preferences?.unsubscribed_marketing) {
        return new Response(
          JSON.stringify({ success: false, error: 'Customer has unsubscribed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch vendor info (for logo)
    const { data: vendorInfo } = await supabase
      .from('vendors')
      .select('id, store_name, logo_url')
      .eq('id', vendorId)
      .single()

    const vendorName = vendorSettings?.from_name || vendorInfo?.store_name || 'Store'
    const logoUrl = vendorInfo?.logo_url || vendorSettings?.vendor_logo
    const fromName = overrideFromName || vendorSettings?.from_name || vendorInfo?.store_name || 'Store'
    const fromEmail = overrideFromEmail || vendorSettings?.from_email || 'noreply@floradistro.com'
    const replyTo = overrideReplyTo || vendorSettings?.reply_to

    let html: string
    let subject: string

    if (templateSlug) {
      // Render React Email template
      console.log(`Rendering template: ${templateSlug}`)
      const supportEmail = replyTo || 'support@floradistro.com'
      const rendered = await renderTemplate(templateSlug, data, vendorName, logoUrl, supportEmail)
      html = rendered.html
      subject = providedSubject || rendered.subject
    } else if (providedHtml) {
      // Legacy: use provided HTML
      html = providedHtml
      subject = providedSubject || 'Message'
    } else {
      throw new Error('Either templateSlug or html must be provided')
    }

    console.log(`Sending from ${fromName} <${fromEmail}>`)

    // Send via Resend
    const resendResponse = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: toName ? `${toName} <${to}>` : to,
      subject,
      html,
      text,
      reply_to: replyTo,
      tags: [
        { name: 'vendor_id', value: vendorId },
        { name: 'email_type', value: emailType },
        ...(category ? [{ name: 'category', value: category }] : []),
        ...(templateSlug ? [{ name: 'template', value: templateSlug }] : []),
      ],
    })

    if (!resendResponse.data) {
      console.error('Resend API error:', resendResponse.error)
      throw new Error(`Resend API error: ${JSON.stringify(resendResponse.error)}`)
    }

    console.log(`Email sent. Resend ID: ${resendResponse.data.id}`)

    // Log to database
    const emailSendRecord: EmailSendRecord = {
      vendor_id: vendorId,
      customer_id: customerId,
      order_id: orderId,
      campaign_id: campaignId,
      template_id: templateId,
      email_type: emailType,
      to_email: to,
      to_name: toName,
      from_email: fromEmail,
      from_name: fromName,
      reply_to: replyTo,
      subject,
      resend_email_id: resendResponse.data.id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: { ...metadata, templateSlug },
    }

    const { error: insertError } = await supabase.from('email_sends').insert(emailSendRecord)
    if (insertError) {
      console.error('Error logging email send:', insertError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        resendId: resendResponse.data.id,
        templateSlug,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-email:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
