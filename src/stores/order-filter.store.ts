/**
 * Order Filter Store - Apple Engineering Standard
 *
 * Principle: Computed/derived state for filtering and grouping orders
 * Reads from: orders.store, orders-ui.store, location-filter.store
 *
 * Benefits:
 * - Cross-store subscriptions (Apple pattern)
 * - No duplicate state
 * - Computed selectors auto-update
 * - Badge counts always accurate
 * - Client-side filtering (fast, no API calls)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { type Order } from '@/services/orders.service'
import { useOrdersStore } from './orders.store'
import { useOrdersUIStore } from './orders-ui.store'
import { useLocationFilter } from './location-filter.store'
import { getDateRangeFilter, groupOrdersByDate } from '@/hooks/orders/orders.utils'

interface BadgeCounts {
  all: number
  needsAction: number
  inProgress: number
  completed: number
  cancelled: number
}

interface OrderFilterState {
  // Computed selectors (read-only, derived from other stores)
  getFilteredOrders: () => Order[]
  getGroupedOrders: () => Array<{ title: string; data: Order[] }>
  getBadgeCounts: () => BadgeCounts

  // Helper for getting location-filtered orders (used for badge counts)
  getLocationFilteredOrders: () => Order[]
}

export const useOrderFilterStore = create<OrderFilterState>()(
  devtools(
    (set, get) => ({
      /**
       * Get filtered orders based on all active filters
       * Reads from: orders.store, orders-ui.store, location-filter.store
       */
      getFilteredOrders: () => {
        // Read from orders store
        const allOrders = useOrdersStore.getState().orders

        // Read from orders UI store
        const { activeNav, searchQuery, dateRange } = useOrdersUIStore.getState()

        // Read from location filter store
        const { selectedLocationIds } = useLocationFilter.getState()

        // Get date filter cutoff
        const dateFilter = getDateRangeFilter(dateRange)

        // Apply all filters
        return allOrders.filter((order) => {
          // Location filter (FIRST - most important for staff users)
          if (selectedLocationIds.length > 0) {
            if (!order.pickup_location_id || !selectedLocationIds.includes(order.pickup_location_id)) {
              return false
            }
          }

          // Status filter - Smart groupings (The Apple Way)
          if (activeNav !== 'all') {
            if (activeNav === 'needs_action') {
              // "Needs Action" = Orders requiring immediate attention
              const needsAction = ['pending', 'ready', 'out_for_delivery', 'ready_to_ship']
              if (!needsAction.includes(order.status)) {
                return false
              }
            } else if (activeNav === 'in_progress') {
              // "In Progress" = Orders actively being worked on
              const inProgress = ['preparing', 'shipped', 'in_transit']
              if (!inProgress.includes(order.status)) {
                return false
              }
            } else if (activeNav === 'completed') {
              // "Completed" = Finished orders
              const completed = ['completed', 'delivered']
              if (!completed.includes(order.status)) {
                return false
              }
            } else if (activeNav === 'cancelled') {
              // "Cancelled" = Cancelled orders
              if (order.status !== 'cancelled') {
                return false
              }
            }
          }

          // Date range filter
          if (dateFilter) {
            const orderDate = new Date(order.created_at)
            if (orderDate < dateFilter) {
              return false
            }
          }

          // Search filter
          if (searchQuery) {
            const searchLower = searchQuery.toLowerCase()
            const customerNameMatch = (order.customer_name || '').toLowerCase().includes(searchLower)
            const orderNumberMatch = order.order_number.toLowerCase().includes(searchLower)
            const emailMatch = (order.customer_email || '').toLowerCase().includes(searchLower)

            if (!customerNameMatch && !orderNumberMatch && !emailMatch) {
              return false
            }
          }

          return true
        })
      },

      /**
       * Get grouped orders (for FlatList sections)
       * Groups filtered orders by date categories
       */
      getGroupedOrders: () => {
        const filteredOrders = get().getFilteredOrders()
        return groupOrdersByDate(filteredOrders)
      },

      /**
       * Get location-filtered orders (for badge counts)
       * Only filters by location, not by status/date/search
       */
      getLocationFilteredOrders: () => {
        const allOrders = useOrdersStore.getState().orders
        const { selectedLocationIds } = useLocationFilter.getState()

        if (selectedLocationIds.length === 0) {
          return allOrders
        }

        return allOrders.filter(order =>
          order.pickup_location_id && selectedLocationIds.includes(order.pickup_location_id)
        )
      },

      /**
       * Get badge counts for navigation items
       * Based on location-filtered orders, not status-filtered
       */
      getBadgeCounts: () => {
        const locationFilteredOrders = get().getLocationFilteredOrders()

        // "Needs Action" = Orders requiring immediate staff attention
        const needsActionCount = locationFilteredOrders.filter(o =>
          o.status === 'pending' ||
          o.status === 'ready' ||
          o.status === 'out_for_delivery' ||
          o.status === 'ready_to_ship'
        ).length

        // "In Progress" = Orders actively being worked on
        const inProgressCount = locationFilteredOrders.filter(o =>
          o.status === 'preparing' ||
          o.status === 'shipped' ||
          o.status === 'in_transit'
        ).length

        // "Completed" = Finished orders (completed or delivered)
        const completedCount = locationFilteredOrders.filter(o =>
          o.status === 'completed' ||
          o.status === 'delivered'
        ).length

        // "Cancelled" = Cancelled orders
        const cancelledCount = locationFilteredOrders.filter(o =>
          o.status === 'cancelled'
        ).length

        return {
          all: locationFilteredOrders.length,
          needsAction: needsActionCount,
          inProgress: inProgressCount,
          completed: completedCount,
          cancelled: cancelledCount,
        }
      },
    }),
    { name: 'OrderFilterStore' } // Redux DevTools name
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get filtered orders (re-computes when dependencies change)
export const useFilteredOrders = () => {
  // Subscribe to all dependencies to trigger re-computation
  const orders = useOrdersStore((state) => state.orders)
  const activeNav = useOrdersUIStore((state) => state.activeNav)
  const searchQuery = useOrdersUIStore((state) => state.searchQuery)
  const dateRange = useOrdersUIStore((state) => state.dateRange)
  const selectedLocationIds = useLocationFilter((state) => state.selectedLocationIds)

  // Compute filtered orders
  return useOrderFilterStore.getState().getFilteredOrders()
}

// Get grouped orders (for FlatList)
export const useGroupedOrders = () => {
  // Subscribe to filtered orders
  const filteredOrders = useFilteredOrders()

  // Group by date
  return useOrderFilterStore.getState().getGroupedOrders()
}

// Get badge counts (re-computes when orders or location filter changes)
export const useBadgeCounts = () => {
  // Subscribe to dependencies
  const orders = useOrdersStore((state) => state.orders)
  const selectedLocationIds = useLocationFilter((state) => state.selectedLocationIds)

  // Compute badge counts
  return useOrderFilterStore.getState().getBadgeCounts()
}

// Export types
export type { BadgeCounts }
