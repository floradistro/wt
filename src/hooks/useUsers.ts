/**
 * TEMPORARY STUB - To be refactored into Zustand store
 * Types moved to @/types/users
 */

export function useUsers(_vendorId?: string) {
  return {
    users: [],
    isLoading: false,
    reload: () => Promise.resolve(),
    createUser: () => Promise.resolve({} as any),
    updateUser: () => Promise.resolve({} as any),
    deleteUser: () => Promise.resolve(),
  }
}
