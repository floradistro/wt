/**
 * Location Filter Store
 *
 * Global store for managing location filter across the app.
 * - Persists selected location(s) across navigation
 * - Auto-selects user's assigned location(s) on first load
 * - Works for Orders, Products, and all other location-aware screens
 */

import { create } from 'zustand'

interface LocationFilterState {
  selectedLocationIds: string[]
  isInitialized: boolean

  // Actions
  setSelectedLocationIds: (ids: string[]) => void
  clearLocationFilter: () => void
  initializeFromUserLocations: (userLocationIds: string[], isAdmin: boolean) => void
  reset: () => void
}

export const useLocationFilter = create<LocationFilterState>((set, get) => ({
  selectedLocationIds: [],
  isInitialized: false,

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
    set({ selectedLocationIds: [] })
  },

  /**
   * Initialize location filter from user's assigned locations
   * Only auto-selects for staff users (not admins)
   */
  initializeFromUserLocations: (userLocationIds: string[], isAdmin: boolean) => {
    const { isInitialized } = get()

    // Only initialize once
    if (isInitialized) {
      // eslint-disable-next-line no-console
      console.log('[LocationFilter] Already initialized, skipping', {
        currentSelection: get().selectedLocationIds
      })
      return
    }

    // eslint-disable-next-line no-console
    console.log('[LocationFilter] Initializing from user locations', {
      userLocationIds,
      isAdmin
    })

    // Staff users: auto-select their assigned location(s)
    // Admin users: don't auto-filter (show all)
    if (!isAdmin && userLocationIds.length > 0) {
      set({
        selectedLocationIds: userLocationIds,
        isInitialized: true,
      })
      // eslint-disable-next-line no-console
      console.log('[LocationFilter] Auto-selected staff user locations', {
        selectedLocationIds: userLocationIds
      })
    } else {
      set({
        selectedLocationIds: [],
        isInitialized: true,
      })
      // eslint-disable-next-line no-console
      console.log('[LocationFilter] Admin user - no auto-filter')
    }
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
    })
  },
}))
