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
 * - PERFORMANCE: Memoized selectors prevent redundant calculations
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { useMemo } from 'react'
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
        const { activeNav, searchQuery, dateRange, customStartDate, customEndDate } = useOrdersUIStore.getState()

        // Read from location filter store
        const { selectedLocationIds } = useLocationFilter.getState()

        console.log('[OrderFilter] Filtering orders:', {
          totalOrders: allOrders.length,
          activeNav,
          selectedLocationIds,
          orderTypes: allOrders.map(o => o.order_type),
          orderLocationIds: allOrders.map(o => o.pickup_location_id)
        })

        // Get date filter cutoff
        const dateFilter = getDateRangeFilter(dateRange, customStartDate, customEndDate)

        // Apply all filters
        return allOrders.filter((order) => {
          // Location filter (FIRST - most important for staff users)
          if (selectedLocationIds.length > 0) {
            if (!order.pickup_location_id || !selectedLocationIds.includes(order.pickup_location_id)) {
              console.log('[OrderFilter] Filtered out by location:', {
                orderId: order.id,
                orderLocation: order.pickup_location_id,
                selectedLocations: selectedLocationIds
              })
              return false
            }
          }

          // Order Type filter - Order type-based navigation (The Apple Way)
          if (activeNav !== 'all') {
            if (activeNav === 'in-store') {
              // "In-Store Sales" = POS walk-in transactions
              if (order.order_type !== 'walk_in') {
                return false
              }
            } else if (activeNav === 'pickup') {
              // "Store Pickup" = Online orders for pickup
              if (order.order_type !== 'pickup') {
                return false
              }
            } else if (activeNav === 'ecommerce') {
              // "E-Commerce" = Shipping orders
              if (order.order_type !== 'shipping') {
                return false
              }
            }
          }

          // Date range filter
          if (dateFilter) {
            const orderDate = new Date(order.created_at)

            // Handle custom date range (object with start and end)
            if (typeof dateFilter === 'object' && 'start' in dateFilter && 'end' in dateFilter) {
              const start = new Date(dateFilter.start)
              start.setHours(0, 0, 0, 0)
              const end = new Date(dateFilter.end)
              end.setHours(23, 59, 59, 999)

              if (orderDate < start || orderDate > end) {
                return false
              }
            } else {
              // Handle simple date cutoff (today, week, month)
              if (orderDate < dateFilter) {
                return false
              }
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
 * Uses React.useMemo to prevent redundant calculations
 */

// Get filtered orders (re-computes ONLY when dependencies change)
export const useFilteredOrders = () => {
  // Subscribe to all dependencies to trigger re-computation
  const orders = useOrdersStore((state) => state.orders)
  const activeNav = useOrdersUIStore((state) => state.activeNav)
  const searchQuery = useOrdersUIStore((state) => state.searchQuery)
  const dateRange = useOrdersUIStore((state) => state.dateRange)
  const selectedLocationIds = useLocationFilter((state) => state.selectedLocationIds)

  // ⚡ PERFORMANCE: Memoize filtered orders
  return useMemo(() => {
    return useOrderFilterStore.getState().getFilteredOrders()
  }, [orders, activeNav, searchQuery, dateRange, selectedLocationIds])
}

// Get grouped orders (for FlatList)
export const useGroupedOrders = () => {
  // Subscribe to filtered orders
  const filteredOrders = useFilteredOrders()

  // ⚡ PERFORMANCE: Memoize grouped orders
  return useMemo(() => {
    return useOrderFilterStore.getState().getGroupedOrders()
  }, [filteredOrders])
}

// Get badge counts (re-computes ONLY when orders or location filter changes)
export const useBadgeCounts = () => {
  // Subscribe to dependencies
  const orders = useOrdersStore((state) => state.orders)
  const selectedLocationIds = useLocationFilter((state) => state.selectedLocationIds)

  // ⚡ PERFORMANCE: Memoize badge counts
  return useMemo(() => {
    return useOrderFilterStore.getState().getBadgeCounts()
  }, [orders, selectedLocationIds])
}

// Export types
export type { BadgeCounts }
