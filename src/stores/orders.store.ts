/**
 * Orders Store - Apple Engineering Standard
 *
 * Principle: Global state for orders eliminates prop drilling and enables real-time updates
 * Replaces: useOrders hook (local state)
 *
 * BULLETPROOF REAL-TIME ARCHITECTURE:
 * 1. Supabase real-time subscription (primary) - instant updates
 * 2. Granular insert/update/delete handling (no full refresh)
 * 3. Auto-reconnection on channel errors
 * 4. AppState listener - reconnect when app foregrounds
 * 5. Heartbeat polling fallback (every 30s) - catches missed events
 * 6. Connection state tracking for UI feedback
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
import { AppState, type AppStateStatus } from 'react-native'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { ordersService, type Order } from '@/services/orders.service'
import { logger } from '@/utils/logger'

// Connection states for UI feedback
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

interface OrdersState {
  // Data
  orders: Order[]

  // Loading states
  loading: boolean
  error: Error | null
  currentController: AbortController | null

  // Real-time subscription
  realtimeChannel: RealtimeChannel | null
  connectionState: ConnectionState
  lastSyncAt: number | null

  // Heartbeat fallback
  heartbeatInterval: ReturnType<typeof setInterval> | null
  appStateSubscription: { remove: () => void } | null

  // Actions
  loadOrders: (options?: LoadOrdersOptions) => Promise<void>
  refreshOrders: () => Promise<void>
  silentRefresh: () => Promise<void>  // For heartbeat - no loading state
  getOrderById: (id: string) => Order | undefined
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>
  updatePaymentStatus: (orderId: string, status: Order['payment_status']) => Promise<void>
  cancelLoadOrders: () => void

  // Real-time subscriptions (bulletproof)
  subscribeToOrders: () => void
  unsubscribe: () => void

  // Internal: granular updates
  _handleInsert: (order: Order) => void
  _handleUpdate: (order: Order) => void
  _handleDelete: (orderId: string) => void
  _startHeartbeat: () => void
  _stopHeartbeat: () => void
  _handleAppStateChange: (state: AppStateStatus) => void

  // Reset
  reset: () => void
}

interface LoadOrdersOptions {
  limit?: number
  status?: string
  customerId?: string
  locationIds?: string[]
}

// Heartbeat interval (30 seconds) - catches any missed real-time events
const HEARTBEAT_INTERVAL = 30000

// Retry configuration for realtime subscriptions
const MAX_RETRY_ATTEMPTS = 3
const INITIAL_RETRY_DELAY = 5000 // 5 seconds
const realtimeRetryCount = 0

const initialState = {
  orders: [],
  loading: false,
  error: null,
  currentController: null,
  realtimeChannel: null,
  connectionState: 'disconnected' as ConnectionState,
  lastSyncAt: null,
  heartbeatInterval: null,
  appStateSubscription: null,
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
       * Shows loading state - used by pull-to-refresh
       * CRITICAL: No limit - orders must NEVER disappear
       */
      refreshOrders: async () => {
        try {
          set({ loading: true }, false, 'orders/refreshOrders/start')
          logger.info('[OrdersStore] Refreshing orders (with loading)')

          const orders = await ordersService.getOrders({})

          set({
            orders,
            loading: false,
            lastSyncAt: Date.now(),
            error: null,
          }, false, 'orders/refreshOrders')
        } catch (err) {
          logger.error('[OrdersStore] Failed to refresh orders:', err)
          set({ error: err as Error, loading: false }, false, 'orders/refreshOrders/error')
        }
      },

      /**
       * Silent refresh - no loading state
       * Used by heartbeat polling to avoid UI flicker
       * CRITICAL: No limit - orders must NEVER disappear
       */
      silentRefresh: async () => {
        try {
          logger.debug('[OrdersStore] Silent refresh (heartbeat)')

          const orders = await ordersService.getOrders({})

          set({
            orders,
            lastSyncAt: Date.now(),
          }, false, 'orders/silentRefresh')
        } catch (err) {
          logger.error('[OrdersStore] Silent refresh failed:', err)
          // Don't set error state for silent refresh - just log it
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

      // ============================================
      // GRANULAR REAL-TIME HANDLERS
      // ============================================

      /**
       * Handle INSERT - add new order to top of list
       * Note: Real-time payload doesn't include joined data (customer_name, etc.)
       * We trigger a silent refresh to get the full data
       */
      _handleInsert: (order: Order) => {
        logger.info('[OrdersStore] Real-time INSERT:', order.id)
        // For inserts, we need to fetch full data to get customer info
        // Add optimistically first, then refresh
        set(
          (state) => ({
            orders: [order, ...state.orders.filter(o => o.id !== order.id)],
            lastSyncAt: Date.now(),
          }),
          false,
          'orders/realtime/insert'
        )
        // Trigger silent refresh to get full order data with joins
        get().silentRefresh()
      },

      /**
       * Handle UPDATE - update existing order in place
       * IMPORTANT: Preserve computed/joined fields (customer_name, etc.) that
       * aren't included in real-time payloads
       */
      _handleUpdate: (order: Order) => {
        logger.info('[OrdersStore] Real-time UPDATE:', order.id)
        set(
          (state) => ({
            orders: state.orders.map(o => {
              if (o.id !== order.id) return o
              // Merge: use new data but preserve computed fields if missing
              return {
                ...o,  // Existing data (includes customer_name, etc.)
                ...order,  // New real-time data
                // Preserve these computed/joined fields from existing data
                customer_name: order.customer_name || o.customer_name,
                customer_email: order.customer_email || o.customer_email,
                customer_phone: order.customer_phone || o.customer_phone,
                pickup_location_name: order.pickup_location_name || o.pickup_location_name,
                fulfillment_locations: order.fulfillment_locations || o.fulfillment_locations,
                location_count: order.location_count ?? o.location_count,
              }
            }),
            lastSyncAt: Date.now(),
          }),
          false,
          'orders/realtime/update'
        )
      },

      /**
       * Handle DELETE - remove order from list
       */
      _handleDelete: (orderId: string) => {
        logger.info('[OrdersStore] Real-time DELETE:', orderId)
        set(
          (state) => ({
            orders: state.orders.filter(o => o.id !== orderId),
            lastSyncAt: Date.now(),
          }),
          false,
          'orders/realtime/delete'
        )
      },

      // ============================================
      // HEARTBEAT FALLBACK (catches missed events)
      // ============================================

      /**
       * Start heartbeat polling as fallback
       * Runs every 30s to catch any missed real-time events
       */
      _startHeartbeat: () => {
        // Stop existing heartbeat first
        get()._stopHeartbeat()

        logger.info('[OrdersStore] Starting heartbeat polling (30s)')

        const interval = setInterval(() => {
          logger.debug('[OrdersStore] Heartbeat tick')
          get().silentRefresh()
        }, HEARTBEAT_INTERVAL)

        set({ heartbeatInterval: interval }, false, 'orders/startHeartbeat')
      },

      /**
       * Stop heartbeat polling
       */
      _stopHeartbeat: () => {
        const { heartbeatInterval } = get()
        if (heartbeatInterval) {
          logger.debug('[OrdersStore] Stopping heartbeat')
          clearInterval(heartbeatInterval)
          set({ heartbeatInterval: null }, false, 'orders/stopHeartbeat')
        }
      },

      /**
       * Handle app state changes (foreground/background)
       * Reconnect when app comes to foreground
       */
      _handleAppStateChange: (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          logger.info('[OrdersStore] App foregrounded - refreshing and reconnecting')

          // Immediate refresh when foregrounding
          get().silentRefresh()

          // Reconnect real-time if disconnected
          const { connectionState } = get()
          if (connectionState !== 'connected') {
            logger.info('[OrdersStore] Reconnecting real-time after foreground')
            get().subscribeToOrders()
          }
        }
      },

      // ============================================
      // BULLETPROOF REAL-TIME SUBSCRIPTION
      // ============================================

      /**
       * Subscribe to real-time order updates
       * BULLETPROOF: granular updates, auto-reconnect, heartbeat fallback
       */
      subscribeToOrders: () => {
        // Unsubscribe from existing channel first
        const { realtimeChannel, appStateSubscription } = get()
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel)
        }

        set({ connectionState: 'connecting' }, false, 'orders/connecting')
        logger.info('[OrdersStore] Subscribing to real-time order updates (bulletproof)')

        const channel = supabase
          .channel('orders-changes', {
            config: {
              presence: { key: 'orders' },
            },
          })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'orders',
            },
            (payload) => {
              get()._handleInsert(payload.new as Order)
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'orders',
            },
            (payload) => {
              get()._handleUpdate(payload.new as Order)
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'orders',
            },
            (payload) => {
              get()._handleDelete((payload.old as { id: string }).id)
            }
          )
          .subscribe((status, err) => {
            logger.info('[OrdersStore] Subscription status:', status)

            if (status === 'SUBSCRIBED') {
              set({ connectionState: 'connected' }, false, 'orders/connected')
              logger.info('[OrdersStore] ✅ Real-time connected')
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              logger.error('[OrdersStore] ❌ Real-time error:', err)
              set({ connectionState: 'reconnecting' }, false, 'orders/reconnecting')

              // Auto-retry after 5 seconds
              setTimeout(() => {
                logger.info('[OrdersStore] Attempting reconnection...')
                get().subscribeToOrders()
              }, 5000)
            } else if (status === 'CLOSED') {
              set({ connectionState: 'disconnected' }, false, 'orders/disconnected')
            }
          })

        // Start heartbeat fallback
        get()._startHeartbeat()

        // Listen for app foreground/background
        if (!appStateSubscription) {
          const subscription = AppState.addEventListener('change', get()._handleAppStateChange)
          set({ appStateSubscription: subscription }, false, 'orders/appStateListener')
        }

        set({ realtimeChannel: channel }, false, 'orders/subscribeToOrders')
      },

      /**
       * Unsubscribe from real-time updates (cleanup)
       */
      unsubscribe: () => {
        const { realtimeChannel, appStateSubscription } = get()

        // Stop heartbeat
        get()._stopHeartbeat()

        // Remove app state listener
        if (appStateSubscription) {
          appStateSubscription.remove()
          set({ appStateSubscription: null }, false, 'orders/removeAppStateListener')
        }

        // Remove channel
        if (realtimeChannel) {
          logger.info('[OrdersStore] Unsubscribing from real-time updates')
          supabase.removeChannel(realtimeChannel)
          set({
            realtimeChannel: null,
            connectionState: 'disconnected',
          }, false, 'orders/unsubscribe')
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

// Get connection state (for UI indicators)
export const useConnectionState = () => useOrdersStore((state) => state.connectionState)

// Get last sync timestamp
export const useLastSyncAt = () => useOrdersStore((state) => state.lastSyncAt)

// Get orders actions (with useShallow to prevent infinite loops)
export const useOrdersActions = () => useOrdersStore(
  useShallow((state) => ({
    loadOrders: state.loadOrders,
    refreshOrders: state.refreshOrders,
    silentRefresh: state.silentRefresh,
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
    connectionState: state.connectionState,
    lastSyncAt: state.lastSyncAt,
  }))
)
