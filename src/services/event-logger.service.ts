/**
 * Event Logger Service - Apple Engineering Standard
 *
 * Centralized POS event logging for:
 * - Analytics
 * - Debugging
 * - AI observability
 * - Audit trails
 *
 * Events are structured and can be sent to multiple destinations:
 * - Console (dev mode)
 * - Sentry (error tracking)
 * - Analytics service (future)
 * - AI system (future observability)
 */

import { logger } from '@/utils/logger'
import { Sentry } from '@/utils/sentry'

// ========================================
// TYPES
// ========================================

export type EventCategory =
  | 'cart'
  | 'payment'
  | 'inventory'
  | 'customer'
  | 'loyalty'
  | 'session'
  | 'order'
  | 'product'
  | 'system'

export type EventAction =
  | 'add'
  | 'remove'
  | 'update'
  | 'create'
  | 'delete'
  | 'load'
  | 'refresh'
  | 'search'
  | 'cancel'
  | 'complete'
  | 'error'
  | 'start'
  | 'end'

export interface EventData {
  category: EventCategory
  action: EventAction
  label?: string
  value?: number
  metadata?: Record<string, any>
  userId?: string
  sessionId?: string
  locationId?: string
}

// ========================================
// EVENT LOGGER SERVICE
// ========================================

class EventLoggerService {
  /**
   * Log a POS event
   */
  logEvent(data: EventData): void {
    const eventName = `${data.category}:${data.action}`

    // Add to Sentry breadcrumb for error context
    Sentry.addBreadcrumb({
      category: data.category,
      message: data.label || eventName,
      level: 'info',
      data: {
        action: data.action,
        value: data.value,
        ...data.metadata,
      },
    })

    // Console log in dev mode
    if (__DEV__) {
      logger.info(`[Event] ${eventName}`, {
        label: data.label,
        value: data.value,
        metadata: data.metadata,
      })
    }

    // TODO: Send to analytics service (future)
    // analytics.track(eventName, data)

    // TODO: Send to AI observability (future)
    // aiObservability.log(data)
  }

  /**
   * Log cart events
   */
  cart = {
    addItem: (productId: string, quantity: number, metadata?: Record<string, any>) => {
      this.logEvent({
        category: 'cart',
        action: 'add',
        label: `Product ${productId}`,
        value: quantity,
        metadata,
      })
    },

    removeItem: (productId: string, metadata?: Record<string, any>) => {
      this.logEvent({
        category: 'cart',
        action: 'remove',
        label: `Product ${productId}`,
        metadata,
      })
    },

    updateQuantity: (productId: string, oldQty: number, newQty: number) => {
      this.logEvent({
        category: 'cart',
        action: 'update',
        label: `Product ${productId}`,
        value: newQty - oldQty,
        metadata: { oldQty, newQty },
      })
    },

    applyDiscount: (productId: string, discountAmount: number) => {
      this.logEvent({
        category: 'cart',
        action: 'update',
        label: `Discount applied to ${productId}`,
        value: discountAmount,
        metadata: { type: 'discount' },
      })
    },

    clear: () => {
      this.logEvent({
        category: 'cart',
        action: 'delete',
        label: 'Cart cleared',
      })
    },
  }

  /**
   * Log payment events
   */
  payment = {
    start: (amount: number, method: string, metadata?: Record<string, any>) => {
      this.logEvent({
        category: 'payment',
        action: 'start',
        label: `${method} payment`,
        value: amount,
        metadata,
      })
    },

    complete: (amount: number, method: string, transactionId?: string) => {
      this.logEvent({
        category: 'payment',
        action: 'complete',
        label: `${method} payment successful`,
        value: amount,
        metadata: { transactionId },
      })
    },

    error: (amount: number, method: string, errorMessage: string) => {
      this.logEvent({
        category: 'payment',
        action: 'error',
        label: `${method} payment failed`,
        value: amount,
        metadata: { errorMessage },
      })
    },

    cancel: (amount: number, method: string) => {
      this.logEvent({
        category: 'payment',
        action: 'cancel',
        label: `${method} payment cancelled`,
        value: amount,
      })
    },
  }

  /**
   * Log inventory events
   */
  inventory = {
    outOfStock: (productId: string, productName: string) => {
      this.logEvent({
        category: 'inventory',
        action: 'error',
        label: `Product out of stock: ${productName}`,
        metadata: { productId },
      })
    },

    lowStock: (productId: string, productName: string, quantity: number) => {
      this.logEvent({
        category: 'inventory',
        action: 'update',
        label: `Low stock: ${productName}`,
        value: quantity,
        metadata: { productId },
      })
    },

    load: (locationId: string, productCount: number) => {
      this.logEvent({
        category: 'inventory',
        action: 'load',
        label: `Loaded ${productCount} products`,
        value: productCount,
        metadata: { locationId },
      })
    },
  }

  /**
   * Log customer events
   */
  customer = {
    create: (customerId: string, metadata?: Record<string, any>) => {
      this.logEvent({
        category: 'customer',
        action: 'create',
        label: `Customer created`,
        metadata: { customerId, ...metadata },
      })
    },

    select: (customerId: string, customerName: string) => {
      this.logEvent({
        category: 'customer',
        action: 'update',
        label: `Customer selected: ${customerName}`,
        metadata: { customerId },
      })
    },

    search: (query: string, resultCount: number) => {
      this.logEvent({
        category: 'customer',
        action: 'search',
        label: `Search: "${query}"`,
        value: resultCount,
      })
    },
  }

  /**
   * Log loyalty events
   */
  loyalty = {
    earn: (customerId: string, points: number, orderTotal: number) => {
      this.logEvent({
        category: 'loyalty',
        action: 'add',
        label: `${points} points earned`,
        value: points,
        metadata: { customerId, orderTotal },
      })
    },

    redeem: (customerId: string, points: number, discountAmount: number) => {
      this.logEvent({
        category: 'loyalty',
        action: 'remove',
        label: `${points} points redeemed`,
        value: points,
        metadata: { customerId, discountAmount },
      })
    },
  }

  /**
   * Log session events
   */
  session = {
    start: (sessionId: string, locationId: string, registerId: string) => {
      this.logEvent({
        category: 'session',
        action: 'start',
        label: 'POS session started',
        metadata: { sessionId, locationId, registerId },
      })
    },

    end: (sessionId: string, saleCount: number, totalRevenue: number) => {
      this.logEvent({
        category: 'session',
        action: 'end',
        label: 'POS session ended',
        value: totalRevenue,
        metadata: { sessionId, saleCount },
      })
    },
  }

  /**
   * Log order events
   */
  order = {
    create: (orderId: string, total: number, itemCount: number) => {
      this.logEvent({
        category: 'order',
        action: 'create',
        label: `Order created: ${orderId}`,
        value: total,
        metadata: { orderId, itemCount },
      })
    },

    load: (orderCount: number, metadata?: Record<string, any>) => {
      this.logEvent({
        category: 'order',
        action: 'load',
        label: `Loaded ${orderCount} orders`,
        value: orderCount,
        metadata,
      })
    },

    updateStatus: (orderId: string, oldStatus: string, newStatus: string) => {
      this.logEvent({
        category: 'order',
        action: 'update',
        label: `Order ${orderId} status changed`,
        metadata: { orderId, oldStatus, newStatus },
      })
    },
  }

  /**
   * Log product events
   */
  product = {
    load: (productCount: number, locationId?: string) => {
      this.logEvent({
        category: 'product',
        action: 'load',
        label: `Loaded ${productCount} products`,
        value: productCount,
        metadata: { locationId },
      })
    },

    search: (query: string, resultCount: number) => {
      this.logEvent({
        category: 'product',
        action: 'search',
        label: `Search: "${query}"`,
        value: resultCount,
      })
    },
  }

  /**
   * Log system events
   */
  system = {
    error: (component: string, errorMessage: string, metadata?: Record<string, any>) => {
      this.logEvent({
        category: 'system',
        action: 'error',
        label: `${component}: ${errorMessage}`,
        metadata,
      })
    },

    requestCancelled: (operation: string, reason: string) => {
      this.logEvent({
        category: 'system',
        action: 'cancel',
        label: `${operation} cancelled`,
        metadata: { reason },
      })
    },
  }
}

// ========================================
// SINGLETON EXPORT
// ========================================

export const eventLogger = new EventLoggerService()
