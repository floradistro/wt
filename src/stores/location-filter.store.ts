/**
 * Location Filter Store
 *
 * Global store for managing location filter across the app.
 * - Persists selected location(s) across navigation
 * - Auto-selects user's assigned location(s) on first load
 * - Works for Orders, Products, and all other location-aware screens
 */

import { create } from 'zustand'
import { logger } from '@/utils/logger'

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
    logger.info('[LocationFilter] Setting selected locations', { ids })
    set({ selectedLocationIds: ids })
  },

  /**
   * Clear all location filters (show all locations)
   */
  clearLocationFilter: () => {
    logger.info('[LocationFilter] Clearing location filter')
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
      logger.info('[LocationFilter] Already initialized, skipping', {
        currentSelection: get().selectedLocationIds
      })
      return
    }

    logger.info('[LocationFilter] Initializing from user locations', {
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
      logger.info('[LocationFilter] Auto-selected staff user locations', {
        selectedLocationIds: userLocationIds
      })
    } else {
      set({
        selectedLocationIds: [],
        isInitialized: true,
      })
      logger.info('[LocationFilter] Admin user - no auto-filter')
    }
  },

  /**
   * Reset the store (for logout, etc.)
   */
  reset: () => {
    logger.info('[LocationFilter] Resetting store')
    set({
      selectedLocationIds: [],
      isInitialized: false,
    })
  },
}))
