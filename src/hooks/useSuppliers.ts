/**
 * TEMPORARY STUB - To be refactored into Zustand store
 * Use suppliers-management.store.ts instead
 */

export function useSuppliers() {
  return {
    suppliers: [],
    isLoading: false,
    reload: () => Promise.resolve(),
    createSupplier: () => Promise.resolve({} as any),
    updateSupplier: () => Promise.resolve({} as any),
    deleteSupplier: () => Promise.resolve(),
  }
}
