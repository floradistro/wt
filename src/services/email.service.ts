/**
 * Email Service
 * Simple wrapper for send-email edge function with React Email templates
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// ============================================
// TYPES
// ============================================

export type TemplateSlug =
  | 'receipt'
  | 'order_confirmation'
  | 'order_ready'
  | 'order_shipped'
  | 'welcome'
  | 'password_reset'
  | 'loyalty_update'
  | 'back_in_stock'
  | 'order_status_update'

export interface SendEmailParams {
  to: string
  toName?: string
  subject?: string
  templateSlug: TemplateSlug
  data: Record<string, any>
  vendorId: string
  customerId?: string
  orderId?: string
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
  domain_verified?: boolean
  email_header_image_url?: string
  enable_receipts: boolean
  enable_order_confirmations: boolean
  enable_order_updates: boolean
  enable_loyalty_updates: boolean
  enable_password_resets: boolean
  enable_welcome_emails: boolean
  enable_marketing: boolean
}

// ============================================
// EMAIL SERVICE
// ============================================

export class EmailService {
  /**
   * Send email via edge function using React Email templates
   */
  static async send(params: SendEmailParams): Promise<SendEmailResponse> {
    try {
      logger.info('Sending email', {
        to: params.to,
        template: params.templateSlug,
        vendorId: params.vendorId,
      })

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: params.to,
          toName: params.toName,
          subject: params.subject,
          templateSlug: params.templateSlug,
          data: params.data,
          vendorId: params.vendorId,
          customerId: params.customerId,
          orderId: params.orderId,
          emailType: 'transactional',
        },
      })

      if (error) {
        logger.error('Email send error', { error })
        return { success: false, error: error.message }
      }

      if (!data?.success) {
        logger.error('Email send failed', { data })
        return { success: false, error: data?.error || 'Unknown error' }
      }

      logger.info('Email sent', { resendId: data.resendId })
      return { success: true, resendId: data.resendId }
    } catch (error) {
      logger.error('Email service error', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  /**
   * Send receipt email
   */
  static async sendReceipt(params: {
    vendorId: string
    orderId: string
    customerEmail: string
    customerName?: string
    orderNumber: string
    items: Array<{ name: string; quantity: number; price: string }>
    subtotal?: string
    tax?: string
    shipping?: string
    discount?: string
    total: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'receipt',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      data: {
        order_number: params.orderNumber,
        items: params.items,
        subtotal: params.subtotal,
        tax_amount: params.tax,
        shipping_cost: params.shipping,
        discount_amount: params.discount,
        total: params.total,
      },
    })
  }

  /**
   * Send order confirmation email
   */
  static async sendOrderConfirmation(params: {
    vendorId: string
    orderId: string
    customerEmail: string
    customerName?: string
    orderNumber: string
    items: Array<{ name: string; quantity: number; price: string }>
    subtotal?: string
    tax?: string
    shipping?: string
    discount?: string
    total: string
    isPickup: boolean
    pickupLocation?: string
    estimatedTime?: string
    shippingName?: string
    shippingAddress?: string
    shopUrl?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'order_confirmation',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      data: {
        customer_name: params.customerName || 'Customer',
        order_number: params.orderNumber,
        items: params.items,
        subtotal: params.subtotal,
        tax_amount: params.tax,
        shipping_cost: params.shipping,
        discount_amount: params.discount,
        total: params.total,
        is_pickup: params.isPickup,
        pickup_location: params.pickupLocation,
        estimated_time: params.estimatedTime,
        shipping_name: params.shippingName,
        shipping_address: params.shippingAddress,
        shop_url: params.shopUrl || '#',
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
    pickupAddress?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'order_ready',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      data: {
        order_number: params.orderNumber,
        pickup_location: params.pickupLocation,
        pickup_address: params.pickupAddress,
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
    shippingAddress: string
    trackingNumber?: string
    trackingUrl?: string
    carrier?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'order_shipped',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      data: {
        customer_name: params.customerName,
        order_number: params.orderNumber,
        shipping_address: params.shippingAddress,
        tracking_number: params.trackingNumber,
        tracking_url: params.trackingUrl,
        carrier: params.carrier,
      },
    })
  }

  /**
   * Send welcome email
   */
  static async sendWelcome(params: {
    vendorId: string
    customerEmail: string
    customerName?: string
    shopUrl?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'welcome',
      vendorId: params.vendorId,
      customerId: params.customerId,
      data: {
        customer_name: params.customerName || 'there',
        shop_url: params.shopUrl || '#',
      },
    })
  }

  /**
   * Send password reset email
   */
  static async sendPasswordReset(params: {
    vendorId: string
    customerEmail: string
    customerName?: string
    resetUrl: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'password_reset',
      vendorId: params.vendorId,
      customerId: params.customerId,
      data: {
        customer_name: params.customerName || 'there',
        reset_url: params.resetUrl,
      },
    })
  }

  /**
   * Send loyalty points update
   */
  static async sendLoyaltyUpdate(params: {
    vendorId: string
    customerEmail: string
    customerName?: string
    action: 'earned' | 'redeemed'
    points: number
    totalPoints: number
    orderNumber?: string
    rewardsUrl?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'loyalty_update',
      vendorId: params.vendorId,
      customerId: params.customerId,
      data: {
        customer_name: params.customerName,
        action: params.action,
        points: params.points,
        total_points: params.totalPoints,
        order_number: params.orderNumber,
        rewards_url: params.rewardsUrl || '#',
      },
    })
  }

  /**
   * Send back in stock notification
   */
  static async sendBackInStock(params: {
    vendorId: string
    customerEmail: string
    customerName?: string
    productName: string
    productUrl: string
    productImage?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'back_in_stock',
      vendorId: params.vendorId,
      customerId: params.customerId,
      data: {
        customer_name: params.customerName,
        product_name: params.productName,
        product_url: params.productUrl,
        product_image: params.productImage,
      },
    })
  }

  /**
   * Send order status update
   */
  static async sendOrderStatusUpdate(params: {
    vendorId: string
    orderId: string
    customerEmail: string
    customerName?: string
    orderNumber: string
    statusTitle: string
    statusMessage: string
    supportEmail?: string
    trackingNumber?: string
    trackingUrl?: string
    carrier?: string
    pickupLocation?: string
    customerId?: string
  }): Promise<SendEmailResponse> {
    return this.send({
      to: params.customerEmail,
      toName: params.customerName,
      templateSlug: 'order_status_update',
      vendorId: params.vendorId,
      orderId: params.orderId,
      customerId: params.customerId,
      data: {
        order_number: params.orderNumber,
        status_title: params.statusTitle,
        status_message: params.statusMessage,
        support_email: params.supportEmail,
        tracking_number: params.trackingNumber,
        tracking_url: params.trackingUrl,
        carrier: params.carrier,
        pickup_location: params.pickupLocation,
      },
    })
  }

  /**
   * Send test email
   */
  static async sendTestEmail(params: {
    vendorId: string
    to: string
    templateSlug?: TemplateSlug
  }): Promise<SendEmailResponse> {
    const template = params.templateSlug || 'welcome'

    // Sample test data for each template type
    const testData: Record<TemplateSlug, Record<string, any>> = {
      receipt: {
        order_number: 'TEST-001',
        items: [
          { name: 'Sample Product 1', quantity: 2, price: '$39.99' },
          { name: 'Sample Product 2', quantity: 1, price: '$20.00' },
        ],
        subtotal: '$99.98',
        tax_amount: '$8.00',
        total: '$107.98',
      },
      order_confirmation: {
        customer_name: 'Test Customer',
        order_number: 'TEST-001',
        items: [
          { name: 'Sample Product', quantity: 1, price: '$49.99' },
        ],
        total: '$54.99',
        is_pickup: true,
        pickup_location: 'Main Store',
        estimated_time: '15 minutes',
        shop_url: '#',
      },
      order_ready: {
        order_number: 'TEST-001',
        pickup_location: 'Main Store',
        pickup_address: '123 Test Street',
      },
      order_shipped: {
        customer_name: 'Test Customer',
        order_number: 'TEST-001',
        shipping_address: '123 Test St, City, ST 12345',
        tracking_number: '1Z999AA10123456784',
        tracking_url: '#',
        carrier: 'UPS',
      },
      welcome: {
        customer_name: 'Test Customer',
        shop_url: '#',
      },
      password_reset: {
        customer_name: 'Test Customer',
        reset_url: '#',
      },
      loyalty_update: {
        customer_name: 'Test Customer',
        action: 'earned',
        points: 150,
        total_points: 1250,
        order_number: 'TEST-001',
        rewards_url: '#',
      },
      back_in_stock: {
        customer_name: 'Test Customer',
        product_name: 'Sample Product',
        product_url: '#',
      },
      order_status_update: {
        order_number: 'TEST-001',
        status_title: 'Order Update',
        status_message: 'This is a test status update.',
        support_email: 'support@example.com',
      },
    }

    return this.send({
      to: params.to,
      templateSlug: template,
      vendorId: params.vendorId,
      data: testData[template],
    })
  }

  // ============================================
  // VENDOR SETTINGS
  // ============================================

  /**
   * Get vendor email settings
   */
  static async getVendorSettings(vendorId: string): Promise<VendorEmailSettings | null> {
    const { data, error } = await supabase
      .from('vendor_email_settings')
      .select('*')
      .eq('vendor_id', vendorId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      logger.error('Error fetching vendor email settings', { error })
      return null
    }

    return data
  }

  /**
   * Update vendor email settings
   */
  static async updateVendorSettings(
    vendorId: string,
    settings: Partial<VendorEmailSettings>
  ): Promise<VendorEmailSettings | null> {
    const { data, error } = await supabase
      .from('vendor_email_settings')
      .upsert({ vendor_id: vendorId, ...settings }, { onConflict: 'vendor_id' })
      .select()
      .single()

    if (error) {
      logger.error('Error updating vendor email settings', { error })
      return null
    }

    return data
  }
}
