/**
 * TEMPORARY STUB - To be refactored into Zustand store
 */

export function useCategories(_options?: any) {
  return {
    categories: [],
    isLoading: false,
    reload: () => Promise.resolve(),
  }
}
