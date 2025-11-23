/**
 * Orders Store - Apple Engineering Standard
 *
 * Principle: Global state for orders eliminates prop drilling and enables real-time updates
 * Replaces: useOrders hook (local state)
 *
 * Benefits:
 * - Zero prop drilling
 * - Orders accessible anywhere in app
 * - Real-time Supabase subscriptions
 * - Redux DevTools time-travel debugging
 * - Vendor info from AppAuthContext (not duplicated)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { ordersService, type Order } from '@/services/orders.service'
import { logger } from '@/utils/logger'

interface OrdersState {
  // Data
  orders: Order[]

  // Loading states
  loading: boolean
  error: Error | null
  currentController: AbortController | null

  // Real-time subscription
  realtimeChannel: RealtimeChannel | null

  // Actions
  loadOrders: (options?: LoadOrdersOptions) => Promise<void>
  refreshOrders: () => Promise<void>
  getOrderById: (id: string) => Order | undefined
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>
  updatePaymentStatus: (orderId: string, status: Order['payment_status']) => Promise<void>
  cancelLoadOrders: () => void

  // Real-time subscriptions
  subscribeToOrders: () => void
  unsubscribe: () => void

  // Reset
  reset: () => void
}

interface LoadOrdersOptions {
  limit?: number
  status?: string
  customerId?: string
  locationIds?: string[]
}

const initialState = {
  orders: [],
  loading: false,
  error: null,
  currentController: null,
  realtimeChannel: null,
}

export const useOrdersStore = create<OrdersState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Cancel any in-flight order loading request
       */
      cancelLoadOrders: () => {
        const { currentController } = get()
        if (currentController) {
          logger.debug('[OrdersStore] Aborting previous request')
          currentController.abort()
          set({ currentController: null })
        }
      },

      /**
       * Load orders with optional filters
       * Note: Vendor is obtained from AppAuthContext in the component, not stored here
       */
      loadOrders: async (options?: LoadOrdersOptions) => {
        // Cancel any previous request
        get().cancelLoadOrders()

        // Create new AbortController for this request
        const controller = new AbortController()

        try {
          set({ loading: true, error: null, currentController: controller }, false, 'orders/loadOrders')

          logger.info('[OrdersStore] Loading orders:', options)

          const orders = await ordersService.getOrders(options)

          // Check if request was aborted
          if (controller.signal.aborted) {
            logger.debug('[OrdersStore] Request was aborted (expected)')
            return
          }

          logger.info('[OrdersStore] Orders loaded:', orders.length)

          set({ orders, loading: false, currentController: null }, false, 'orders/loadOrders/success')
        } catch (err) {
          // Don't set error state if request was just aborted
          if (err instanceof Error && err.name === 'AbortError') {
            logger.debug('[OrdersStore] Request aborted (expected)')
            return
          }

          logger.error('[OrdersStore] Failed to load orders:', err)
          set(
            {
              error: err as Error,
              loading: false,
              currentController: null,
            },
            false,
            'orders/loadOrders/error'
          )
        }
      },

      /**
       * Refresh orders (reload with current filters)
       * Used by real-time subscriptions
       */
      refreshOrders: async () => {
        try {
          logger.info('[OrdersStore] Refreshing orders')

          const orders = await ordersService.getOrders({ limit: 500 })

          set({ orders }, false, 'orders/refreshOrders')
        } catch (err) {
          logger.error('[OrdersStore] Failed to refresh orders:', err)
          set({ error: err as Error }, false, 'orders/refreshOrders/error')
        }
      },

      /**
       * Get order by ID from current store state
       */
      getOrderById: (id: string) => {
        return get().orders.find(order => order.id === id)
      },

      /**
       * Update order status
       */
      updateOrderStatus: async (orderId: string, status: Order['status']) => {
        try {
          logger.info('[OrdersStore] Updating order status:', { orderId, status })

          await ordersService.updateOrderStatus(orderId, status)

          // Optimistically update local state
          set(
            (state) => ({
              orders: state.orders.map(order =>
                order.id === orderId ? { ...order, status } : order
              ),
            }),
            false,
            'orders/updateOrderStatus'
          )

          logger.info('[OrdersStore] Order status updated successfully')
        } catch (err) {
          logger.error('[OrdersStore] Failed to update order status:', err)

          // Refresh to get correct state from server
          await get().refreshOrders()

          throw err
        }
      },

      /**
       * Update payment status
       */
      updatePaymentStatus: async (orderId: string, paymentStatus: Order['payment_status']) => {
        try {
          logger.info('[OrdersStore] Updating payment status:', { orderId, paymentStatus })

          await ordersService.updatePaymentStatus(orderId, paymentStatus)

          // Optimistically update local state
          set(
            (state) => ({
              orders: state.orders.map(order =>
                order.id === orderId ? { ...order, payment_status: paymentStatus } : order
              ),
            }),
            false,
            'orders/updatePaymentStatus'
          )

          logger.info('[OrdersStore] Payment status updated successfully')
        } catch (err) {
          logger.error('[OrdersStore] Failed to update payment status:', err)

          // Refresh to get correct state from server
          await get().refreshOrders()

          throw err
        }
      },

      /**
       * Subscribe to real-time order updates
       * Auto-refreshes when any order changes
       */
      subscribeToOrders: () => {
        // Unsubscribe from existing channel first
        const { realtimeChannel } = get()
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel)
        }

        logger.info('[OrdersStore] Subscribing to real-time order updates')

        const channel = supabase
          .channel('orders-changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'orders',
            },
            (payload) => {
              logger.info('[OrdersStore] Real-time order change:', payload.eventType)

              // Refresh orders on any change
              get().refreshOrders()
            }
          )
          .subscribe()

        set({ realtimeChannel: channel }, false, 'orders/subscribeToOrders')
      },

      /**
       * Unsubscribe from real-time updates
       */
      unsubscribe: () => {
        const { realtimeChannel } = get()
        if (realtimeChannel) {
          logger.info('[OrdersStore] Unsubscribing from real-time updates')
          supabase.removeChannel(realtimeChannel)
          set({ realtimeChannel: null }, false, 'orders/unsubscribe')
        }
      },

      /**
       * Reset entire orders state (for logout or cleanup)
       */
      reset: () => {
        // Cancel any in-flight requests
        get().cancelLoadOrders()

        // Unsubscribe from real-time first
        get().unsubscribe()

        logger.info('[OrdersStore] Resetting state')
        set(initialState, false, 'orders/reset')
      },
    }),
    { name: 'OrdersStore' } // Redux DevTools name
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get all orders
export const useOrders = () => useOrdersStore((state) => state.orders)

// Get loading state
export const useOrdersLoading = () => useOrdersStore((state) => state.loading)

// Get error state
export const useOrdersError = () => useOrdersStore((state) => state.error)

// Get orders actions (with useShallow to prevent infinite loops)
export const useOrdersActions = () => useOrdersStore(
  useShallow((state) => ({
    loadOrders: state.loadOrders,
    refreshOrders: state.refreshOrders,
    getOrderById: state.getOrderById,
    updateOrderStatus: state.updateOrderStatus,
    updatePaymentStatus: state.updatePaymentStatus,
    subscribeToOrders: state.subscribeToOrders,
    unsubscribe: state.unsubscribe,
    reset: state.reset,
  }))
)

// Get full state (for debugging or components that need everything)
export const useOrdersState = () => useOrdersStore(
  useShallow((state) => ({
    orders: state.orders,
    loading: state.loading,
    error: state.error,
  }))
)
