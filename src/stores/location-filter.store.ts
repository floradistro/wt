/**
 * Location Filter Store
 *
 * Global store for managing location filter across the app.
 * - Persists selected location(s) across navigation
 * - Auto-selects user's assigned location(s) on first load
 * - Works for Orders, Products, and all other location-aware screens
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface LocationFilterState {
  selectedLocationIds: string[]
  isInitialized: boolean
  isPOSSessionActive: boolean // Track if filter is locked to POS session

  // Actions
  setSelectedLocationIds: (ids: string[]) => void
  clearLocationFilter: () => void
  initializeFromUserLocations: (userLocationIds: string[], isAdmin: boolean) => void
  setFromPOSSession: (locationId: string, locationName?: string) => void
  clearPOSSession: () => void
  reset: () => void
}

export const useLocationFilter = create<LocationFilterState>()(
  devtools(
    (set, get) => ({
  selectedLocationIds: [],
  isInitialized: false,
  isPOSSessionActive: false,

  /**
   * Set selected location IDs
   */
  setSelectedLocationIds: (ids: string[]) => {
    // eslint-disable-next-line no-console
    console.log('[LocationFilter] Setting selected locations', { ids })
    set({ selectedLocationIds: ids })
  },

  /**
   * Clear all location filters (show all locations)
   */
  clearLocationFilter: () => {
    // eslint-disable-next-line no-console
    console.log('[LocationFilter] Clearing location filter')
    set({ selectedLocationIds: [], isPOSSessionActive: false })
  },

  /**
   * Initialize location filter from user's assigned locations
   *
   * BEHAVIOR:
   * - For Products/Orders/Customers screens: ALWAYS defaults to ALL locations (empty array)
   * - This ensures users see complete data by default
   * - Users can manually filter to specific locations using the location selector
   *
   * IMPORTANT: Only initializes ONCE per app session
   */
  initializeFromUserLocations: (userLocationIds: string[], isAdmin: boolean) => {
    const { isInitialized, isPOSSessionActive } = get()

    // If POS session is active, don't override
    if (isPOSSessionActive) {
      console.log('[LocationFilter] POS session active, skipping user initialization')
      return
    }

    // Only initialize once per app session
    if (isInitialized) {
      // eslint-disable-next-line no-console
      console.log('[LocationFilter] Already initialized, skipping', {
        currentSelection: get().selectedLocationIds
      })
      return
    }

    // eslint-disable-next-line no-console
    console.log('[LocationFilter] Initializing location filter', {
      userLocationIds,
      isAdmin
    })

    // ✅ ALWAYS default to ALL locations (empty array) for better UX
    // Users can manually filter if needed via location selector
    set({
      selectedLocationIds: [],
      isInitialized: true,
    })

    // eslint-disable-next-line no-console
    console.log('[LocationFilter] Initialized to show ALL locations')
  },

  /**
   * Set location filter from POS session
   * Auto-filters the entire app to the session's location
   */
  setFromPOSSession: (locationId: string, locationName?: string) => {
    console.log('[LocationFilter] 🎯 Auto-filtering to POS session location:', {
      locationId,
      locationName,
    })

    set({
      selectedLocationIds: [locationId],
      isInitialized: true,
      isPOSSessionActive: true,
    })
  },

  /**
   * Clear POS session filter (when session ends)
   * Returns to showing all locations
   */
  clearPOSSession: () => {
    console.log('[LocationFilter] 🔓 POS session ended, clearing location lock')

    set({
      selectedLocationIds: [],
      isPOSSessionActive: false,
    })
  },

  /**
   * Reset the store (for logout, etc.)
   */
  reset: () => {
    // eslint-disable-next-line no-console
    console.log('[LocationFilter] Resetting store')
    set({
      selectedLocationIds: [],
      isInitialized: false,
      isPOSSessionActive: false,
    })
  },
    }),
    { name: 'LocationFilterStore' }
  )
)
