/**
 * useOrderNotifications Hook
 *
 * Provides native notifications for new pickup and e-commerce orders
 * BULLETPROOF: Only notifies when user is in an active POS session
 * This ensures we know which location to filter notifications for
 *
 * Usage:
 * - Call this hook in the Orders screen or app root
 * - Automatically requests notification permissions
 * - Subscribes to realtime order changes
 * - Shows notifications for matching orders only
 */

import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useOrdersUIActions } from '@/stores/orders-ui.store'
import type { Order } from '@/services/orders.service'

// Global navigation callback for notification handling
let navigateToOrders: ((tabIndex: number) => void) | null = null

export function setNotificationNavigator(callback: (tabIndex: number) => void) {
  navigateToOrders = callback
}

export function clearNotificationNavigator() {
  navigateToOrders = null
}

// Configure notification handler
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
} catch (error) {
  logger.error('[OrderNotifications] Failed to set notification handler:', error)
}

/**
 * Request notification permissions
 */
async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      logger.warn('[OrderNotifications] Notification permissions not granted')
      return false
    }

    // Set notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0a84ff',
      })
    }

    logger.info('[OrderNotifications] Notification permissions granted')
    return true
  } catch (error) {
    logger.error('[OrderNotifications] Failed to request permissions:', error)
    return false
  }
}

/**
 * Show notification for new order
 * For split orders, only shows items relevant to the specified location
 */
async function showOrderNotification(
  order: Order,
  locationId: string,
  fulfillmentType: 'pickup' | 'shipping' | 'mixed'
) {
  try {
    // Determine notification title based on what this location needs to do
    let orderTypeLabel: string
    if (fulfillmentType === 'pickup') {
      orderTypeLabel = 'Store Pickup'
    } else if (fulfillmentType === 'shipping') {
      orderTypeLabel = 'Ship From Store'
    } else {
      orderTypeLabel = 'Split Order' // Both pickup and shipping at this location
    }

    const customerName = (order.metadata as any)?.customer_name || order.customer_name || 'Guest'

    // Fetch order items ONLY for this location
    const { data: orderItems, error } = await supabase
      .from('order_items')
      .select(`
        quantity,
        order_type,
        products (
          name
        )
      `)
      .eq('order_id', order.id)
      .eq('location_id', locationId)
      .limit(3) // Only show first 3 items

    let bodyText = customerName

    if (orderItems && orderItems.length > 0 && !error) {
      // Format: "Customer Name • 2x Blue Dream, 1x Girl Scout Cookies"
      const itemsList = orderItems
        .map((item: any) => `${item.quantity}x ${item.products?.name || 'Item'}`)
        .join(', ')

      bodyText = `${customerName} • ${itemsList}`

      // If there are more items at this location, add indicator
      if (orderItems.length === 3) {
        const { count } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', order.id)
          .eq('location_id', locationId)

        if (count && count > 3) {
          bodyText += ` +${count - 3} more`
        }
      }
    }

    logger.debug('[OrderNotifications] Scheduling notification...', {
      title: `New ${orderTypeLabel} Order`,
      body: bodyText,
      fulfillmentType,
    })

    const result = await Notifications.scheduleNotificationAsync({
      content: {
        title: `New ${orderTypeLabel} Order`,
        body: bodyText,
        data: { orderId: order.id, orderType: order.order_type, fulfillmentType },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    })

    logger.info('[OrderNotifications] Notification scheduled:', {
      orderId: order.id,
      orderType: order.order_type,
      fulfillmentType,
      customer: customerName,
      notificationId: result,
    })
  } catch (error) {
    logger.error('[OrderNotifications] Failed to show notification:', error)
  }
}

/**
 * Hook to enable order notifications
 * Only shows notifications when user is in an active POS session
 */
export function useOrderNotifications() {
  const { session } = usePOSSession()
  const { setActiveNavWithOrder } = useOrdersUIActions()
  const permissionsRequestedRef = useRef(false)

  useEffect(() => {
    // Only request permissions once
    if (!permissionsRequestedRef.current) {
      permissionsRequestedRef.current = true
      requestNotificationPermissions()
    }
  }, [])

  // Handle notification tap - navigate to order detail
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const orderId = response.notification.request.content.data.orderId as string
      const orderType = response.notification.request.content.data.orderType as string

      logger.info('[OrderNotifications] Notification tapped:', { orderId, orderType })

      // Navigate to Orders screen (tab index 2)
      if (navigateToOrders) {
        navigateToOrders(2) // Orders is at index 2 in DashboardNavigator
      }

      // Set active nav and select order atomically
      const navSection = orderType === 'pickup' ? 'pickup' : 'ecommerce'
      setActiveNavWithOrder(navSection, orderId)
    })

    return () => {
      subscription.remove()
    }
  }, [setActiveNavWithOrder])

  useEffect(() => {
    // Only subscribe if user has active POS session
    if (!session?.locationId) {
      logger.info('[OrderNotifications] No active POS session - notifications disabled')
      return
    }

    const locationId = session.locationId
    logger.info('[OrderNotifications] Setting up notifications for location:', { locationId, locationName: session.locationName })

    // Subscribe to realtime order inserts
    const channel = supabase
      .channel('order-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // Only new orders
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          const newOrder = payload.new as Order

          logger.info('[OrderNotifications] New order detected:', {
            orderId: newOrder.id,
            orderType: newOrder.order_type,
            orderLocation: newOrder.pickup_location_id,
            sessionLocation: locationId,
            customer: (newOrder.metadata as any)?.customer_name || newOrder.customer_name || 'Guest',
          })

          // Filter: Only pickup and shipping orders
          if (newOrder.order_type !== 'pickup' && newOrder.order_type !== 'shipping') {
            logger.debug('[OrderNotifications] Skipping - not pickup/shipping order')
            return
          }

          // ========================================================================
          // MULTI-LOCATION CHECK: Does THIS location have items to fulfill?
          // For split orders, items may be routed to different locations
          // ========================================================================

          // Small delay to ensure order_items have been created by smart routing
          await new Promise(resolve => setTimeout(resolve, 500))

          // Check if this location has any items to fulfill
          const { data: locationItems, error: itemsError } = await supabase
            .from('order_items')
            .select('id, order_type')
            .eq('order_id', newOrder.id)
            .eq('location_id', locationId)

          if (itemsError) {
            logger.error('[OrderNotifications] Error checking location items:', itemsError)
            return
          }

          if (!locationItems || locationItems.length === 0) {
            // No items at this location - check if maybe it's the primary pickup location
            // (for backwards compatibility with orders that don't have location_id on items)
            if (newOrder.pickup_location_id === locationId) {
              logger.debug('[OrderNotifications] Primary pickup location match (legacy)')
              const fulfillmentType = newOrder.order_type === 'pickup' ? 'pickup' : 'shipping'
              await showOrderNotification(newOrder, locationId, fulfillmentType)
              return
            }

            logger.debug('[OrderNotifications] Skipping - no items at this location')
            return
          }

          // Determine what type of fulfillment this location needs to do
          const hasPickup = locationItems.some(item => item.order_type === 'pickup')
          const hasShipping = locationItems.some(item => item.order_type === 'shipping')

          let fulfillmentType: 'pickup' | 'shipping' | 'mixed'
          if (hasPickup && hasShipping) {
            fulfillmentType = 'mixed'
          } else if (hasPickup) {
            fulfillmentType = 'pickup'
          } else {
            fulfillmentType = 'shipping'
          }

          logger.debug('[OrderNotifications] Location has items to fulfill:', {
            itemCount: locationItems.length,
            fulfillmentType,
          })

          // Show notification with location-specific info
          await showOrderNotification(newOrder, locationId, fulfillmentType)
        }
      )
      .subscribe()

    // Cleanup on unmount or session change
    return () => {
      logger.info('[OrderNotifications] Cleaning up notifications subscription')
      supabase.removeChannel(channel)
    }
  }, [session?.locationId])
}
