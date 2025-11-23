/**
 * useProductFilters Hook
 * Apple Standard: Consolidated filter state and logic
 *
 * Handles:
 * - Category, strain type, consistency, flavor filtering
 * - Search query filtering
 * - Location-aware filtering
 * - Available filter options extraction
 * - Active filter tracking
 */

import { useState, useMemo, useCallback } from 'react'
import type { Product } from '@/types/products'
import type { FilterOption, ActiveFilter } from '@/components/shared'

interface UseProductFiltersProps {
  products: Product[]
  categoryMap: Map<string, string>
  selectedLocationIds: string[]
  activeNav: 'all' | 'low-stock' | 'out-of-stock'
}

export interface UseProductFiltersReturn {
  // Filtered data
  filteredProducts: Product[]
  productSections: [string, Product[]][]

  // Filter state
  selectedCategories: string[]
  selectedStrainTypes: string[]
  selectedConsistencies: string[]
  selectedFlavors: string[]
  searchQuery: string

  // Available options
  availableStrainTypes: FilterOption[]
  availableConsistencies: FilterOption[]
  availableFlavors: FilterOption[]
  categoriesAsFilterOptions: FilterOption[]

  // Derived state
  activeFilterPills: ActiveFilter[]
  activeFilterCount: number

  // Actions
  setSearchQuery: (query: string) => void
  toggleCategory: (categoryName: string) => void
  toggleStrainType: (strainType: string) => void
  toggleConsistency: (consistency: string) => void
  toggleFlavor: (flavor: string) => void
  clearFilters: () => void
  removePill: (pill: ActiveFilter) => void
}

export function useProductFilters({
  products,
  categoryMap,
  selectedLocationIds,
  activeNav,
}: UseProductFiltersProps): UseProductFiltersReturn {
  // ========================================
  // STATE
  // ========================================
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedStrainTypes, setSelectedStrainTypes] = useState<string[]>([])
  const [selectedConsistencies, setSelectedConsistencies] = useState<string[]>([])
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // ========================================
  // AVAILABLE FILTER OPTIONS
  // ========================================
  const availableStrainTypes = useMemo((): FilterOption[] => {
    if (!products || !Array.isArray(products)) return []

    const strainTypes = new Set<string>()
    products.forEach(product => {
      if (product.custom_fields && typeof product.custom_fields === 'object') {
        const strainType = (product.custom_fields as any).strain_type
        if (strainType && typeof strainType === 'string' && strainType.trim()) {
          strainTypes.add(strainType.trim())
        }
      }
    })
    return Array.from(strainTypes).sort().map(name => ({ id: name, name }))
  }, [products])

  const availableConsistencies = useMemo((): FilterOption[] => {
    if (!products || !Array.isArray(products)) return []

    const consistencies = new Set<string>()
    products.forEach(product => {
      if (product.custom_fields && typeof product.custom_fields === 'object') {
        const consistency = (product.custom_fields as any).consistency
        if (consistency && typeof consistency === 'string' && consistency.trim()) {
          consistencies.add(consistency.trim())
        }
      }
    })
    return Array.from(consistencies).sort().map(name => ({ id: name, name }))
  }, [products])

  const availableFlavors = useMemo((): FilterOption[] => {
    if (!products || !Array.isArray(products)) return []

    const flavors = new Set<string>()
    products.forEach(product => {
      if (product.custom_fields && typeof product.custom_fields === 'object') {
        const flavor = (product.custom_fields as any).flavor
        if (flavor && typeof flavor === 'string' && flavor.trim()) {
          flavors.add(flavor.trim())
        }
      }
    })
    return Array.from(flavors).sort().map(name => ({ id: name, name }))
  }, [products])

  const categoriesAsFilterOptions = useMemo((): FilterOption[] => {
    const categories = Array.from(categoryMap.entries()).map(([id, name]) => ({ id, name }))
    return categories.sort((a, b) => a.name.localeCompare(b.name))
  }, [categoryMap])

  // ========================================
  // FILTERING LOGIC
  // ========================================
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return []

    const filtered = products.filter(product => {
      // Filter by location
      if (selectedLocationIds.length > 0) {
        const hasInventoryInSelectedLocations = product.inventory?.some(inv =>
          selectedLocationIds.includes(inv.location_id)
        )
        if (!hasInventoryInSelectedLocations) return false
      }

      // Filter by nav section
      if (activeNav === 'low-stock') {
        const stock = product.total_stock ?? 0
        if (!(stock > 0 && stock < 10)) return false
      } else if (activeNav === 'out-of-stock') {
        if ((product.total_stock ?? 0) !== 0) return false
      }

      // Filter by categories
      if (selectedCategories.length > 0) {
        const productCategoryName = product.primary_category_id
          ? categoryMap.get(product.primary_category_id)
          : null
        if (!productCategoryName || !selectedCategories.includes(productCategoryName)) {
          return false
        }
      }

      // Filter by strain types
      if (selectedStrainTypes.length > 0) {
        const productStrainType = product.custom_fields?.strain_type
        if (!productStrainType || !selectedStrainTypes.includes(productStrainType as string)) {
          return false
        }
      }

      // Filter by consistencies
      if (selectedConsistencies.length > 0) {
        const productConsistency = product.custom_fields?.consistency
        if (!productConsistency || !selectedConsistencies.includes(productConsistency as string)) {
          return false
        }
      }

      // Filter by flavors
      if (selectedFlavors.length > 0) {
        const productFlavor = product.custom_fields?.flavor
        if (!productFlavor || !selectedFlavors.includes(productFlavor as string)) {
          return false
        }
      }

      // Filter by search query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase()
        const nameMatch = product.name.toLowerCase().includes(searchLower)
        const skuMatch = product.sku?.toLowerCase().includes(searchLower)
        const categoryMatch = product.primary_category_id
          ? categoryMap.get(product.primary_category_id)?.toLowerCase().includes(searchLower)
          : false

        return nameMatch || skuMatch || categoryMatch
      }

      return true
    })

    // Sort alphabetically by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [products, activeNav, searchQuery, categoryMap, selectedLocationIds, selectedCategories, selectedStrainTypes, selectedConsistencies, selectedFlavors])

  // ========================================
  // PRODUCT SECTIONS (A-Z Grouping)
  // ========================================
  const productSections = useMemo((): [string, Product[]][] => {
    const sections = new Map<string, Product[]>()

    filteredProducts.forEach(product => {
      const firstLetter = product.name.charAt(0).toUpperCase()
      const letter = /[A-Z]/.test(firstLetter) ? firstLetter : '#'

      if (!sections.has(letter)) {
        sections.set(letter, [])
      }
      sections.get(letter)!.push(product)
    })

    // Convert to sorted array
    const sortedSections = Array.from(sections.entries())
      .sort(([a], [b]) => {
        if (a === '#') return 1
        if (b === '#') return -1
        return a.localeCompare(b)
      })

    return sortedSections
  }, [filteredProducts])

  // ========================================
  // ACTIVE FILTERS
  // ========================================
  const activeFilterPills = useMemo((): ActiveFilter[] => {
    const pills: ActiveFilter[] = []

    selectedCategories.forEach(cat => {
      pills.push({ id: `cat-${cat}`, label: cat, type: 'category' })
    })
    selectedStrainTypes.forEach(strain => {
      pills.push({ id: `strain-${strain}`, label: strain, type: 'strain' })
    })
    selectedConsistencies.forEach(cons => {
      pills.push({ id: `cons-${cons}`, label: cons, type: 'consistency' })
    })
    selectedFlavors.forEach(flavor => {
      pills.push({ id: `flavor-${flavor}`, label: flavor, type: 'flavor' })
    })

    return pills
  }, [selectedCategories, selectedStrainTypes, selectedConsistencies, selectedFlavors])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedCategories.length > 0) count += selectedCategories.length
    if (selectedStrainTypes.length > 0) count += selectedStrainTypes.length
    if (selectedConsistencies.length > 0) count += selectedConsistencies.length
    if (selectedFlavors.length > 0) count += selectedFlavors.length
    return count
  }, [selectedCategories, selectedStrainTypes, selectedConsistencies, selectedFlavors])

  // ========================================
  // ACTIONS
  // ========================================
  const toggleCategory = useCallback((categoryName: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    )
  }, [])

  const toggleStrainType = useCallback((strainType: string) => {
    setSelectedStrainTypes(prev =>
      prev.includes(strainType)
        ? prev.filter(s => s !== strainType)
        : [...prev, strainType]
    )
  }, [])

  const toggleConsistency = useCallback((consistency: string) => {
    setSelectedConsistencies(prev =>
      prev.includes(consistency)
        ? prev.filter(c => c !== consistency)
        : [...prev, consistency]
    )
  }, [])

  const toggleFlavor = useCallback((flavor: string) => {
    setSelectedFlavors(prev =>
      prev.includes(flavor)
        ? prev.filter(f => f !== flavor)
        : [...prev, flavor]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedCategories([])
    setSelectedStrainTypes([])
    setSelectedConsistencies([])
    setSelectedFlavors([])
  }, [])

  const removePill = useCallback((pill: ActiveFilter) => {
    switch (pill.type) {
      case 'category':
        setSelectedCategories(prev => prev.filter(c => c !== pill.label))
        break
      case 'strain':
        setSelectedStrainTypes(prev => prev.filter(s => s !== pill.label))
        break
      case 'consistency':
        setSelectedConsistencies(prev => prev.filter(c => c !== pill.label))
        break
      case 'flavor':
        setSelectedFlavors(prev => prev.filter(f => f !== pill.label))
        break
    }
  }, [])

  return {
    // Filtered data
    filteredProducts,
    productSections,

    // Filter state
    selectedCategories,
    selectedStrainTypes,
    selectedConsistencies,
    selectedFlavors,
    searchQuery,

    // Available options
    availableStrainTypes,
    availableConsistencies,
    availableFlavors,
    categoriesAsFilterOptions,

    // Derived state
    activeFilterPills,
    activeFilterCount,

    // Actions
    setSearchQuery,
    toggleCategory,
    toggleStrainType,
    toggleConsistency,
    toggleFlavor,
    clearFilters,
    removePill,
  }
}
