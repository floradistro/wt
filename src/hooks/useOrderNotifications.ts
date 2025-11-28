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
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

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
 */
async function showOrderNotification(order: Order) {
  try {
    const orderTypeLabel = order.order_type === 'pickup' ? 'Store Pickup' : 'E-Commerce'
    const customerName = (order.metadata as any)?.customer_name || order.customer_name || 'Guest'

    // Fetch order items to show products
    const { data: orderItems, error } = await supabase
      .from('order_items')
      .select(`
        quantity,
        products (
          name
        )
      `)
      .eq('order_id', order.id)
      .limit(3) // Only show first 3 items

    let bodyText = customerName

    if (orderItems && orderItems.length > 0 && !error) {
      // Format: "Customer Name • 2x Blue Dream, 1x Girl Scout Cookies"
      const itemsList = orderItems
        .map((item: any) => `${item.quantity}x ${item.products?.name || 'Item'}`)
        .join(', ')

      bodyText = `${customerName} • ${itemsList}`

      // If there are more items, add indicator
      if (orderItems.length === 3) {
        const { count } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', order.id)

        if (count && count > 3) {
          bodyText += ` +${count - 3} more`
        }
      }
    }

    console.log('🔔 [OrderNotifications] Scheduling notification...')
    console.log('🔔 Title:', `New ${orderTypeLabel} Order`)
    console.log('🔔 Body:', bodyText)

    const result = await Notifications.scheduleNotificationAsync({
      content: {
        title: `New ${orderTypeLabel} Order`,
        body: bodyText,
        data: { orderId: order.id, orderType: order.order_type },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    })

    console.log('🔔 [OrderNotifications] ✅ Notification scheduled! ID:', result)

    logger.info('[OrderNotifications] Notification shown:', {
      orderId: order.id,
      orderType: order.order_type,
      customer: customerName,
      notificationId: result,
    })
  } catch (error) {
    console.error('🔔 [OrderNotifications] ❌ Failed to show notification:', error)
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
      console.log('🔔 [OrderNotifications] Notification tapped - navigating to order:', orderId)

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
      console.log('🔔 [OrderNotifications] No active POS session - notifications disabled')
      return
    }

    const locationId = session.locationId
    logger.info('[OrderNotifications] Setting up notifications for location:', locationId)
    console.log('🔔 [OrderNotifications] Setting up notifications for location:', locationId, session.locationName)

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
          })

          console.log('🔔 [OrderNotifications] ===== NEW ORDER DETECTED =====')
          console.log('🔔 Order ID:', newOrder.id)
          console.log('🔔 Order Type:', newOrder.order_type)
          console.log('🔔 Order Location:', newOrder.pickup_location_id)
          console.log('🔔 Session Location:', locationId)
          console.log('🔔 Customer:', (newOrder.metadata as any)?.customer_name || newOrder.customer_name || 'Guest')

          // Filter: Only pickup and shipping orders
          if (newOrder.order_type !== 'pickup' && newOrder.order_type !== 'shipping') {
            logger.info('[OrderNotifications] Skipping - not pickup/shipping order')
            console.log('🔔 [OrderNotifications] ❌ Skipping - not pickup/shipping order')
            return
          }

          // Filter: Only orders for current location
          if (newOrder.pickup_location_id !== locationId) {
            logger.info('[OrderNotifications] Skipping - different location')
            console.log('🔔 [OrderNotifications] ❌ Skipping - different location')
            return
          }

          console.log('🔔 [OrderNotifications] ✅ Showing notification!')

          // Show notification
          await showOrderNotification(newOrder)
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
