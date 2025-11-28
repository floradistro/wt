/**
 * Order Detail Store - Apple Engineering Standard
 *
 * Principle: Manages detail panel state and lazy-loaded order data
 * Replaces: Local state and props in OrderDetail component
 *
 * Benefits:
 * - Zero prop drilling
 * - Lazy loading only when order selected
 * - Real-time subscription to current order
 * - Redux DevTools visibility
 * - Clean separation: detail data vs UI state
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { ordersService, type Order } from '@/services/orders.service'
import { logger } from '@/utils/logger'

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

interface TaxDetail {
  name: string
  amount: number
  rate?: number
}

interface OrderDetailState {
  // Current order detail data
  currentOrderId: string | null
  orderItems: OrderItem[]
  loyaltyPointsEarned: number
  loyaltyPointsRedeemed: number
  taxDetails: TaxDetail[]

  // Loading states
  loading: boolean
  isUpdating: boolean

  // Success feedback
  showSuccess: boolean
  successMessage: string

  // Modals
  showNotesModal: boolean
  showLabelModal: boolean

  // Form state
  staffNotes: string
  trackingNumber: string
  shippingCost: string

  // Real-time subscription
  realtimeChannel: RealtimeChannel | null

  // Actions - Data loading
  loadOrderDetails: (orderId: string) => Promise<void>
  loadOrderItems: (orderId: string) => Promise<void>
  loadLoyaltyData: (orderId: string, customerId: string) => Promise<void>
  loadTaxDetails: (orderId: string, locationId: string) => Promise<void>

  // Actions - Updates
  updateNotes: (orderId: string, notes: string) => Promise<void>
  updateShippingLabel: (orderId: string, tracking: string, cost?: number) => Promise<void>
  advanceStatus: (orderId: string, orderType: string, currentStatus: string) => Promise<void>

  // Actions - Modals
  openNotesModal: (notes: string) => void
  closeNotesModal: () => void
  openLabelModal: (tracking: string, cost: string) => void
  closeLabelModal: () => void

  // Actions - Form
  setStaffNotes: (notes: string) => void
  setTrackingNumber: (tracking: string) => void
  setShippingCost: (cost: string) => void

  // Actions - Success feedback
  showSuccessOverlay: (message: string) => void
  hideSuccessOverlay: () => void

  // Real-time subscriptions
  subscribeToOrder: (orderId: string) => void
  unsubscribe: () => void

  // Reset
  reset: () => void
}

const initialState = {
  currentOrderId: null,
  orderItems: [],
  loyaltyPointsEarned: 0,
  loyaltyPointsRedeemed: 0,
  taxDetails: [],
  loading: false,
  isUpdating: false,
  showSuccess: false,
  successMessage: '',
  showNotesModal: false,
  showLabelModal: false,
  staffNotes: '',
  trackingNumber: '',
  shippingCost: '',
  realtimeChannel: null,
}

export const useOrderDetailStore = create<OrderDetailState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Load complete order details (items, loyalty, tax)
       * Called when an order is selected
       */
      loadOrderDetails: async (orderId: string) => {
        try {
          set({ loading: true, currentOrderId: orderId }, false, 'orderDetail/loadOrderDetails')

          logger.info('[OrderDetailStore] Loading order details:', orderId)

          // Load order items
          await get().loadOrderItems(orderId)

          // Get order from orders store to access customer_id and location
          const { data: order } = await supabase
            .from('orders')
            .select('customer_id, pickup_location_id')
            .eq('id', orderId)
            .single()

          if (order) {
            // Load loyalty data if customer exists
            if (order.customer_id) {
              await get().loadLoyaltyData(orderId, order.customer_id)
            }

            // Load tax details if location exists
            if (order.pickup_location_id) {
              await get().loadTaxDetails(orderId, order.pickup_location_id)
            }
          }

          // Subscribe to real-time updates for this order
          get().subscribeToOrder(orderId)

          set({ loading: false }, false, 'orderDetail/loadOrderDetails/success')
        } catch (err) {
          logger.error('[OrderDetailStore] Failed to load order details:', err)
          set({ loading: false }, false, 'orderDetail/loadOrderDetails/error')
        }
      },

      /**
       * Load order items
       */
      loadOrderItems: async (orderId: string) => {
        try {
          const { data: items, error } = await supabase
            .from('order_items')
            .select('id, product_name, quantity, unit_price, line_total')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true })

          if (error) throw error

          set({ orderItems: items || [] }, false, 'orderDetail/loadOrderItems')
        } catch (err) {
          logger.error('[OrderDetailStore] Failed to load order items:', err)
        }
      },

      /**
       * Load loyalty points earned/redeemed
       */
      loadLoyaltyData: async (orderId: string, customerId: string) => {
        try {
          const { data: loyaltyData, error } = await supabase
            .from('loyalty_transactions')
            .select('transaction_type, points')
            .eq('reference_type', 'order')
            .eq('reference_id', orderId)

          if (error) throw error

          if (loyaltyData) {
            const earned = loyaltyData.find(t => t.transaction_type === 'earned')?.points || 0
            const spent = Math.abs(loyaltyData.find(t => t.transaction_type === 'spent')?.points || 0)

            set({
              loyaltyPointsEarned: earned,
              loyaltyPointsRedeemed: spent
            }, false, 'orderDetail/loadLoyaltyData')
          }
        } catch (err) {
          logger.error('[OrderDetailStore] Failed to load loyalty data:', err)
        }
      },

      /**
       * Load tax details from order
       * Note: Tax rate is calculated as (tax_amount / subtotal) and stored as decimal (e.g., 0.0675 for 6.75%)
       */
      loadTaxDetails: async (orderId: string, locationId: string) => {
        try {
          // Get tax amount from order
          const { data: order, error } = await supabase
            .from('orders')
            .select('tax_amount, subtotal')
            .eq('id', orderId)
            .single()

          if (error) throw error

          if (order) {
            // Calculate tax rate from order data as decimal (0.0675 for 6.75%)
            const taxRate = order.subtotal > 0 ? (order.tax_amount / order.subtotal) : 0

            set({
              taxDetails: [{
                name: 'Sales Tax',
                amount: order.tax_amount || 0,
                rate: taxRate
              }]
            }, false, 'orderDetail/loadTaxDetails')
          }
        } catch (err) {
          logger.error('[OrderDetailStore] Failed to load tax details:', err)
        }
      },

      /**
       * Update staff notes
       */
      updateNotes: async (orderId: string, notes: string) => {
        try {
          set({ isUpdating: true }, false, 'orderDetail/updateNotes')

          const { error } = await supabase
            .from('orders')
            .update({ staff_notes: notes })
            .eq('id', orderId)

          if (error) throw error

          set({
            staffNotes: notes,
            isUpdating: false,
            showNotesModal: false
          }, false, 'orderDetail/updateNotes/success')

          get().showSuccessOverlay('Notes updated')
        } catch (err) {
          logger.error('[OrderDetailStore] Failed to update notes:', err)
          set({ isUpdating: false }, false, 'orderDetail/updateNotes/error')
          throw err
        }
      },

      /**
       * Update shipping label (tracking + cost)
       */
      updateShippingLabel: async (orderId: string, tracking: string, cost?: number) => {
        try {
          set({ isUpdating: true }, false, 'orderDetail/updateShippingLabel')

          const updates: any = { tracking_number: tracking }
          if (cost !== undefined) {
            updates.shipping_cost = cost
          }

          const { error } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', orderId)

          if (error) throw error

          set({
            trackingNumber: tracking,
            shippingCost: cost?.toString() || '',
            isUpdating: false,
            showLabelModal: false
          }, false, 'orderDetail/updateShippingLabel/success')

          get().showSuccessOverlay('Shipping label updated')
        } catch (err) {
          logger.error('[OrderDetailStore] Failed to update shipping label:', err)
          set({ isUpdating: false }, false, 'orderDetail/updateShippingLabel/error')
          throw err
        }
      },

      /**
       * Advance order status based on order type workflow
       * Context-aware state machine
       */
      advanceStatus: async (orderId: string, orderType: string, currentStatus: string) => {
        try {
          set({ isUpdating: true }, false, 'orderDetail/advanceStatus')

          // Determine next status based on order type
          let nextStatus: string

          switch (orderType.toLowerCase()) {
            case 'walk_in':
              nextStatus = 'completed'
              break

            case 'pickup':
              if (currentStatus === 'pending') nextStatus = 'preparing'
              else if (currentStatus === 'preparing') nextStatus = 'ready'
              else if (currentStatus === 'ready') nextStatus = 'completed'
              else nextStatus = 'completed'
              break

            case 'delivery':
              if (currentStatus === 'pending') nextStatus = 'preparing'
              else if (currentStatus === 'preparing') nextStatus = 'out_for_delivery'
              else if (currentStatus === 'out_for_delivery') nextStatus = 'completed'
              else nextStatus = 'completed'
              break

            case 'shipping':
              if (currentStatus === 'pending') nextStatus = 'preparing'
              else if (currentStatus === 'preparing') nextStatus = 'ready_to_ship'
              else if (currentStatus === 'ready_to_ship') nextStatus = 'shipped'
              else if (currentStatus === 'shipped') nextStatus = 'in_transit'
              else if (currentStatus === 'in_transit') nextStatus = 'delivered'
              else nextStatus = 'delivered'
              break

            default:
              nextStatus = 'completed'
          }

          // Update via orders service (which will trigger real-time update)
          await ordersService.updateOrderStatus(orderId, nextStatus as any)

          set({ isUpdating: false }, false, 'orderDetail/advanceStatus/success')
          get().showSuccessOverlay(`Status updated to ${nextStatus}`)
        } catch (err) {
          logger.error('[OrderDetailStore] Failed to advance status:', err)
          set({ isUpdating: false }, false, 'orderDetail/advanceStatus/error')
          throw err
        }
      },

      /**
       * Open notes modal
       */
      openNotesModal: (notes: string) => {
        set({
          showNotesModal: true,
          staffNotes: notes
        }, false, 'orderDetail/openNotesModal')
      },

      /**
       * Close notes modal
       */
      closeNotesModal: () => {
        set({ showNotesModal: false }, false, 'orderDetail/closeNotesModal')
      },

      /**
       * Open shipping label modal
       */
      openLabelModal: (tracking: string, cost: string) => {
        set({
          showLabelModal: true,
          trackingNumber: tracking,
          shippingCost: cost
        }, false, 'orderDetail/openLabelModal')
      },

      /**
       * Close shipping label modal
       */
      closeLabelModal: () => {
        set({ showLabelModal: false }, false, 'orderDetail/closeLabelModal')
      },

      /**
       * Set staff notes (form input)
       */
      setStaffNotes: (notes: string) => {
        set({ staffNotes: notes }, false, 'orderDetail/setStaffNotes')
      },

      /**
       * Set tracking number (form input)
       */
      setTrackingNumber: (tracking: string) => {
        set({ trackingNumber: tracking }, false, 'orderDetail/setTrackingNumber')
      },

      /**
       * Set shipping cost (form input)
       */
      setShippingCost: (cost: string) => {
        set({ shippingCost: cost }, false, 'orderDetail/setShippingCost')
      },

      /**
       * Show success overlay with message
       */
      showSuccessOverlay: (message: string) => {
        set({
          showSuccess: true,
          successMessage: message
        }, false, 'orderDetail/showSuccessOverlay')

        // Auto-hide after 2 seconds
        setTimeout(() => {
          get().hideSuccessOverlay()
        }, 2000)
      },

      /**
       * Hide success overlay
       */
      hideSuccessOverlay: () => {
        set({
          showSuccess: false,
          successMessage: ''
        }, false, 'orderDetail/hideSuccessOverlay')
      },

      /**
       * Subscribe to real-time updates for specific order
       */
      subscribeToOrder: (orderId: string) => {
        // Unsubscribe from previous order first
        get().unsubscribe()

        logger.info('[OrderDetailStore] Subscribing to order:', orderId)

        const channel = supabase
          .channel(`order-${orderId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'orders',
              filter: `id=eq.${orderId}`,
            },
            (payload) => {
              logger.info('[OrderDetailStore] Order updated in real-time:', payload.new)

              // Reload order details to get fresh data
              get().loadOrderDetails(orderId)
            }
          )
          .subscribe()

        set({ realtimeChannel: channel }, false, 'orderDetail/subscribeToOrder')
      },

      /**
       * Unsubscribe from real-time updates
       */
      unsubscribe: () => {
        const { realtimeChannel } = get()
        if (realtimeChannel) {
          logger.info('[OrderDetailStore] Unsubscribing from order updates')
          supabase.removeChannel(realtimeChannel)
          set({ realtimeChannel: null }, false, 'orderDetail/unsubscribe')
        }
      },

      /**
       * Reset entire detail state (when order deselected or navigating away)
       */
      reset: () => {
        // Unsubscribe from real-time first
        get().unsubscribe()

        logger.info('[OrderDetailStore] Resetting state')
        set(initialState, false, 'orderDetail/reset')
      },
    }),
    { name: 'OrderDetailStore' } // Redux DevTools name
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get current order ID
export const useCurrentOrderId = () => useOrderDetailStore((state) => state.currentOrderId)

// Get order items
export const useOrderItems = () => useOrderDetailStore((state) => state.orderItems)

// Get loyalty data
export const useLoyaltyData = () => useOrderDetailStore(
  useShallow((state) => ({
    loyaltyPointsEarned: state.loyaltyPointsEarned,
    loyaltyPointsRedeemed: state.loyaltyPointsRedeemed
  }))
)

// Get tax details
export const useTaxDetails = () => useOrderDetailStore((state) => state.taxDetails)

// Get loading states
export const useOrderDetailLoading = () => useOrderDetailStore(
  useShallow((state) => ({
    loading: state.loading,
    isUpdating: state.isUpdating
  }))
)

// Get modal states
export const useOrderDetailModals = () => useOrderDetailStore(
  useShallow((state) => ({
    showNotesModal: state.showNotesModal,
    showLabelModal: state.showLabelModal
  }))
)

// Get form state
export const useOrderDetailForm = () => useOrderDetailStore(
  useShallow((state) => ({
    staffNotes: state.staffNotes,
    trackingNumber: state.trackingNumber,
    shippingCost: state.shippingCost
  }))
)

// Get success overlay state
export const useOrderDetailSuccess = () => useOrderDetailStore(
  useShallow((state) => ({
    showSuccess: state.showSuccess,
    successMessage: state.successMessage
  }))
)

// Get all actions (with useShallow to prevent infinite loops)
export const useOrderDetailActions = () => useOrderDetailStore(
  useShallow((state) => ({
    loadOrderDetails: state.loadOrderDetails,
    updateNotes: state.updateNotes,
    updateShippingLabel: state.updateShippingLabel,
    advanceStatus: state.advanceStatus,
    openNotesModal: state.openNotesModal,
    closeNotesModal: state.closeNotesModal,
    openLabelModal: state.openLabelModal,
    closeLabelModal: state.closeLabelModal,
    setStaffNotes: state.setStaffNotes,
    setTrackingNumber: state.setTrackingNumber,
    setShippingCost: state.setShippingCost,
    showSuccessOverlay: state.showSuccessOverlay,
    hideSuccessOverlay: state.hideSuccessOverlay,
    reset: state.reset,
  }))
)

// Get complete detail state (for debugging)
export const useOrderDetailState = () => useOrderDetailStore(
  useShallow((state) => ({
    currentOrderId: state.currentOrderId,
    orderItems: state.orderItems,
    loyaltyPointsEarned: state.loyaltyPointsEarned,
    loyaltyPointsRedeemed: state.loyaltyPointsRedeemed,
    taxDetails: state.taxDetails,
    loading: state.loading,
    isUpdating: state.isUpdating,
  }))
)

// Export types
export type { OrderItem, TaxDetail }
