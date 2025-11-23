/**
 * TEMPORARY STUB - To be refactored into Zustand store
 */

export function usePurchaseOrders(_options?: any) {
  return {
    purchaseOrders: [],
    stats: { pending: 0, received: 0, totalValue: 0 },
    isLoading: false,
    reload: () => Promise.resolve(),
  }
}
