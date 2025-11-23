/**
 * TEMPORARY STUB - To be refactored into Zustand store
 */

export function useSalesHistory(_productId?: string, _options?: any) {
  return {
    sales: [],
    stats: { totalSales: 0, totalRevenue: 0, averagePrice: 0 },
    isLoading: false,
  }
}
