/**
 * Email Service
 * Handles all email sending via Supabase Edge Function + Resend
 *
 * Features:
 * - Transactional emails (receipts, order confirmations)
 * - Marketing emails (campaigns, promotions)
 * - Email templates
 * - Vendor settings management
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { EmailTemplateService, TemplateVariables, TemplateCategory } from './email-template.service'

// ============================================
// TYPES
// ============================================

export interface SendEmailParams {
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
  emailType: 'transactional' | 'marketing'
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

export interface SendEmailResponse {
  success: boolean
  resendId?: string
  error?: string
}

export interface VendorEmailSettings {
  id: string
  vendor_id: string
  from_name: string
  from_email: string
  reply_to?: string
  domain: string
  domain_verified: boolean
  resend_domain_id?: string
  enable_receipts: boolean
  enable_order_confirmations: boolean
  enable_order_updates: boolean
  enable_loyalty_updates: boolean
  enable_password_resets: boolean
  enable_welcome_emails: boolean
  enable_marketing: boolean
  require_double_opt_in: boolean
  signature_html?: string
  unsubscribe_footer_html?: string
  email_header_image_url?: string
  created_at: string
  updated_at: string
}

export interface EmailTemplate {
  id: string
  vendor_id: string
  name: string
  slug: string
  type: 'transactional' | 'marketing'
  category?: string
  subject: string
  preview_text?: string
  html_content: string
  text_content?: string
  from_name: string
  from_email?: string
  reply_to?: string
  variables: string[]
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface EmailSend {
  id: string
  vendor_id: string
  customer_id?: string
  order_id?: string
  campaign_id?: string
  template_id?: string
  email_type: 'transactional' | 'marketing'
  to_email: string
  to_name?: string
  from_email: string
  from_name: string
  reply_to?: string
  subject: string
  resend_email_id?: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
  error_message?: string
  opened_at?: string
  clicked_at?: string
  bounced_at?: string
  complained_at?: string
  metadata: Record<string, any>
  created_at: string
  sent_at?: string
  delivered_at?: string
}

// ============================================
// EMAIL SERVICE
// ============================================

export class EmailService {
  /**
   * Send email via Edge Function
   */
  static async sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
    try {
      logger.info('Sending email', {
        to: params.to,
        subject: params.subject,
        emailType: params.emailType,
        category: params.category,
      })

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: params,
      })

      if (error) {
        console.log('❌ Email send error (full):', JSON.stringify(error, null, 2))
        console.log('❌ Error type:', error.constructor.name)
        console.log('❌ Error message:', error.message)

        // FunctionsHttpError has context with the actual response
        if ('context' in error && error.context) {
          console.log('❌ Error context:', JSON.stringify(error.context, null, 2))
        }

        logger.error('Email send error', { error })
        return {
          success: false,
          error: error.message || 'Failed to send email',
        }
      }

      if (!data?.success) {
        console.error('❌ Email send failed - Response data:', data)
        logger.error('Email send failed', { data })
        return {
          success: false,
          error: data?.error || 'Unknown error',
        }
      }

      logger.info('Email sent successfully', { resendId: data.resendId })
      return {
        success: true,
        resendId: data.resendId,
      }
    } catch (error) {
      logger.error('Email service error', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send email using a template from the database
   * This is the preferred method for sending templated emails
   */
  static async sendTemplatedEmail(params: {
    vendorId: string
    templateSlug: string
    to: string
    toName?: string
    variables: TemplateVariables
    customerId?: string
    orderId?: string
    fromName?: string
    fromEmail?: string
  }): Promise<SendEmailResponse> {
    try {
      // Get the template from database
      const template = await EmailTemplateService.getTemplateBySlug(
        params.vendorId,
        params.templateSlug
      )

      if (!template) {
        logger.error('Email template not found', {
          vendorId: params.vendorId,
          slug: params.templateSlug,
        })
        return {
          success: false,
          error: `Template "${params.templateSlug}" not found`,
        }
      }

      if (!template.is_active) {
        logger.warn('Attempting to use inactive template', { templateId: template.id })
        return {
          success: false,
          error: 'Template is inactive',
        }
      }

      // Render the template with variables
      const html = EmailTemplateService.render(template.html_content, params.variables)
      const subject = EmailTemplateService.renderSubject(template.subject, params.variables)
      const text = template.text_content
        ? EmailTemplateService.render(template.text_content, params.variables)
        : undefined

      // Send the email
      return this.sendEmail({
        to: params.to,
        toName: params.toName,
        subject,
        html,
        text,
        emailType: template.type,
        category: template.category || undefined,
        vendorId: params.vendorId,
        customerId: params.customerId,
        orderId: params.orderId,
        templateId: template.id,
        fromName: params.fromName || template.from_name,
        fromEmail: params.fromEmail || template.from_email || undefined,
        replyTo: template.reply_to || undefined,
      })
    } catch (error) {
      logger.error('Error sending templated email', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send email using a template category (uses default template for that category)
   */
  static async sendByCategory(params: {
    vendorId: string
    category: TemplateCategory
    to: string
    toName?: string
    variables: TemplateVariables
    customerId?: string
    orderId?: string
    fromName?: string
    fromEmail?: string
  }): Promise<SendEmailResponse> {
    try {
      // Get the default template for this category
      const template = await EmailTemplateService.getDefaultTemplate(
        params.vendorId,
        params.category
      )

      if (!template) {
        logger.warn('No template found for category, falling back to hardcoded', {
          vendorId: params.vendorId,
          category: params.category,
        })
        // Fallback to hardcoded templates for backwards compatibility
        return this.sendFallbackEmail(params)
      }

      // Render and send
      const html = EmailTemplateService.render(template.html_content, params.variables)
      const subject = EmailTemplateService.renderSubject(template.subject, params.variables)
      const text = template.text_content
        ? EmailTemplateService.render(template.text_content, params.variables)
        : undefined

      return this.sendEmail({
        to: params.to,
        toName: params.toName,
        subject,
        html,
        text,
        emailType: template.type,
        category: params.category,
        vendorId: params.vendorId,
        customerId: params.customerId,
        orderId: params.orderId,
        templateId: template.id,
        fromName: params.fromName || template.from_name,
        fromEmail: params.fromEmail || template.from_email || undefined,
        replyTo: template.reply_to || undefined,
      })
    } catch (error) {
      logger.error('Error sending email by category', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Fallback for when no template exists (uses hardcoded templates)
   */
  private static async sendFallbackEmail(params: {
    vendorId: string
    category: TemplateCategory
    to: string
    toName?: string
    variables: TemplateVariables
    customerId?: string
    orderId?: string
    fromName?: string
    fromEmail?: string
  }): Promise<SendEmailResponse> {
    // This uses the old hardcoded templates as fallback
    // TODO: Remove this once all vendors have templates seeded
    logger.warn('Using fallback hardcoded template', { category: params.category })

    const vendorName = (params.variables.vendor_name as string) || 'Your Store'

    switch (params.category) {
      case 'receipt':
        return this.sendReceipt({
          vendorId: params.vendorId,
          orderId: params.orderId || '',
          customerEmail: params.to,
          customerName: params.toName,
          orderNumber: (params.variables.order_number as string) || '',
          total: (params.variables.total as number) || 0,
          items: (params.variables.items as Array<{ name: string; quantity: number; price: number }>) || [],
          customerId: params.customerId,
          vendorName,
        })

      default:
        return {
          success: false,
          error: `No fallback available for category: ${params.category}`,
        }
    }
  }

  /**
   * Send receipt email after purchase
   */
  static async sendReceipt(params: {
    vendorId: string
    orderId: string
    customerEmail: string
    customerName?: string
    orderNumber: string
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    customerId?: string
    vendorName?: string
    vendorLogo?: string
  }): Promise<SendEmailResponse> {
    const html = this.generateReceiptHTML({
      orderNumber: params.orderNumber,
      total: params.total,
      items: params.items,
      vendorName: params.vendorName || 'Flora Distro',
      vendorLogo: params.vendorLogo,
    })
    const text = this.generateReceiptText(params)

    return this.sendEmail({
      to: params.customerEmail,
      toName: params.customerName,
      subject: `Receipt #${params.orderNumber}`,
      html,
      text,
      emailType: 'transactional',
      category: 'receipt',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      metadata: {
        order_number: params.orderNumber,
        total: params.total,
      },
    })
  }

  /**
   * Send order confirmation (for pickup/shipping orders)
   */
  static async sendOrderConfirmation(params: {
    vendorId: string
    orderId: string
    customerEmail: string
    customerName?: string
    orderNumber: string
    orderType: 'pickup' | 'shipping'
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    pickupLocation?: string
    estimatedTime?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    const html = this.generateOrderConfirmationHTML(params)
    const text = this.generateOrderConfirmationText(params)

    return this.sendEmail({
      to: params.customerEmail,
      toName: params.customerName,
      subject: `Order Confirmation #${params.orderNumber}`,
      html,
      text,
      emailType: 'transactional',
      category: 'order_confirmation',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      metadata: {
        order_number: params.orderNumber,
        order_type: params.orderType,
        total: params.total,
      },
    })
  }

  /**
   * Send order ready for pickup notification
   */
  static async sendOrderReady(params: {
    vendorId: string
    orderId: string
    customerEmail: string
    customerName?: string
    orderNumber: string
    pickupLocation: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    const html = this.generateOrderReadyHTML(params)
    const text = this.generateOrderReadyText(params)

    return this.sendEmail({
      to: params.customerEmail,
      toName: params.customerName,
      subject: `Your order #${params.orderNumber} is ready for pickup!`,
      html,
      text,
      emailType: 'transactional',
      category: 'order_update',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      metadata: {
        order_number: params.orderNumber,
      },
    })
  }

  /**
   * Send order shipped notification
   */
  static async sendOrderShipped(params: {
    vendorId: string
    orderId: string
    customerEmail: string
    customerName?: string
    orderNumber: string
    trackingNumber?: string
    carrier?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    const html = this.generateOrderShippedHTML(params)
    const text = this.generateOrderShippedText(params)

    return this.sendEmail({
      to: params.customerEmail,
      toName: params.customerName,
      subject: `Your order #${params.orderNumber} has shipped!`,
      html,
      text,
      emailType: 'transactional',
      category: 'order_update',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      metadata: {
        order_number: params.orderNumber,
        tracking_number: params.trackingNumber,
        carrier: params.carrier,
      },
    })
  }

  /**
   * Send test email using database templates (single source of truth)
   */
  static async sendTestEmail(params: {
    vendorId: string
    to: string
    fromName?: string
    fromEmail?: string
    vendorName?: string
    vendorLogo?: string
    emailHeaderImage?: string
    emailType?: 'receipt' | 'order_confirmation' | 'order_update' | 'loyalty' | 'welcome' | 'marketing'
  }): Promise<SendEmailResponse> {
    // Map email type to template slug and test variables
    let templateSlug: string
    let variables: Record<string, any>
    let subject: string | undefined
    const category = params.emailType || 'test'

    // Sample test data
    const testItems = [
      { name: 'Sample Product 1', quantity: 2, price: '$39.99' },
      { name: 'Sample Product 2', quantity: 1, price: '$20.01' },
    ]

    switch (params.emailType) {
      case 'receipt':
        templateSlug = 'receipt'
        variables = {
          order_number: 'TEST-001',
          items: testItems,
          subtotal: '$59.99',
          tax_amount: '$5.00',
          total: '$64.99',
        }
        subject = 'Test Receipt #TEST-001'
        break

      case 'order_confirmation':
        templateSlug = 'order_confirmation'
        variables = {
          order_number: 'TEST-001',
          customer_name: 'Test Customer',
          items: testItems,
          subtotal: '$59.99',
          shipping_cost: '$5.00',
          tax_amount: '$5.00',
          total: '$69.99',
          is_pickup: true,
          pickup_location: 'Main Store - 123 Test Street',
          estimated_time: '30 minutes',
          shop_url: 'https://example.com/shop',
        }
        subject = 'Test Order Confirmation #TEST-001'
        break

      case 'order_update':
        templateSlug = 'order_ready'
        variables = {
          order_number: 'TEST-001',
          pickup_location: 'Main Store',
          pickup_address: '123 Test Street, City, ST 12345',
        }
        subject = 'Test: Your order #TEST-001 is ready!'
        break

      case 'loyalty':
        templateSlug = 'loyalty_update'
        variables = {
          customer_name: 'Test Customer',
          action: 'earned',
          points: '150',
          total_points: '1,500',
          order_number: 'TEST-001',
          rewards_url: 'https://example.com/rewards',
        }
        subject = 'Test Loyalty Update - You earned 150 points!'
        break

      case 'welcome':
        templateSlug = 'welcome'
        variables = {
          customer_name: 'Test Customer',
          shop_url: 'https://example.com/shop',
        }
        subject = 'Test Welcome Email'
        break

      case 'marketing':
        // For marketing, use a simple test - fall back to welcome template
        templateSlug = 'welcome'
        variables = {
          customer_name: 'Test Customer',
          shop_url: 'https://example.com/shop',
        }
        subject = 'Test Marketing Email'
        break

      default:
        // Default test uses welcome template
        templateSlug = 'welcome'
        variables = {
          customer_name: 'Test Customer',
          shop_url: 'https://example.com/shop',
        }
        subject = 'Test Email - Email System Configured'
    }

    // Send via edge function using templateSlug (same as production emails)
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: params.to,
          templateSlug,
          variables,
          subject, // Override subject with "Test" prefix
          emailType: params.emailType === 'marketing' ? 'marketing' : 'transactional',
          category,
          vendorId: params.vendorId,
          fromName: params.fromName,
          fromEmail: params.fromEmail,
        },
      })

      if (error) {
        logger.error('Test email send error', { error })
        return {
          success: false,
          error: error.message || 'Failed to send test email',
        }
      }

      if (!data?.success) {
        logger.error('Test email send failed', { data })
        return {
          success: false,
          error: data?.error || 'Unknown error',
        }
      }

      logger.info('Test email sent successfully', { resendId: data.resendId, templateSlug })
      return {
        success: true,
        resendId: data.resendId,
      }
    } catch (error) {
      logger.error('Test email service error', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================
  // VENDOR EMAIL SETTINGS
  // ============================================

  /**
   * Get vendor email settings
   */
  static async getVendorSettings(vendorId: string): Promise<VendorEmailSettings | null> {
    try {
      const { data, error } = await supabase
        .from('vendor_email_settings')
        .select('*')
        .eq('vendor_id', vendorId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found - return null
          return null
        }
        logger.error('Error fetching vendor email settings', { error })
        throw error
      }

      return data
    } catch (error) {
      logger.error('Error in getVendorSettings', { error })
      return null
    }
  }

  /**
   * Create or update vendor email settings
   */
  static async upsertVendorSettings(
    vendorId: string,
    settings: Partial<Omit<VendorEmailSettings, 'id' | 'vendor_id' | 'created_at' | 'updated_at'>>,
    userId: string
  ): Promise<VendorEmailSettings | null> {
    try {
      console.log('🔧 Upserting email settings for vendor:', vendorId)
      console.log('🔧 User ID:', userId)
      console.log('🔧 Settings:', settings)

      // DEBUG: Check what auth.uid() returns and user's vendor_id
      const { data: debugUser } = await supabase
        .from('users')
        .select('id, vendor_id')
        .eq('id', userId)
        .single()

      console.log('🔍 Debug - User from DB:', debugUser)
      console.log('🔍 Debug - User vendor_id:', debugUser?.vendor_id)
      console.log('🔍 Debug - Vendor ID being inserted:', vendorId)
      console.log('🔍 Debug - Match?', debugUser?.vendor_id === vendorId)

      const { data, error } = await supabase
        .from('vendor_email_settings')
        .upsert(
          {
            vendor_id: vendorId,
            ...settings,
            updated_by_user_id: userId,
          },
          {
            onConflict: 'vendor_id',
          }
        )
        .select()
        .single()

      if (error) {
        // Log all error properties explicitly (Supabase errors have non-enumerable properties)
        console.error('❌ Supabase error - Full details:')
        console.error('  - Code:', error.code)
        console.error('  - Message:', error.message)
        console.error('  - Details:', error.details)
        console.error('  - Hint:', error.hint)
        console.error('  - Raw error object:', JSON.stringify(error, null, 2))

        logger.error('Error upserting vendor email settings', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })

        // Check if table doesn't exist
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          throw new Error('Email system not set up. Please apply database migration first (see EMAIL_SYSTEM_GUIDE.md)')
        }

        throw error
      }

      console.log('✅ Email settings upserted successfully:', data)
      return data
    } catch (error) {
      console.error('❌ Error in upsertVendorSettings:')
      if (error && typeof error === 'object') {
        console.error('  - Error type:', error.constructor?.name)
        console.error('  - Error message:', (error as any).message)
        console.error('  - Error code:', (error as any).code)
        console.error('  - Error details:', (error as any).details)
        console.error('  - Error hint:', (error as any).hint)
      } else {
        console.error('  - Raw error:', error)
      }

      logger.error('Error in upsertVendorSettings', {
        message: error instanceof Error ? error.message : String(error),
        type: error?.constructor?.name,
      })
      return null
    }
  }

  // ============================================
  // EMAIL SENDS QUERIES
  // ============================================

  /**
   * Get recent email sends for a vendor
   */
  static async getRecentSends(vendorId: string, limit = 50): Promise<EmailSend[]> {
    try {
      const { data, error } = await supabase
        .from('email_sends')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        logger.error('Error fetching email sends', { error })
        throw error
      }

      return data || []
    } catch (error) {
      logger.error('Error in getRecentSends', { error })
      return []
    }
  }

  /**
   * Get email sends for a specific order
   */
  static async getOrderEmails(orderId: string): Promise<EmailSend[]> {
    try {
      const { data, error } = await supabase
        .from('email_sends')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching order emails', { error })
        throw error
      }

      return data || []
    } catch (error) {
      logger.error('Error in getOrderEmails', { error })
      return []
    }
  }

  // ============================================
  // EMAIL TEMPLATES (HTML GENERATION)
  // ============================================

  private static generateReceiptHTML(params: {
    orderNumber: string
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    vendorName: string
    vendorLogo?: string
    emailHeaderImage?: string
  }): string {
    const itemsHTML = params.items
      .map(
        item => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #d2d2d7;">
            <span style="color: #1d1d1f; font-size: 17px; font-weight: 500;">${item.name}</span>
            <br>
            <span style="color: #86868b; font-size: 15px;">Qty: ${item.quantity}</span>
          </td>
          <td style="padding: 16px 0; border-bottom: 1px solid #d2d2d7; text-align: right; color: #1d1d1f; font-size: 17px; font-weight: 500; vertical-align: top;">
            $${item.price.toFixed(2)}
          </td>
        </tr>
      `
      )
      .join('')

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt #${params.orderNumber}</title>
          <style>
            @font-face {
              font-family: 'DonGraffiti';
              src: url('https://floradistro.com/DonGraffiti.otf') format('opentype');
              font-weight: normal;
              font-style: normal;
            }

            @media only screen and (max-width: 600px) {
              .brand-name {
                font-size: 36px !important;
              }
              .receipt-header {
                font-size: 24px !important;
              }
            }
          </style>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">

          <!-- Container -->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

            <!-- Header with Logo -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
              <tr>
                <td align="center" style="padding: 80px 30px;">
                  ${params.emailHeaderImage ? `
                    <img src="${params.emailHeaderImage}" alt="${params.vendorName}" class="email-header-img" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
                  ` : `
                    ${params.vendorLogo ? `
                      <img src="${params.vendorLogo}" alt="" width="80" height="80" style="display: block; margin: 0 auto 24px auto;" />
                    ` : ``}
                    <div style="font-family: 'DonGraffiti', Georgia, 'Times New Roman', serif; font-size: 48px; color: #ffffff; font-weight: 400; letter-spacing: 3px; line-height: 1.2;">
                      ${params.vendorName}
                    </div>
                  `}
                </td>
              </tr>
            </table>

            <!-- Receipt Content -->
            <div style="padding: 40px 20px;">

              <!-- Receipt Header -->
              <div style="text-align: center; margin-bottom: 48px;">
                <h2 class="receipt-header" style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.5px;">
                  Receipt
                </h2>
                <p style="margin: 0; font-size: 15px; color: #86868b;">
                  Order #${params.orderNumber}
                </p>
              </div>

              <!-- Items Table -->
              <div style="margin-bottom: 40px;">
                <table style="width: 100%; border-collapse: collapse;">
                  ${itemsHTML}
                </table>
              </div>

              <!-- Total -->
              <div style="background-color: #f5f5f7; border-radius: 12px; padding: 24px; margin-bottom: 40px;">
                <table style="width: 100%;">
                  <tr>
                    <td style="font-size: 19px; font-weight: 600; color: #1d1d1f;">Total</td>
                    <td style="text-align: right; font-size: 24px; font-weight: 600; color: #1d1d1f;">
                      $${params.total.toFixed(2)}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Thank You Message -->
              <div style="text-align: center;">
                <p style="margin: 0; font-size: 17px; color: #86868b; line-height: 1.5;">
                  Thank you for your purchase
                </p>
              </div>

            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
              <p style="margin: 0; font-size: 12px; color: #86868b; letter-spacing: 0.2px;">
                ${params.vendorName} © ${new Date().getFullYear()}
              </p>
            </div>

          </div>
        </body>
      </html>
    `
  }

  private static generateReceiptText(params: {
    orderNumber: string
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
  }): string {
    const itemsText = params.items
      .map(item => `${item.name} × ${item.quantity} - $${item.price.toFixed(2)}`)
      .join('\n')

    return `
Receipt #${params.orderNumber}

${itemsText}

Total: $${params.total.toFixed(2)}

Thank you for your purchase!
    `.trim()
  }

  private static generateOrderConfirmationHTML(params: {
    orderNumber: string
    orderType: 'pickup' | 'shipping'
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    pickupLocation?: string
    estimatedTime?: string
  }): string {
    const itemsHTML = params.items
      .map(
        item => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
            ${item.name} × ${item.quantity}
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
            $${item.price.toFixed(2)}
          </td>
        </tr>
      `
      )
      .join('')

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation #${params.orderNumber}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Order #${params.orderNumber}</p>
          </div>

          ${
            params.orderType === 'pickup'
              ? `
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: 600; color: #065f46;">📍 Pickup Details</p>
            <p style="margin: 8px 0 0 0; color: #047857;">
              ${params.pickupLocation || 'Location TBD'}<br>
              ${params.estimatedTime ? `Estimated: ${params.estimatedTime}` : ''}
            </p>
          </div>
          `
              : `
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: 600; color: #1e40af;">📦 Shipping Details</p>
            <p style="margin: 8px 0 0 0; color: #1e3a8a;">
              Your order will be shipped soon. You'll receive a tracking number when it ships.
            </p>
          </div>
          `
          }

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h2 style="margin: 0 0 16px 0; font-size: 18px;">Order Items</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${itemsHTML}
              <tr>
                <td style="padding: 16px 0 8px 0; font-weight: 600; font-size: 18px;">Total</td>
                <td style="padding: 16px 0 8px 0; text-align: right; font-weight: 600; font-size: 18px;">
                  $${params.total.toFixed(2)}
                </td>
              </tr>
            </table>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Thank you for your order!
          </p>
        </body>
      </html>
    `
  }

  private static generateOrderConfirmationText(params: {
    orderNumber: string
    orderType: 'pickup' | 'shipping'
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    pickupLocation?: string
    estimatedTime?: string
  }): string {
    const itemsText = params.items
      .map(item => `${item.name} × ${item.quantity} - $${item.price.toFixed(2)}`)
      .join('\n')

    return `
Order Confirmed! #${params.orderNumber}

${
  params.orderType === 'pickup'
    ? `Pickup Location: ${params.pickupLocation || 'TBD'}
${params.estimatedTime ? `Estimated Time: ${params.estimatedTime}` : ''}`
    : 'Your order will be shipped soon.'
}

Order Items:
${itemsText}

Total: $${params.total.toFixed(2)}

Thank you for your order!
    `.trim()
  }

  private static generateOrderReadyHTML(params: {
    orderNumber: string
    pickupLocation: string
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Ready #${params.orderNumber}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">✓ Your order is ready!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Order #${params.orderNumber}</p>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <p style="margin: 0 0 16px 0; font-size: 16px;">
              Your order is ready for pickup at:
            </p>
            <p style="margin: 0; font-weight: 600; font-size: 18px; color: #10b981;">
              📍 ${params.pickupLocation}
            </p>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            See you soon!
          </p>
        </body>
      </html>
    `
  }

  private static generateOrderReadyText(params: {
    orderNumber: string
    pickupLocation: string
  }): string {
    return `
Your order is ready! #${params.orderNumber}

Pickup Location: ${params.pickupLocation}

See you soon!
    `.trim()
  }

  private static generateOrderShippedHTML(params: {
    orderNumber: string
    trackingNumber?: string
    carrier?: string
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Shipped #${params.orderNumber}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">📦 Your order has shipped!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Order #${params.orderNumber}</p>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            ${
              params.trackingNumber
                ? `
            <p style="margin: 0 0 8px 0; font-weight: 600;">Tracking Number:</p>
            <p style="margin: 0 0 16px 0; font-family: monospace; font-size: 16px; color: #3b82f6;">
              ${params.trackingNumber}
            </p>
            `
                : ''
            }
            ${
              params.carrier
                ? `
            <p style="margin: 0 0 8px 0; font-weight: 600;">Carrier:</p>
            <p style="margin: 0; font-size: 16px;">
              ${params.carrier}
            </p>
            `
                : ''
            }
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Your package is on its way!
          </p>
        </body>
      </html>
    `
  }

  private static generateOrderShippedText(params: {
    orderNumber: string
    trackingNumber?: string
    carrier?: string
  }): string {
    return `
Your order has shipped! #${params.orderNumber}

${params.trackingNumber ? `Tracking: ${params.trackingNumber}` : ''}
${params.carrier ? `Carrier: ${params.carrier}` : ''}

Your package is on its way!
    `.trim()
  }

  private static generateTestEmailHTML(params: {
    vendorName: string
    vendorLogo?: string
    emailHeaderImage?: string
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
          <style>
            @font-face {
              font-family: 'DonGraffiti';
              src: url('https://floradistro.com/DonGraffiti.otf') format('opentype');
              font-weight: normal;
              font-style: normal;
            }

            @media only screen and (max-width: 600px) {
              .brand-name {
                font-size: 36px !important;
              }
              .receipt-header {
                font-size: 24px !important;
              }
              .email-header-img {
                max-width: 90% !important;
              }
            }
          </style>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">

          <!-- Container -->
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

            <!-- Header with Logo -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
              <tr>
                <td align="center" style="padding: 80px 30px;">
                  ${params.emailHeaderImage ? `
                    <img src="${params.emailHeaderImage}" alt="${params.vendorName}" class="email-header-img" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
                  ` : `
                    ${params.vendorLogo ? `
                      <img src="${params.vendorLogo}" alt="" width="80" height="80" style="display: block; margin: 0 auto 24px auto;" />
                    ` : ``}
                    <div style="font-family: 'DonGraffiti', Georgia, 'Times New Roman', serif; font-size: 48px; color: #ffffff; font-weight: 400; letter-spacing: 3px; line-height: 1.2;">
                      ${params.vendorName}
                    </div>
                  `}
                </td>
              </tr>
            </table>

            <!-- Success Message -->
            <div style="text-align: center; padding: 40px 20px;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px;">
                <tr>
                  <td align="center" style="width: 72px; height: 72px; background-color: #000000; border-radius: 50%; font-size: 40px; color: #ffffff; line-height: 72px; vertical-align: middle;">
                    ✓
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.5px;">
                Your email is ready
              </h2>

              <p style="margin: 0 0 40px 0; font-size: 17px; color: #86868b; line-height: 1.6; max-width: 460px; margin-left: auto; margin-right: auto;">
                Your email system is now configured and ready to send beautiful transactional emails to your customers.
              </p>

              <!-- Features -->
              <div style="text-align: left; max-width: 460px; margin: 0 auto;">

                <div style="margin-bottom: 24px;">
                  <div style="display: inline-block; width: 6px; height: 6px; background-color: #000000; border-radius: 50%; margin-right: 12px; vertical-align: middle;"></div>
                  <span style="font-size: 17px; color: #1d1d1f; font-weight: 500;">Receipts</span>
                  <p style="margin: 8px 0 0 18px; font-size: 15px; color: #86868b; line-height: 1.5;">
                    Sent automatically after every sale
                  </p>
                </div>

                <div style="margin-bottom: 24px;">
                  <div style="display: inline-block; width: 6px; height: 6px; background-color: #000000; border-radius: 50%; margin-right: 12px; vertical-align: middle;"></div>
                  <span style="font-size: 17px; color: #1d1d1f; font-weight: 500;">Order Confirmations</span>
                  <p style="margin: 8px 0 0 18px; font-size: 15px; color: #86868b; line-height: 1.5;">
                    For pickup and shipping orders
                  </p>
                </div>

                <div style="margin-bottom: 0;">
                  <div style="display: inline-block; width: 6px; height: 6px; background-color: #000000; border-radius: 50%; margin-right: 12px; vertical-align: middle;"></div>
                  <span style="font-size: 17px; color: #1d1d1f; font-weight: 500;">Status Updates</span>
                  <p style="margin: 8px 0 0 18px; font-size: 15px; color: #86868b; line-height: 1.5;">
                    When orders are ready or shipped
                  </p>
                </div>

              </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
              <p style="margin: 0; font-size: 12px; color: #86868b; letter-spacing: 0.2px;">
                ${params.vendorName} © ${new Date().getFullYear()}
              </p>
            </div>

          </div>
        </body>
      </html>
    `
  }

  private static generateLoyaltyTestHTML(params: {
    vendorName: string
    vendorLogo?: string
    emailHeaderImage?: string
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Loyalty Update</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
              <tr>
                <td align="center" style="padding: 60px 30px;">
                  ${params.emailHeaderImage ? `
                    <img src="${params.emailHeaderImage}" alt="${params.vendorName}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
                  ` : `
                    ${params.vendorLogo ? `<img src="${params.vendorLogo}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto;" />` : ''}
                    <div style="font-size: 32px; color: #ffffff; font-weight: 600;">${params.vendorName}</div>
                  `}
                </td>
              </tr>
            </table>
            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #1d1d1f;">
                Your Loyalty Update
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 17px; color: #86868b;">
                You've earned 150 points from your recent purchase!
              </p>
              <div style="background: #f5f5f7; border-radius: 12px; padding: 24px; margin: 0 auto; max-width: 300px;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #86868b;">Current Balance</p>
                <p style="margin: 0; font-size: 36px; font-weight: 700; color: #1d1d1f;">1,250 pts</p>
              </div>
            </div>
            <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
              <p style="margin: 0; font-size: 12px; color: #86868b;">${params.vendorName} © ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  private static generateWelcomeTestHTML(params: {
    vendorName: string
    vendorLogo?: string
    emailHeaderImage?: string
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
              <tr>
                <td align="center" style="padding: 60px 30px;">
                  ${params.emailHeaderImage ? `
                    <img src="${params.emailHeaderImage}" alt="${params.vendorName}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
                  ` : `
                    ${params.vendorLogo ? `<img src="${params.vendorLogo}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto;" />` : ''}
                    <div style="font-size: 32px; color: #ffffff; font-weight: 600;">${params.vendorName}</div>
                  `}
                </td>
              </tr>
            </table>
            <div style="text-align: center; padding: 40px 20px;">
              <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">
                Welcome to ${params.vendorName}!
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 17px; color: #86868b; max-width: 400px; margin-left: auto; margin-right: auto;">
                Thanks for joining our loyalty program. You'll earn points on every purchase and get access to exclusive rewards.
              </p>
              <div style="background: #10b981; color: white; display: inline-block; padding: 14px 28px; border-radius: 8px; font-size: 17px; font-weight: 600;">
                Start Shopping
              </div>
            </div>
            <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
              <p style="margin: 0; font-size: 12px; color: #86868b;">${params.vendorName} © ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  private static generateMarketingTestHTML(params: {
    vendorName: string
    vendorLogo?: string
    emailHeaderImage?: string
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Special Offer</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
              <tr>
                <td align="center" style="padding: 60px 30px;">
                  ${params.emailHeaderImage ? `
                    <img src="${params.emailHeaderImage}" alt="${params.vendorName}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
                  ` : `
                    ${params.vendorLogo ? `<img src="${params.vendorLogo}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto;" />` : ''}
                    <div style="font-size: 32px; color: #ffffff; font-weight: 600;">${params.vendorName}</div>
                  `}
                </td>
              </tr>
            </table>
            <div style="text-align: center; padding: 40px 20px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 1px;">Limited Time Offer</p>
              <h2 style="margin: 0 0 16px 0; font-size: 36px; font-weight: 700; color: #1d1d1f;">
                20% OFF
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 17px; color: #86868b; max-width: 400px; margin-left: auto; margin-right: auto;">
                Use code <strong style="color: #1d1d1f;">SAVE20</strong> at checkout to save on your next order.
              </p>
              <div style="background: #000000; color: white; display: inline-block; padding: 14px 28px; border-radius: 8px; font-size: 17px; font-weight: 600;">
                Shop Now
              </div>
              <p style="margin: 24px 0 0 0; font-size: 13px; color: #86868b;">
                Offer expires in 7 days
              </p>
            </div>
            <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #86868b;">${params.vendorName} © ${new Date().getFullYear()}</p>
              <p style="margin: 0; font-size: 11px; color: #86868b;">
                <a href="#" style="color: #86868b;">Unsubscribe</a> | <a href="#" style="color: #86868b;">Preferences</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  private static generateOrderConfirmationTestHTML(params: {
    orderNumber: string
    orderType: 'pickup' | 'shipping'
    total: number
    items: Array<{ name: string; quantity: number; price: number }>
    pickupLocation?: string
    estimatedTime?: string
    vendorName: string
    vendorLogo?: string
    emailHeaderImage?: string
  }): string {
    const itemsHTML = params.items
      .map(
        item => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #d2d2d7;">
            <span style="color: #1d1d1f; font-size: 17px; font-weight: 500;">${item.name}</span>
            <br>
            <span style="color: #86868b; font-size: 15px;">Qty: ${item.quantity}</span>
          </td>
          <td style="padding: 16px 0; border-bottom: 1px solid #d2d2d7; text-align: right; color: #1d1d1f; font-size: 17px; font-weight: 500; vertical-align: top;">
            $${item.price.toFixed(2)}
          </td>
        </tr>
      `
      )
      .join('')

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation #${params.orderNumber}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
              <tr>
                <td align="center" style="padding: 60px 30px;">
                  ${params.emailHeaderImage ? `
                    <img src="${params.emailHeaderImage}" alt="${params.vendorName}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
                  ` : `
                    ${params.vendorLogo ? `<img src="${params.vendorLogo}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto;" />` : ''}
                    <div style="font-size: 32px; color: #ffffff; font-weight: 600;">${params.vendorName}</div>
                  `}
                </td>
              </tr>
            </table>

            <div style="text-align: center; padding: 40px 20px;">
              <div style="width: 72px; height: 72px; background-color: #10b981; border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 36px; color: white; line-height: 72px;">✓</span>
              </div>
              <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">
                Order Confirmed
              </h2>
              <p style="margin: 0; font-size: 15px; color: #86868b;">
                Order #${params.orderNumber}
              </p>
            </div>

            ${params.orderType === 'pickup' ? `
            <div style="margin: 0 20px 24px; background: #f5f5f7; border-radius: 12px; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">Pickup Location</p>
              <p style="margin: 0 0 4px 0; font-size: 17px; font-weight: 600; color: #1d1d1f;">
                ${params.pickupLocation || 'Location TBD'}
              </p>
              ${params.estimatedTime ? `<p style="margin: 0; font-size: 15px; color: #86868b;">Ready in ${params.estimatedTime}</p>` : ''}
            </div>
            ` : `
            <div style="margin: 0 20px 24px; background: #f5f5f7; border-radius: 12px; padding: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px;">Shipping</p>
              <p style="margin: 0; font-size: 17px; color: #1d1d1f;">
                You'll receive tracking info when your order ships.
              </p>
            </div>
            `}

            <div style="padding: 0 20px 40px;">
              <table style="width: 100%; border-collapse: collapse;">
                ${itemsHTML}
              </table>
              <div style="background-color: #f5f5f7; border-radius: 12px; padding: 20px; margin-top: 24px;">
                <table style="width: 100%;">
                  <tr>
                    <td style="font-size: 19px; font-weight: 600; color: #1d1d1f;">Total</td>
                    <td style="text-align: right; font-size: 24px; font-weight: 600; color: #1d1d1f;">
                      $${params.total.toFixed(2)}
                    </td>
                  </tr>
                </table>
              </div>
            </div>

            <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
              <p style="margin: 0; font-size: 12px; color: #86868b;">
                ${params.vendorName} © ${new Date().getFullYear()}
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  private static generateOrderUpdateTestHTML(params: {
    orderNumber: string
    pickupLocation: string
    vendorName: string
    vendorLogo?: string
    emailHeaderImage?: string
  }): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Ready #${params.orderNumber}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; background-color: #f5f5f7; color: #1d1d1f; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
              <tr>
                <td align="center" style="padding: 60px 30px;">
                  ${params.emailHeaderImage ? `
                    <img src="${params.emailHeaderImage}" alt="${params.vendorName}" style="display: block; margin: 0 auto; max-width: 100%; width: 100%; height: auto;" />
                  ` : `
                    ${params.vendorLogo ? `<img src="${params.vendorLogo}" alt="" width="60" height="60" style="display: block; margin: 0 auto 16px auto;" />` : ''}
                    <div style="font-size: 32px; color: #ffffff; font-weight: 600;">${params.vendorName}</div>
                  `}
                </td>
              </tr>
            </table>

            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
              <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1d1d1f;">
                Your Order is Ready!
              </h2>
              <p style="margin: 0; font-size: 15px; color: #86868b;">
                Order #${params.orderNumber}
              </p>
            </div>

            <div style="margin: 0 20px 40px; background: #10b98115; border-radius: 12px; padding: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Pickup Location</p>
              <p style="margin: 0; font-size: 20px; font-weight: 600; color: #1d1d1f;">
                ${params.pickupLocation}
              </p>
            </div>

            <div style="text-align: center; padding: 0 20px 40px;">
              <p style="margin: 0; font-size: 17px; color: #86868b;">
                We can't wait to see you!
              </p>
            </div>

            <div style="text-align: center; padding: 32px 20px; background-color: #f5f5f7; border-top: 1px solid #d2d2d7;">
              <p style="margin: 0; font-size: 12px; color: #86868b;">
                ${params.vendorName} © ${new Date().getFullYear()}
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }
}
