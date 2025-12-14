/**
 * Navigation Store - Cross-Tab Navigation
 *
 * Provides a way for components to navigate between tabs
 * and optionally select items in the destination screen.
 *
 * Usage:
 * - DashboardNavigator registers `setActiveTab` via `registerNavigator`
 * - Components call `navigateToTab` to switch tabs
 * - `navigateToCustomer` fetches customer and navigates to Customers tab
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getCustomerById, type Customer } from '@/services/customers.service'
import { customersUIActions } from './customers-ui.store'
import { logger } from '@/utils/logger'

// Tab indices in DashboardNavigator
// Updated: Orders removed (now inside POS), Settings moved to Analytics
export const TAB_INDICES = {
  POS: 0,
  PRODUCTS: 1,
  CUSTOMERS: 2,
  MARKETING: 3,
} as const

type TabIndex = (typeof TAB_INDICES)[keyof typeof TAB_INDICES]

interface NavigationState {
  // Internal navigator callback (set by DashboardNavigator)
  _navigatorCallback: ((tabIndex: number) => void) | null

  // Register/unregister the navigator callback
  registerNavigator: (callback: (tabIndex: number) => void) => void
  unregisterNavigator: () => void

  // Navigate to a specific tab
  navigateToTab: (tabIndex: TabIndex) => void

  // Navigate to a customer profile
  navigateToCustomer: (customerId: string) => Promise<void>
}

export const useNavigationStore = create<NavigationState>()(
  devtools(
    (set, get) => ({
      _navigatorCallback: null,

      registerNavigator: (callback) => {
        set({ _navigatorCallback: callback }, false, 'navigation/registerNavigator')
      },

      unregisterNavigator: () => {
        set({ _navigatorCallback: null }, false, 'navigation/unregisterNavigator')
      },

      navigateToTab: (tabIndex) => {
        const { _navigatorCallback } = get()
        if (_navigatorCallback) {
          logger.info('[Navigation] Navigating to tab:', tabIndex)
          _navigatorCallback(tabIndex)
        } else {
          logger.warn('[Navigation] No navigator registered')
        }
      },

      navigateToCustomer: async (customerId) => {
        const { navigateToTab } = get()

        try {
          logger.info('[Navigation] Navigating to customer:', customerId)

          // Fetch the customer
          const customer = await getCustomerById(customerId)

          if (!customer) {
            logger.warn('[Navigation] Customer not found:', customerId)
            return
          }

          // Navigate to Customers tab
          navigateToTab(TAB_INDICES.CUSTOMERS)

          // Select the customer (small delay to ensure screen is mounted)
          setTimeout(() => {
            customersUIActions.selectCustomer(customer)
          }, 100)

          logger.info('[Navigation] Successfully navigated to customer:', customer.full_name || customer.email)
        } catch (error) {
          logger.error('[Navigation] Failed to navigate to customer:', error)
          throw error
        }
      },
    }),
    { name: 'NavigationStore' }
  )
)

// Convenient selectors
export const useNavigateToTab = () => useNavigationStore((state) => state.navigateToTab)
export const useNavigateToCustomer = () => useNavigationStore((state) => state.navigateToCustomer)

// Actions for non-hook usage
export const navigationActions = {
  get registerNavigator() {
    return useNavigationStore.getState().registerNavigator
  },
  get unregisterNavigator() {
    return useNavigationStore.getState().unregisterNavigator
  },
  get navigateToTab() {
    return useNavigationStore.getState().navigateToTab
  },
  get navigateToCustomer() {
    return useNavigationStore.getState().navigateToCustomer
  },
}
