/**
 * POS Order Filter Store - Apple Engineering Standard
 *
 * Principle: Simple filter state for POS order feed
 * Mirrors product-filter.store pattern
 *
 * Benefits:
 * - Zero prop drilling for filter state
 * - Filters accessible anywhere in app
 * - Redux DevTools visibility
 * - Separate from main orders screen filters
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Order } from '@/services/orders.service'

// Order status groups for filtering
export const POS_ORDER_STATUS_GROUPS = {
  active: ['pending', 'confirmed', 'preparing', 'ready', 'ready_to_ship', 'packed'] as const,
  shipping: ['shipped', 'in_transit', 'out_for_delivery'] as const,
  completed: ['completed', 'delivered'] as const,
  cancelled: ['cancelled'] as const,
  errors: [] as const, // Special - filters by payment_status === 'failed'
}

export type POSOrderStatusGroup = 'all' | 'active' | 'shipping' | 'completed' | 'cancelled' | 'errors'

export interface POSOrderFilters {
  searchQuery: string
  statusGroup: POSOrderStatusGroup
  orderType: string // 'all' | 'walk_in' | 'pickup' | 'delivery' | 'shipping'
}

interface POSOrderFilterState {
  // State
  filters: POSOrderFilters

  // Actions
  setSearchQuery: (query: string) => void
  setStatusGroup: (group: POSOrderStatusGroup) => void
  setOrderType: (type: string) => void
  clearFilters: () => void
  reset: () => void
}

const initialFilters: POSOrderFilters = {
  searchQuery: '',
  statusGroup: 'active',
  orderType: 'all',
}

export const usePOSOrderFilterStore = create<POSOrderFilterState>()(
  devtools(
    (set) => ({
      filters: initialFilters,

      setSearchQuery: (query: string) => {
        set(
          (state) => ({
            filters: { ...state.filters, searchQuery: query },
          }),
          false,
          'posOrderFilter/setSearchQuery'
        )
      },

      setStatusGroup: (group: POSOrderStatusGroup) => {
        set(
          (state) => ({
            filters: { ...state.filters, statusGroup: group },
          }),
          false,
          'posOrderFilter/setStatusGroup'
        )
      },

      setOrderType: (type: string) => {
        set(
          (state) => ({
            filters: { ...state.filters, orderType: type },
          }),
          false,
          'posOrderFilter/setOrderType'
        )
      },

      clearFilters: () => {
        set({ filters: initialFilters }, false, 'posOrderFilter/clearFilters')
      },

      reset: () => {
        set({ filters: initialFilters }, false, 'posOrderFilter/reset')
      },
    }),
    { name: 'POSOrderFilterStore' }
  )
)

// Selectors
export const usePOSOrderFilters = () =>
  usePOSOrderFilterStore((state) => state.filters)

export const usePOSOrderSearchQuery = () =>
  usePOSOrderFilterStore((state) => state.filters.searchQuery)

export const usePOSOrderStatusGroup = () =>
  usePOSOrderFilterStore((state) => state.filters.statusGroup)

// Count active filters (for badge)
export const usePOSOrderActiveFilterCount = () =>
  usePOSOrderFilterStore((state) => {
    let count = 0
    if (state.filters.searchQuery.length > 0) count++
    if (state.filters.statusGroup !== 'active') count++ // Default is 'active'
    if (state.filters.orderType !== 'all') count++
    return count
  })

// Export actions as plain object
export const posOrderFilterActions = {
  get setSearchQuery() {
    return usePOSOrderFilterStore.getState().setSearchQuery
  },
  get setStatusGroup() {
    return usePOSOrderFilterStore.getState().setStatusGroup
  },
  get setOrderType() {
    return usePOSOrderFilterStore.getState().setOrderType
  },
  get clearFilters() {
    return usePOSOrderFilterStore.getState().clearFilters
  },
  get reset() {
    return usePOSOrderFilterStore.getState().reset
  },
}

// Helper to filter orders based on current filters
export function applyPOSOrderFilters(orders: Order[], filters: POSOrderFilters): Order[] {
  let filtered = orders

  // Filter by status group
  if (filters.statusGroup !== 'all') {
    if (filters.statusGroup === 'errors') {
      // Special case: errors shows failed payments and cancelled orders
      filtered = filtered.filter(order =>
        order.payment_status === 'failed' ||
        order.status === 'cancelled'
      )
    } else {
      const statuses = POS_ORDER_STATUS_GROUPS[filters.statusGroup]
      filtered = filtered.filter(order => (statuses as readonly string[]).includes(order.status))
    }
  }

  // Filter by order type
  if (filters.orderType !== 'all') {
    filtered = filtered.filter(order => order.order_type === filters.orderType)
  }

  // Filter by search query
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase().trim()
    filtered = filtered.filter(order => {
      // Search in order number
      if (order.order_number?.toLowerCase().includes(query)) return true
      // Search in customer name
      if (order.customer_name?.toLowerCase().includes(query)) return true
      // Search in customer email
      if (order.customer_email?.toLowerCase().includes(query)) return true
      // Search in customer phone
      if (order.customer_phone?.includes(query)) return true
      return false
    })
  }

  return filtered
}
