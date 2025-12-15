import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { logger } from '@/utils/logger'

// Tab indices in DashboardNavigator
// All views consolidated into POS - Products and Marketing will be rewired into POS
export const TAB_INDICES = {
  POS: 0,
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

    }),
    { name: 'NavigationStore' }
  )
)

// Convenient selectors
export const useNavigateToTab = () => useNavigationStore((state) => state.navigateToTab)

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
}
