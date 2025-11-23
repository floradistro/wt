/**
 * useProducts Hook
 * Wrapper around products.store.ts for compatibility
 */

import { useEffect } from 'react'
import { useProductsStore, productsActions } from '@/stores/products.store'
import { useAuthStore } from '@/stores/auth.store'
import { useLocationFilter } from '@/stores/location-filter.store'

interface UseProductsOptions {
  search?: string
  categoryId?: string | null
}

export function useProducts(options?: UseProductsOptions) {
  const products = useProductsStore(state => state.products)
  const loading = useProductsStore(state => state.loading)
  const error = useProductsStore(state => state.error)
  const storeLocationId = useProductsStore(state => state.locationId)

  const { selectedLocationIds } = useLocationFilter()
  const vendorId = useAuthStore(state => state.user?.id)

  // Load products when location changes
  useEffect(() => {
    // Use first selected location or fall back to vendor-wide query
    const locationId = selectedLocationIds[0] || vendorId

    if (locationId && locationId !== storeLocationId) {
      productsActions.loadProducts(locationId)
    }
  }, [selectedLocationIds, vendorId, storeLocationId])

  // Filter products based on search/category if provided
  let filteredProducts = products

  if (options?.search) {
    const searchLower = options.search.toLowerCase()
    filteredProducts = filteredProducts.filter(p =>
      p.name?.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower)
    )
  }

  if (options?.categoryId) {
    filteredProducts = filteredProducts.filter(p =>
      p.primary_category_id === options.categoryId
    )
  }

  return {
    products: filteredProducts,
    isLoading: loading,
    error,
    reload: productsActions.refreshProducts,
  }
}

// Re-export types from @/types/products
export type { Product } from '@/types/products'
