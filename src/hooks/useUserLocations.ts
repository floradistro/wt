/**
 * TEMPORARY STUB - To be refactored into Zustand store
 * Types moved to @/types/users
 */

export function useUserLocations() {
  return {
    locations: [],
    isLoading: false,
    reload: () => Promise.resolve(),
    updateUserLocations: () => Promise.resolve(),
  }
}

export type { UserLocationAccess } from '@/types/users'
