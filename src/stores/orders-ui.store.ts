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

type NavSection = 'fulfillment' | 'in-store' | 'errors'
type DateRange = 'today' | 'week' | 'month' | 'all' | 'custom'

interface OrdersUIState {
  // Navigation
  activeNav: NavSection

  // Selection
  selectedOrderId: string | null

  // Search & Filters
  searchQuery: string
  dateRange: DateRange
  customStartDate: Date | null
  customEndDate: Date | null

  // Modals
  showLocationSelector: boolean
  showCustomDatePicker: boolean

  // Ship Modal State (persisted to survive order refreshes)
  showShipModal: boolean
  shipModalOrderId: string | null
  shipModalLocationId: string | null

  // Signal for detail views to reload after shipping
  lastShipmentAt: number | null

  // Actions
  setActiveNav: (nav: NavSection) => void
  setActiveNavWithOrder: (nav: NavSection, orderId: string) => void
  selectOrder: (orderId: string | null) => void
  setSearchQuery: (query: string) => void
  setDateRange: (range: DateRange) => void
  setCustomDateRange: (startDate: Date, endDate: Date) => void
  toggleLocationSelector: () => void
  openLocationSelector: () => void
  closeLocationSelector: () => void
  openCustomDatePicker: () => void
  closeCustomDatePicker: () => void

  // Ship Modal Actions
  openShipModal: (orderId: string, locationId: string | null) => void
  closeShipModal: () => void
  markShipmentComplete: () => void

  // Reset
  reset: () => void
}

const initialState = {
  activeNav: 'fulfillment' as NavSection, // Default to unified fulfillment board
  selectedOrderId: null,
  searchQuery: '',
  dateRange: 'all' as DateRange,
  customStartDate: null,
  customEndDate: null,
  showLocationSelector: false,
  showCustomDatePicker: false,
  showShipModal: false,
  shipModalOrderId: null,
  shipModalLocationId: null,
  lastShipmentAt: null,
}

export const useOrdersUIStore = create<OrdersUIState>()(
  devtools(
    (set) => ({
      ...initialState,

      /**
       * Set active navigation section
       * Also clears selected order when switching views
       */
      setActiveNav: (nav: NavSection) => {
        set({ activeNav: nav, selectedOrderId: null }, false, 'ordersUI/setActiveNav')
      },

      /**
       * Set active nav AND select an order (for notifications)
       * Atomically sets both without clearing
       */
      setActiveNavWithOrder: (nav: NavSection, orderId: string) => {
        set({ activeNav: nav, selectedOrderId: orderId }, false, 'ordersUI/setActiveNavWithOrder')
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
        // If setting to 'custom', open the date picker
        if (range === 'custom') {
          set({ showCustomDatePicker: true }, false, 'ordersUI/openCustomDatePicker')
        } else {
          set({ dateRange: range }, false, 'ordersUI/setDateRange')
        }
      },

      /**
       * Set custom date range
       */
      setCustomDateRange: (startDate: Date, endDate: Date) => {
        set({
          dateRange: 'custom',
          customStartDate: startDate,
          customEndDate: endDate,
          showCustomDatePicker: false
        }, false, 'ordersUI/setCustomDateRange')
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
       * Open custom date picker modal
       */
      openCustomDatePicker: () => {
        set({ showCustomDatePicker: true }, false, 'ordersUI/openCustomDatePicker')
      },

      /**
       * Close custom date picker modal
       */
      closeCustomDatePicker: () => {
        set({ showCustomDatePicker: false }, false, 'ordersUI/closeCustomDatePicker')
      },

      /**
       * Open ship modal with order and location
       */
      openShipModal: (orderId: string, locationId: string | null) => {
        set({
          showShipModal: true,
          shipModalOrderId: orderId,
          shipModalLocationId: locationId
        }, false, 'ordersUI/openShipModal')
      },

      /**
       * Close ship modal
       */
      closeShipModal: () => {
        set({
          showShipModal: false,
          shipModalOrderId: null,
          shipModalLocationId: null
        }, false, 'ordersUI/closeShipModal')
      },

      /**
       * Mark that a shipment was just completed
       * Detail views watch this to know when to reload
       */
      markShipmentComplete: () => {
        set({ lastShipmentAt: Date.now() }, false, 'ordersUI/markShipmentComplete')
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

// Get custom date range
export const useCustomDateRange = () => useOrdersUIStore(
  useShallow((state) => ({
    startDate: state.customStartDate,
    endDate: state.customEndDate,
  }))
)

// Get location selector visibility
export const useShowLocationSelector = () => useOrdersUIStore((state) => state.showLocationSelector)

// Get custom date picker visibility
export const useShowCustomDatePicker = () => useOrdersUIStore((state) => state.showCustomDatePicker)

// Get ship modal state
export const useShowShipModal = () => useOrdersUIStore((state) => state.showShipModal)
export const useShipModalOrderId = () => useOrdersUIStore((state) => state.shipModalOrderId)
export const useShipModalLocationId = () => useOrdersUIStore((state) => state.shipModalLocationId)
export const useLastShipmentAt = () => useOrdersUIStore((state) => state.lastShipmentAt)

// Get all UI actions (with useShallow to prevent infinite loops)
export const useOrdersUIActions = () => useOrdersUIStore(
  useShallow((state) => ({
    setActiveNav: state.setActiveNav,
    setActiveNavWithOrder: state.setActiveNavWithOrder,
    selectOrder: state.selectOrder,
    setSearchQuery: state.setSearchQuery,
    setDateRange: state.setDateRange,
    setCustomDateRange: state.setCustomDateRange,
    toggleLocationSelector: state.toggleLocationSelector,
    openLocationSelector: state.openLocationSelector,
    closeLocationSelector: state.closeLocationSelector,
    openCustomDatePicker: state.openCustomDatePicker,
    closeCustomDatePicker: state.closeCustomDatePicker,
    openShipModal: state.openShipModal,
    closeShipModal: state.closeShipModal,
    markShipmentComplete: state.markShipmentComplete,
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
    customStartDate: state.customStartDate,
    customEndDate: state.customEndDate,
    showLocationSelector: state.showLocationSelector,
    showCustomDatePicker: state.showCustomDatePicker,
  }))
)

// Export actions for non-hook usage (like checkoutUIActions pattern)
export const ordersUIActions = {
  get setActiveNav() { return useOrdersUIStore.getState().setActiveNav },
  get setActiveNavWithOrder() { return useOrdersUIStore.getState().setActiveNavWithOrder },
  get selectOrder() { return useOrdersUIStore.getState().selectOrder },
  get setSearchQuery() { return useOrdersUIStore.getState().setSearchQuery },
  get setDateRange() { return useOrdersUIStore.getState().setDateRange },
  get setCustomDateRange() { return useOrdersUIStore.getState().setCustomDateRange },
  get toggleLocationSelector() { return useOrdersUIStore.getState().toggleLocationSelector },
  get openLocationSelector() { return useOrdersUIStore.getState().openLocationSelector },
  get closeLocationSelector() { return useOrdersUIStore.getState().closeLocationSelector },
  get openCustomDatePicker() { return useOrdersUIStore.getState().openCustomDatePicker },
  get closeCustomDatePicker() { return useOrdersUIStore.getState().closeCustomDatePicker },
  get openShipModal() { return useOrdersUIStore.getState().openShipModal },
  get closeShipModal() { return useOrdersUIStore.getState().closeShipModal },
  get markShipmentComplete() { return useOrdersUIStore.getState().markShipmentComplete },
  get reset() { return useOrdersUIStore.getState().reset },
}

// Export types for external use
export type { NavSection, DateRange }
