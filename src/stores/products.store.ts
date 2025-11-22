/**
 * Products Store
 * Jobs Principle: Single source of truth for product catalog
 *
 * ANTI-LOOP DESIGN:
 * - ✅ All selectors ONLY return values (no setState, no calculations)
 * - ✅ All mutations happen in actions
 * - ✅ No subscriptions that call setState in the store itself
 * - ✅ No useEffects (stores don't use React hooks)
 * - ✅ Actions exported as plain objects with getters
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { transformInventoryToProducts, extractCategories } from '@/utils/product-transformers'
import type { Product } from '@/types/pos'

// ========================================
// TYPES
// ========================================
interface ProductsState {
  // State
  products: Product[]
  categories: string[]
  loading: boolean
  error: string | null
  locationId: string | null

  // Actions
  loadProducts: (locationId: string) => Promise<void>
  refreshProducts: () => Promise<void>
  setLocationId: (locationId: string) => void
  getProductById: (id: string) => Product | undefined
  reset: () => void
}

// ========================================
// STORE
// ========================================
// ANTI-LOOP: No useEffects, no subscriptions, no setState in selectors
export const useProductsStore = create<ProductsState>((set, get) => ({
  // State
  products: [],
  categories: ['All'],
  loading: false,
  error: null,
  locationId: null,

  // Actions
  loadProducts: async (locationId: string) => {
    // ANTI-LOOP: Only updates state once at the end, no circular dependencies
    set({ loading: true, error: null, locationId })

    try {
      logger.debug('[Products Store] Loading products for location:', locationId)

      const { data: inventoryData, error } = await supabase
        .from('inventory')
        .select(`
          id,
          product_id,
          quantity,
          reserved_quantity,
          available_quantity,
          products (
            id,
            name,
            regular_price,
            featured_image,
            description,
            short_description,
            custom_fields,
            pricing_data,
            vendor_id,
            primary_category:categories!primary_category_id(id, name),
            product_categories (
              categories (
                name
              )
            ),
            vendors (
              id,
              store_name,
              logo_url
            )
          )
        `)
        .eq('location_id', locationId)
        .gt('quantity', 0)

      if (error) throw error

      // Transform inventory data to products
      const transformedProducts = transformInventoryToProducts(inventoryData || [])

      // Extract unique categories
      const uniqueCategories = extractCategories(transformedProducts)

      logger.debug('[Products Store] Loaded products:', {
        count: transformedProducts.length,
        categories: uniqueCategories.length,
      })

      set({
        products: transformedProducts,
        categories: uniqueCategories,
        loading: false,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load products'
      logger.error('[Products Store] Failed to load products:', error)
      set({
        error: errorMessage,
        loading: false,
      })
    }
  },

  refreshProducts: async () => {
    // ANTI-LOOP: Uses current locationId from state, no circular dependencies
    const { locationId } = get()

    if (!locationId) {
      logger.warn('[Products Store] Cannot refresh: no locationId set')
      return
    }

    // Reuse loadProducts logic
    await get().loadProducts(locationId)
  },

  setLocationId: (locationId: string) => {
    // ANTI-LOOP: Only sets value - no side effects
    // Components are responsible for calling loadProducts when needed
    set({ locationId })
  },

  /**
   * Get product by ID
   * ANTI-LOOP: Pure function - reads state, returns value, NO setState
   */
  getProductById: (id: string) => {
    const { products } = get()
    return products.find((p) => p.id === id)
  },

  reset: () => {
    set({
      products: [],
      categories: ['All'],
      loading: false,
      error: null,
    })
  },
}))

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================
// ✅ Primitive values - direct selectors (no useShallow needed)
export const useProducts = () =>
  useProductsStore((state) => state.products)

export const useProductCategories = () =>
  useProductsStore((state) => state.categories)

export const useProductsLoading = () =>
  useProductsStore((state) => state.loading)

// ✅ Object return - use useShallow to prevent infinite re-renders
export const useProductsState = () =>
  useProductsStore(
    useShallow((state) => ({
      products: state.products,
      categories: state.categories,
      loading: state.loading,
      error: state.error,
    }))
  )

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters, NOT hooks)
// ========================================
// ✅ CORRECT: Direct action imports (no subscription loop)
export const productsActions = {
  get loadProducts() { return useProductsStore.getState().loadProducts },
  get refreshProducts() { return useProductsStore.getState().refreshProducts },
  get setLocationId() { return useProductsStore.getState().setLocationId },
  get getProductById() { return useProductsStore.getState().getProductById },
  get reset() { return useProductsStore.getState().reset },
}
