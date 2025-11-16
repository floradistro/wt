/**
 * useFilters Hook
 * Consolidated filter state management
 * Jobs Principle: One source of truth for all filters
 */

import { useState, useCallback, useMemo } from 'react'
import type { Product } from '@/types/pos'
import {
  applyFilters,
  countActiveFilters,
  getMatchingFilters,
  extractFieldValues,
  type ProductFilters,
} from '@/utils/product-transformers'

export function useFilters(products: Product[]) {
  const [filters, setFilters] = useState<ProductFilters>({
    searchQuery: '',
    category: 'All',
    strainTypes: [],
    consistencies: [],
    flavors: [],
  })

  // Set search query
  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }))
  }, [])

  // Set category
  const setCategory = useCallback((category: string) => {
    setFilters((prev) => ({ ...prev, category }))
  }, [])

  // Toggle strain type (multi-select)
  const toggleStrainType = useCallback((strainType: string) => {
    setFilters((prev) => {
      const current = prev.strainTypes
      const updated = current.includes(strainType)
        ? current.filter((s) => s !== strainType)
        : [...current, strainType]
      return { ...prev, strainTypes: updated }
    })
  }, [])

  // Toggle consistency (multi-select)
  const toggleConsistency = useCallback((consistency: string) => {
    setFilters((prev) => {
      const current = prev.consistencies
      const updated = current.includes(consistency)
        ? current.filter((c) => c !== consistency)
        : [...current, consistency]
      return { ...prev, consistencies: updated }
    })
  }, [])

  // Toggle flavor (multi-select)
  const toggleFlavor = useCallback((flavor: string) => {
    setFilters((prev) => {
      const current = prev.flavors
      const updated = current.includes(flavor)
        ? current.filter((f) => f !== flavor)
        : [...current, flavor]
      return { ...prev, flavors: updated }
    })
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      category: 'All',
      strainTypes: [],
      consistencies: [],
      flavors: [],
    })
  }, [])

  // Apply filters to products (memoized)
  const filteredProducts = useMemo(
    () => applyFilters(products, filters),
    [products, filters]
  )

  // Get available filter options (memoized)
  const availableStrainTypes = useMemo(
    () => extractFieldValues(products, 'strain_type'),
    [products]
  )

  const availableConsistencies = useMemo(
    () => extractFieldValues(products.filter((p) => p.category === 'Concentrates'), 'consistency'),
    [products]
  )

  const availableFlavors = useMemo(
    () => extractFieldValues(products, 'flavor'),
    [products]
  )

  // Count active filters (memoized)
  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  )

  // Get matching filters map for highlighting (memoized)
  const matchingFiltersMap = useMemo(() => {
    const map = new Map<string, string[]>()
    filteredProducts.forEach((product) => {
      const matching = getMatchingFilters(product, filters)
      if (matching.length > 0) {
        map.set(product.id, matching)
      }
    })
    return map
  }, [filteredProducts, filters])

  return {
    // State
    filters,
    filteredProducts,
    activeFilterCount,
    matchingFiltersMap,

    // Available options
    availableStrainTypes,
    availableConsistencies,
    availableFlavors,

    // Actions
    setSearchQuery,
    setCategory,
    toggleStrainType,
    toggleConsistency,
    toggleFlavor,
    clearFilters,
  }
}
