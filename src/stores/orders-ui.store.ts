/**
 * Orders UI Store - Apple Engineering Standard
 *
 * Principle: Centralized UI state for orders flow
 * Replaces: Scattered local state and prop drilling in OrdersScreen
 *
 * Benefits:
 * - Zero prop drilling for UI state
 * - Accessible anywhere in orders flow
 * - Redux DevTools visibility
 * - Clean separation: business logic (orders.store) vs UI state (orders-ui.store)
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'

type NavSection = 'all' | 'needs_action' | 'in_progress' | 'completed' | 'cancelled'
type DateRange = 'today' | 'week' | 'month' | 'all'

interface OrdersUIState {
  // Navigation
  activeNav: NavSection

  // Selection
  selectedOrderId: string | null

  // Search & Filters
  searchQuery: string
  dateRange: DateRange

  // Modals
  showLocationSelector: boolean

  // Actions
  setActiveNav: (nav: NavSection) => void
  selectOrder: (orderId: string | null) => void
  setSearchQuery: (query: string) => void
  setDateRange: (range: DateRange) => void
  toggleLocationSelector: () => void
  openLocationSelector: () => void
  closeLocationSelector: () => void

  // Reset
  reset: () => void
}

const initialState = {
  activeNav: 'all' as NavSection,
  selectedOrderId: null,
  searchQuery: '',
  dateRange: 'all' as DateRange,
  showLocationSelector: false,
}

export const useOrdersUIStore = create<OrdersUIState>()(
  devtools(
    (set) => ({
      ...initialState,

      /**
       * Set active navigation section
       */
      setActiveNav: (nav: NavSection) => {
        set({ activeNav: nav }, false, 'ordersUI/setActiveNav')
      },

      /**
       * Select an order (for detail view)
       */
      selectOrder: (orderId: string | null) => {
        set({ selectedOrderId: orderId }, false, 'ordersUI/selectOrder')
      },

      /**
       * Update search query
       */
      setSearchQuery: (query: string) => {
        set({ searchQuery: query }, false, 'ordersUI/setSearchQuery')
      },

      /**
       * Set date range filter
       */
      setDateRange: (range: DateRange) => {
        set({ dateRange: range }, false, 'ordersUI/setDateRange')
      },

      /**
       * Toggle location selector modal
       */
      toggleLocationSelector: () => {
        set((state) => ({
          showLocationSelector: !state.showLocationSelector
        }), false, 'ordersUI/toggleLocationSelector')
      },

      /**
       * Open location selector modal
       */
      openLocationSelector: () => {
        set({ showLocationSelector: true }, false, 'ordersUI/openLocationSelector')
      },

      /**
       * Close location selector modal
       */
      closeLocationSelector: () => {
        set({ showLocationSelector: false }, false, 'ordersUI/closeLocationSelector')
      },

      /**
       * Reset entire UI state (for cleanup or navigation away)
       */
      reset: () => {
        set(initialState, false, 'ordersUI/reset')
      },
    }),
    { name: 'OrdersUIStore' } // Redux DevTools name
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get active navigation section
export const useActiveNav = () => useOrdersUIStore((state) => state.activeNav)

// Get selected order ID
export const useSelectedOrderId = () => useOrdersUIStore((state) => state.selectedOrderId)

// Get search query
export const useSearchQuery = () => useOrdersUIStore((state) => state.searchQuery)

// Get date range filter
export const useDateRange = () => useOrdersUIStore((state) => state.dateRange)

// Get location selector visibility
export const useShowLocationSelector = () => useOrdersUIStore((state) => state.showLocationSelector)

// Get all UI actions (with useShallow to prevent infinite loops)
export const useOrdersUIActions = () => useOrdersUIStore(
  useShallow((state) => ({
    setActiveNav: state.setActiveNav,
    selectOrder: state.selectOrder,
    setSearchQuery: state.setSearchQuery,
    setDateRange: state.setDateRange,
    toggleLocationSelector: state.toggleLocationSelector,
    openLocationSelector: state.openLocationSelector,
    closeLocationSelector: state.closeLocationSelector,
    reset: state.reset,
  }))
)

// Get all UI state (for components that need everything)
export const useOrdersUIState = () => useOrdersUIStore(
  useShallow((state) => ({
    activeNav: state.activeNav,
    selectedOrderId: state.selectedOrderId,
    searchQuery: state.searchQuery,
    dateRange: state.dateRange,
    showLocationSelector: state.showLocationSelector,
  }))
)

// Export types for external use
export type { NavSection, DateRange }
