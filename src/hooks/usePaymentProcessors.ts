/**
 * TEMPORARY STUB - To be refactored into Zustand store
 * Use payment-processor.store.ts instead
 */

export function usePaymentProcessors() {
  return {
    processors: [],
    isLoading: false,
    reload: () => Promise.resolve(),
    createProcessor: () => Promise.resolve({} as any),
    updateProcessor: () => Promise.resolve({} as any),
    deleteProcessor: () => Promise.resolve(),
    testConnection: () => Promise.resolve({ success: true }),
  }
}
