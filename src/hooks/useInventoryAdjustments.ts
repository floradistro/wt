/**
 * TEMPORARY STUB - To be refactored into Zustand store
 */

export function useInventoryAdjustments(_options?: any) {
  return {
    adjustments: [],
    stats: { totalAdjustments: 0, totalValue: 0 },
    isLoading: false,
    reload: () => Promise.resolve(),
    createAdjustment: () => Promise.resolve({} as any),
  }
}
