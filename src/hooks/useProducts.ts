/**
 * TEMPORARY STUB - To be refactored into Zustand store
 * Use products.store.ts instead
 */

export function useProducts(_options?: any) {
  return {
    products: [],
    isLoading: false,
    reload: () => Promise.resolve(),
  }
}

// Re-export types from @/types/products
export type { Product } from '@/types/products'
