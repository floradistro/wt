/**
 * Scanned Order Store - POS Pickup Order Scanning
 *
 * When a pickup order QR code is scanned at POS, this store holds the order
 * data and provides actions for fulfillment (mark ready, complete pickup, etc.)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

export interface ScannedOrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface ScannedOrder {
  id: string
  order_number: string
  status: string
  order_type: string
  customer_name: string | null
  customer_id: string | null
  subtotal: number
  tax_amount: number
  total: number
  items: ScannedOrderItem[]
  pickup_location_name: string | null
  created_at: string
  // Payment
  payment_status: string
  payment_method: string | null
  card_last_four: string | null
  // Loyalty
  loyalty_points_earned: number
  loyalty_points_redeemed: number
}

interface ScannedOrderState {
  // The currently scanned order
  scannedOrder: ScannedOrder | null

  // Loading states
  loading: boolean
  updating: boolean

  // Error state
  error: string | null

  // Actions
  loadOrder: (orderId: string) => Promise<boolean>
  advanceStatus: () => Promise<void>
  markReady: () => Promise<void>
  completePickup: () => Promise<void>
  clearScannedOrder: () => void
}

const initialState = {
  scannedOrder: null,
  loading: false,
  updating: false,
  error: null,
}

export const useScannedOrderStore = create<ScannedOrderState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Load order by ID (from QR code scan)
       * Returns true if order found, false otherwise
       */
      loadOrder: async (orderId: string) => {
        try {
          set({ loading: true, error: null }, false, 'scannedOrder/loadOrder')

          logger.info('[ScannedOrderStore] Loading order:', orderId)

          // Fetch order with customer info
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
              id,
              order_number,
              status,
              order_type,
              subtotal,
              tax_amount,
              total_amount,
              payment_status,
              payment_method,
              card_last_four,
              created_at,
              customer_id,
              customers (
                first_name,
                last_name,
                display_name
              ),
              locations:pickup_location_id (
                name
              )
            `)
            .eq('id', orderId)
            .single()

          if (orderError || !order) {
            logger.error('[ScannedOrderStore] Order not found:', orderError)
            set({ loading: false, error: 'Order not found' }, false, 'scannedOrder/loadOrder/notFound')
            return false
          }

          // Fetch order items
          const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('id, product_name, quantity, unit_price, line_total')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true })

          if (itemsError) {
            logger.error('[ScannedOrderStore] Failed to load items:', itemsError)
          }

          // Fetch loyalty transactions for this order
          let loyaltyEarned = 0
          let loyaltyRedeemed = 0

          if (order.customer_id) {
            const { data: loyaltyData } = await supabase
              .from('loyalty_transactions')
              .select('transaction_type, points')
              .eq('reference_type', 'order')
              .eq('reference_id', orderId)

            if (loyaltyData) {
              loyaltyEarned = loyaltyData.find(t => t.transaction_type === 'earned')?.points || 0
              loyaltyRedeemed = Math.abs(loyaltyData.find(t => t.transaction_type === 'spent')?.points || 0)
            }
          }

          // Build customer name
          const customer = order.customers as any
          const customerName = customer?.display_name ||
            (customer?.first_name && customer?.last_name
              ? `${customer.first_name} ${customer.last_name}`
              : null)

          // Get location name from joined data
          const location = order.locations as any
          const locationName = location?.name || null

          const scannedOrder: ScannedOrder = {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            order_type: order.order_type,
            customer_name: customerName,
            customer_id: order.customer_id,
            subtotal: order.subtotal,
            tax_amount: order.tax_amount,
            total: order.total_amount,
            items: items || [],
            pickup_location_name: locationName,
            created_at: order.created_at,
            payment_status: order.payment_status,
            payment_method: order.payment_method,
            card_last_four: order.card_last_four,
            loyalty_points_earned: loyaltyEarned,
            loyalty_points_redeemed: loyaltyRedeemed,
          }

          set({
            scannedOrder,
            loading: false,
            error: null
          }, false, 'scannedOrder/loadOrder/success')

          logger.info('[ScannedOrderStore] Order loaded:', scannedOrder.order_number)
          return true

        } catch (err) {
          logger.error('[ScannedOrderStore] Error loading order:', err)
          set({ loading: false, error: 'Failed to load order' }, false, 'scannedOrder/loadOrder/error')
          return false
        }
      },

      /**
       * Advance order to next status based on order type
       */
      advanceStatus: async () => {
        const { scannedOrder } = get()
        if (!scannedOrder) return

        try {
          set({ updating: true }, false, 'scannedOrder/advanceStatus')

          let nextStatus: string
          const { order_type, status } = scannedOrder

          switch (order_type.toLowerCase()) {
            case 'pickup':
              if (status === 'pending') nextStatus = 'preparing'
              else if (status === 'preparing') nextStatus = 'ready'
              else if (status === 'ready') nextStatus = 'completed'
              else nextStatus = 'completed'
              break

            case 'delivery':
              if (status === 'pending') nextStatus = 'preparing'
              else if (status === 'preparing') nextStatus = 'out_for_delivery'
              else if (status === 'out_for_delivery') nextStatus = 'completed'
              else nextStatus = 'completed'
              break

            case 'shipping':
              if (status === 'pending') nextStatus = 'preparing'
              else if (status === 'preparing') nextStatus = 'ready_to_ship'
              else if (status === 'ready_to_ship') nextStatus = 'shipped'
              else if (status === 'shipped') nextStatus = 'in_transit'
              else if (status === 'in_transit') nextStatus = 'delivered'
              else nextStatus = 'delivered'
              break

            default:
              nextStatus = 'completed'
          }

          const { error } = await supabase
            .from('orders')
            .update({ status: nextStatus })
            .eq('id', scannedOrder.id)

          if (error) throw error

          set({
            scannedOrder: { ...scannedOrder, status: nextStatus },
            updating: false
          }, false, 'scannedOrder/advanceStatus/success')

        } catch (err) {
          logger.error('[ScannedOrderStore] Error advancing status:', err)
          set({ updating: false }, false, 'scannedOrder/advanceStatus/error')
        }
      },

      /**
       * Mark pickup order as ready
       */
      markReady: async () => {
        const { scannedOrder } = get()
        if (!scannedOrder) return

        try {
          set({ updating: true }, false, 'scannedOrder/markReady')

          const { error } = await supabase
            .from('orders')
            .update({ status: 'ready' })
            .eq('id', scannedOrder.id)

          if (error) throw error

          set({
            scannedOrder: { ...scannedOrder, status: 'ready' },
            updating: false
          }, false, 'scannedOrder/markReady/success')

        } catch (err) {
          logger.error('[ScannedOrderStore] Error marking ready:', err)
          set({ updating: false }, false, 'scannedOrder/markReady/error')
        }
      },

      /**
       * Complete pickup (hand off to customer)
       */
      completePickup: async () => {
        const { scannedOrder } = get()
        if (!scannedOrder) return

        try {
          set({ updating: true }, false, 'scannedOrder/completePickup')

          const { error } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', scannedOrder.id)

          if (error) throw error

          set({
            scannedOrder: { ...scannedOrder, status: 'completed' },
            updating: false
          }, false, 'scannedOrder/completePickup/success')

        } catch (err) {
          logger.error('[ScannedOrderStore] Error completing pickup:', err)
          set({ updating: false }, false, 'scannedOrder/completePickup/error')
        }
      },

      /**
       * Clear scanned order (dismiss the card)
       */
      clearScannedOrder: () => {
        set(initialState, false, 'scannedOrder/clear')
      },
    }),
    { name: 'ScannedOrderStore' }
  )
)

// Selectors
export const useScannedOrder = () => useScannedOrderStore((state) => state.scannedOrder)
export const useScannedOrderLoading = () => useScannedOrderStore((state) => state.loading)
export const useScannedOrderUpdating = () => useScannedOrderStore((state) => state.updating)
export const useScannedOrderError = () => useScannedOrderStore((state) => state.error)

// Actions export
export const scannedOrderActions = {
  loadOrder: useScannedOrderStore.getState().loadOrder,
  advanceStatus: useScannedOrderStore.getState().advanceStatus,
  markReady: useScannedOrderStore.getState().markReady,
  completePickup: useScannedOrderStore.getState().completePickup,
  clearScannedOrder: useScannedOrderStore.getState().clearScannedOrder,
}
