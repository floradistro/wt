/**
 * Product Filter Store - Apple Engineering Standard
 *
 * Principle: Filter state is global, not component-specific
 * Replaces: useFilters hook (local state)
 *
 * Benefits:
 * - Zero prop drilling for filter state
 * - Filters accessible anywhere in app
 * - Redux DevTools visibility
 * - Derived state computed once, shared everywhere
 * - Pure visual components with no business logic props
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { Product } from '@/types/pos'
import {
  applyFilters,
  countActiveFilters,
  getMatchingFilters,
  extractFieldValues,
  type ProductFilters,
} from '@/utils/product-transformers'
import { useProductsStore } from './products.store'

interface ProductFilterState {
  // State
  filters: ProductFilters

  // Actions
  setSearchQuery: (query: string) => void
  setCategory: (category: string) => void
  toggleStrainType: (strainType: string) => void
  toggleConsistency: (consistency: string) => void
  toggleFlavor: (flavor: string) => void
  clearFilters: () => void
  reset: () => void
}

const initialFilters: ProductFilters = {
  searchQuery: '',
  category: 'All',
  strainTypes: [],
  consistencies: [],
  flavors: [],
}

export const useProductFilterStore = create<ProductFilterState>()(
  devtools(
    (set, get) => ({
      // Initial state
      filters: initialFilters,

      /**
       * Set search query
       * ANTI-LOOP: Simple setState - no side effects
       */
      setSearchQuery: (query: string) => {
        set(
          (state) => ({
            filters: { ...state.filters, searchQuery: query },
          }),
          false,
          'productFilter/setSearchQuery'
        )
      },

      /**
       * Set category filter
       * ANTI-LOOP: Simple setState - no side effects
       */
      setCategory: (category: string) => {
        set(
          (state) => ({
            filters: { ...state.filters, category },
          }),
          false,
          'productFilter/setCategory'
        )
      },

      /**
       * Toggle strain type (multi-select)
       * ANTI-LOOP: Simple setState - no side effects
       */
      toggleStrainType: (strainType: string) => {
        set(
          (state) => {
            const current = state.filters.strainTypes
            const updated = current.includes(strainType)
              ? current.filter((s) => s !== strainType)
              : [...current, strainType]
            return {
              filters: { ...state.filters, strainTypes: updated },
            }
          },
          false,
          'productFilter/toggleStrainType'
        )
      },

      /**
       * Toggle consistency (multi-select)
       * ANTI-LOOP: Simple setState - no side effects
       */
      toggleConsistency: (consistency: string) => {
        set(
          (state) => {
            const current = state.filters.consistencies
            const updated = current.includes(consistency)
              ? current.filter((c) => c !== consistency)
              : [...current, consistency]
            return {
              filters: { ...state.filters, consistencies: updated },
            }
          },
          false,
          'productFilter/toggleConsistency'
        )
      },

      /**
       * Toggle flavor (multi-select)
       * ANTI-LOOP: Simple setState - no side effects
       */
      toggleFlavor: (flavor: string) => {
        set(
          (state) => {
            const current = state.filters.flavors
            const updated = current.includes(flavor)
              ? current.filter((f) => f !== flavor)
              : [...current, flavor]
            return {
              filters: { ...state.filters, flavors: updated },
            }
          },
          false,
          'productFilter/toggleFlavor'
        )
      },

      /**
       * Clear all filters
       * ANTI-LOOP: Simple setState - no side effects
       */
      clearFilters: () => {
        set({ filters: initialFilters }, false, 'productFilter/clearFilters')
      },

      /**
       * Reset entire store
       */
      reset: () => {
        set({ filters: initialFilters }, false, 'productFilter/reset')
      },
    }),
    { name: 'ProductFilterStore' }
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get current filters
export const useProductFilters = () =>
  useProductFilterStore((state) => state.filters)

// Get search query
export const useSearchQuery = () =>
  useProductFilterStore((state) => state.filters.searchQuery)

// Get category
export const useCategory = () =>
  useProductFilterStore((state) => state.filters.category)

/**
 * ❌ DELETED COMPUTED SELECTORS - Caused infinite re-renders
 *
 * The following selectors were deleted:
 * - useFilteredProducts
 * - useAvailableStrainTypes
 * - useAvailableConsistencies
 * - useAvailableFlavors
 * - useMatchingFiltersMap
 * - useProductFilterState
 *
 * ✅ USE THIS PATTERN INSTEAD in components:
 *
 * import { useMemo } from 'react'
 * import { useProductsStore } from '@/stores/products.store'
 * import { useProductFilters, productFilterActions } from '@/stores/product-filter.store'
 * import { applyFilters, extractFieldValues } from './utils'
 *
 * // In component:
 * const products = useProductsStore((state) => state.products)
 * const filters = useProductFilters()
 *
 * const filteredProducts = useMemo(() =>
 *   applyFilters(products, filters),
 *   [products, filters]
 * )
 *
 * const availableStrainTypes = useMemo(() =>
 *   extractFieldValues(products, 'strain_type'),
 *   [products]
 * )
 *
 * // etc. for other computed values
 */

// Get active filter count (primitive only - safe)
export const useActiveFilterCount = () =>
  useProductFilterStore((state) => countActiveFilters(state.filters))

// Export filter actions as plain object (not a hook!)
export const productFilterActions = {
  get setSearchQuery() {
    return useProductFilterStore.getState().setSearchQuery
  },
  get setCategory() {
    return useProductFilterStore.getState().setCategory
  },
  get toggleStrainType() {
    return useProductFilterStore.getState().toggleStrainType
  },
  get toggleConsistency() {
    return useProductFilterStore.getState().toggleConsistency
  },
  get toggleFlavor() {
    return useProductFilterStore.getState().toggleFlavor
  },
  get clearFilters() {
    return useProductFilterStore.getState().clearFilters
  },
  get reset() {
    return useProductFilterStore.getState().reset
  },
}
