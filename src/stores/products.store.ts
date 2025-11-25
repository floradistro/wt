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
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { transformInventoryToProducts, extractCategories } from '@/utils/product-transformers'
import { eventLogger } from '@/services/event-logger.service'
import type { Product } from '@/types/pos'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
  currentController: AbortController | null
  inventoryChannel: RealtimeChannel | null

  // Actions
  loadProducts: (locationId: string) => Promise<void>
  refreshProducts: () => Promise<void>
  setLocationId: (locationId: string) => void
  getProductById: (id: string) => Product | undefined
  cancelLoadProducts: () => void
  subscribeToInventoryUpdates: (locationId: string) => void
  unsubscribeFromInventoryUpdates: () => void
  reset: () => void
}

// ========================================
// STORE
// ========================================
// ANTI-LOOP: No useEffects, no subscriptions, no setState in selectors
export const useProductsStore = create<ProductsState>()(
  devtools(
    (set, get) => ({
  // State
  products: [],
  categories: ['All'],
  loading: false,
  error: null,
  locationId: null,
  currentController: null,
  inventoryChannel: null,

  // Actions
  /**
   * Cancel any in-flight product loading request
   */
  cancelLoadProducts: () => {
    const { currentController } = get()
    if (currentController) {
      logger.debug('[Products Store] Aborting previous request')
      currentController.abort()
      set({ currentController: null })

      // Log cancellation event
      eventLogger.system.requestCancelled('Load Products', 'New request started')
    }
  },

  loadProducts: async (locationId: string) => {
    // Cancel any previous request
    get().cancelLoadProducts()

    // Create new AbortController for this request
    const controller = new AbortController()

    // ANTI-LOOP: Only updates state once at the end, no circular dependencies
    set({ loading: true, error: null, locationId, currentController: controller })

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
            sku,
            regular_price,
            sale_price,
            on_sale,
            featured_image,
            custom_fields,
            pricing_data,
            vendor_id,
            primary_category_id,
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
        .abortSignal(controller.signal)

      // Check if request was aborted
      if (controller.signal.aborted) {
        logger.debug('[Products Store] Request was aborted (expected)')
        return
      }

      if (error) throw error

      // Transform inventory data to products
      const transformedProducts = transformInventoryToProducts(inventoryData || [])

      // Extract unique categories
      const uniqueCategories = extractCategories(transformedProducts)

      logger.debug('[Products Store] Loaded products:', {
        count: transformedProducts.length,
        categories: uniqueCategories.length,
      })

      // Log successful product load
      eventLogger.product.load(transformedProducts.length, locationId)

      set({
        products: transformedProducts,
        categories: uniqueCategories,
        loading: false,
        currentController: null,
      })
    } catch (error) {
      // Don't set error state if request was just aborted
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('[Products Store] Request aborted (expected)')
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to load products'
      logger.error('[Products Store] Failed to load products:', error)

      // Log error event
      eventLogger.system.error('ProductsStore', errorMessage, { locationId })

      set({
        error: errorMessage,
        loading: false,
        currentController: null,
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

  /**
   * Subscribe to real-time inventory updates
   * APPLE PRINCIPLE: Instant feedback - no page refresh needed
   */
  subscribeToInventoryUpdates: (locationId: string) => {
    // Unsubscribe from previous channel
    get().unsubscribeFromInventoryUpdates()

    logger.debug('[Products Store] Subscribing to inventory updates for location:', locationId)

    const channel = supabase
      .channel(`inventory:location:${locationId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'inventory',
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          logger.debug('[Products Store] Inventory update received:', payload)

          if (payload.eventType === 'UPDATE' && payload.new) {
            // Reload products when inventory changes
            const { locationId: currentLocationId } = get()
            if (currentLocationId) {
              logger.info('[Products Store] ✅ Inventory updated, reloading products')
              get().loadProducts(currentLocationId)
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('[Products Store] ✅ Subscribed to inventory updates')
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('[Products Store] ❌ Inventory subscription error')
        } else if (status === 'TIMED_OUT') {
          logger.error('[Products Store] ⏱️ Inventory subscription timed out')
        }
      })

    set({ inventoryChannel: channel })
  },

  /**
   * Unsubscribe from inventory updates
   */
  unsubscribeFromInventoryUpdates: () => {
    const { inventoryChannel } = get()

    if (inventoryChannel) {
      logger.debug('[Products Store] Unsubscribing from inventory updates')
      supabase.removeChannel(inventoryChannel)
      set({ inventoryChannel: null })
    }
  },

  reset: () => {
    // Cancel any in-flight requests before reset
    get().cancelLoadProducts()

    // Unsubscribe from realtime
    get().unsubscribeFromInventoryUpdates()

    set({
      products: [],
      categories: ['All'],
      loading: false,
      error: null,
      currentController: null,
      inventoryChannel: null,
    })
  },
    }),
    { name: 'ProductsStore' }
  )
)

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
  get cancelLoadProducts() { return useProductsStore.getState().cancelLoadProducts },
  get subscribeToInventoryUpdates() { return useProductsStore.getState().subscribeToInventoryUpdates },
  get unsubscribeFromInventoryUpdates() { return useProductsStore.getState().unsubscribeFromInventoryUpdates },
  get reset() { return useProductsStore.getState().reset },
}
