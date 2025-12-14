/**
 * POS Products Store
 * Jobs Principle: Single source of truth for POS product catalog
 *
 * CRITICAL: Separate from products.store to prevent conflicts with ProductsScreen
 * POS Requirements:
 * - ONLY in-stock products
 * - ONLY at current location
 * - ONLY for current vendor
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
import { transformProductsData, extractCategories } from '@/utils/product-transformers'
import { eventLogger } from '@/services/event-logger.service'
import type { Product } from '@/types/pos'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ========================================
// TYPES
// ========================================
interface POSProductsState {
  // State
  products: Product[]
  categories: string[]
  loading: boolean
  error: string | null
  locationId: string | null
  vendorId: string | null
  currentController: AbortController | null
  inventoryChannel: RealtimeChannel | null
  pricingChannel: RealtimeChannel | null

  // Actions
  loadProducts: (locationId: string, vendorId: string) => Promise<void>
  refreshProducts: () => Promise<void>
  setLocation: (locationId: string, vendorId: string) => void
  getProductById: (id: string) => Product | undefined
  cancelLoadProducts: () => void
  subscribeToInventoryUpdates: () => void
  unsubscribeFromInventoryUpdates: () => void
  subscribeToPricingUpdates: () => void
  unsubscribeFromPricingUpdates: () => void
  reset: () => void
}

// ========================================
// STORE
// ========================================
export const usePOSProductsStore = create<POSProductsState>()(
  devtools(
    (set, get) => ({
  // State
  products: [],
  categories: ['All'],
  loading: false,
  error: null,
  locationId: null,
  vendorId: null,
  currentController: null,
  inventoryChannel: null,
  pricingChannel: null,

  // Actions
  /**
   * Cancel any in-flight product loading request
   */
  cancelLoadProducts: () => {
    const { currentController } = get()
    if (currentController) {
      logger.debug('[POS Products Store] Aborting previous request')
      currentController.abort()
      set({ currentController: null })

      eventLogger.system.requestCancelled('Load POS Products', 'New request started')
    }
  },

  /**
   * Load products for POS - ONLY in-stock products at current location for current vendor
   * CRITICAL: This is POS-specific and separate from ProductsScreen data
   */
  loadProducts: async (locationId: string, vendorId: string) => {
    // Cancel any previous request
    get().cancelLoadProducts()

    // Create new AbortController for this request
    const controller = new AbortController()

    set({ loading: true, error: null, locationId, vendorId, currentController: controller })

    try {
      logger.debug('[POS Products Store] Loading IN-STOCK products for current location + vendor', {
        locationId,
        vendorId,
      })

      // Query from products table with vendor filter
      const query = supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          sku,
          regular_price,
          sale_price,
          on_sale,
          featured_image,
          custom_fields,
          pricing_data,
          vendor_id,
          primary_category_id,
          pricing_template_id,
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
          ),
          pricing_template:pricing_tier_templates (
            id,
            name,
            default_tiers
          )
        `)
        .eq('vendor_id', vendorId) // CRITICAL: Only current vendor's products

      const { data: productsData, error } = await query.abortSignal(controller.signal)

      // Fetch inventory for current location only
      const productIds = productsData?.map(p => p.id) || []

      const { data: inventoryData } = productIds.length > 0 ? await supabase
        .from('inventory_with_holds')
        .select(`
          id,
          product_id,
          location_id,
          total_quantity,
          held_quantity,
          available_quantity,
          locations (
            name
          )
        `)
        .in('product_id', productIds)
        .eq('location_id', locationId) // CRITICAL: Only current location
        : { data: [] }

      // Merge inventory data into products
      if (productsData && inventoryData) {
        productsData.forEach((product: any) => {
          product.inventory = inventoryData.filter(inv => inv.product_id === product.id)
        })
      }

      // Check if request was aborted
      if (controller.signal.aborted) {
        logger.debug('[POS Products Store] Request was aborted (expected)')
        return
      }

      if (error) throw error

      // Transform products data
      let transformedProducts = transformProductsData(productsData || [], locationId)

      // CRITICAL: POS ONLY shows in-stock products
      transformedProducts = transformedProducts.filter(p => (p.inventory_quantity || 0) > 0)

      logger.info('[POS Products Store] ✅ Loaded IN-STOCK products for POS:', {
        totalProducts: productsData?.length || 0,
        inStockProducts: transformedProducts.length,
        locationId,
        vendorId,
      })

      // Extract unique categories
      const uniqueCategories = extractCategories(transformedProducts)

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
        logger.debug('[POS Products Store] Request aborted (expected)')
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to load POS products'
      logger.error('[POS Products Store] Failed to load products:', error)

      eventLogger.system.error('POSProductsStore', errorMessage, { locationId, vendorId })

      set({
        error: errorMessage,
        loading: false,
        currentController: null,
      })
    }
  },

  refreshProducts: async () => {
    const { locationId, vendorId } = get()

    if (!locationId || !vendorId) {
      logger.warn('[POS Products Store] Cannot refresh: no locationId or vendorId set')
      return
    }

    await get().loadProducts(locationId, vendorId)
  },

  setLocation: (locationId: string, vendorId: string) => {
    set({ locationId, vendorId })
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
   * Subscribe to real-time inventory updates for current location
   * APPLE PRINCIPLE: Instant feedback - no page refresh needed
   */
  subscribeToInventoryUpdates: () => {
    const { locationId, inventoryChannel } = get()

    if (!locationId) {
      logger.warn('[POS Products Store] Cannot subscribe: no locationId set')
      return
    }

    // Don't subscribe if already subscribed
    if (inventoryChannel) {
      logger.debug('[POS Products Store] Already subscribed to inventory updates')
      return
    }

    const channel = supabase
      .channel(`pos-inventory:location:${locationId}`)
      // Listen to inventory table changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          get().refreshProducts()
        }
      )
      // Listen to inventory_holds changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_holds',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          get().refreshProducts()
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.error('[POS Products Store] ❌ Inventory subscription error')
        } else if (status === 'TIMED_OUT') {
          logger.error('[POS Products Store] ⏱️ Inventory subscription timed out')
        }
      })

    set({ inventoryChannel: channel })
  },

  unsubscribeFromInventoryUpdates: () => {
    const { inventoryChannel } = get()

    if (inventoryChannel) {
      logger.debug('[POS Products Store] Unsubscribing from inventory updates')
      supabase.removeChannel(inventoryChannel)
      set({ inventoryChannel: null })
    }
  },

  /**
   * Subscribe to pricing template updates for current vendor
   */
  subscribeToPricingUpdates: () => {
    const { vendorId, pricingChannel } = get()

    if (!vendorId) {
      logger.warn('[POS Products Store] Cannot subscribe: no vendorId set')
      return
    }

    // Don't subscribe if already subscribed
    if (pricingChannel) {
      logger.debug('[POS Products Store] Already subscribed to pricing updates')
      return
    }

    const channel = supabase
      .channel(`pos-pricing:vendor:${vendorId}`)
      // Listen to pricing_tier_templates changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pricing_tier_templates',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          logger.info('🔔 POS: PRICING TEMPLATE UPDATED', {
            templateId: payload.new?.id,
            templateName: payload.new?.name,
          })
          get().refreshProducts()
        }
      )
      // Listen to products table changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          const oldTemplateId = payload.old?.pricing_template_id
          const newTemplateId = payload.new?.pricing_template_id
          const oldMetaData = JSON.stringify(payload.old?.meta_data)
          const newMetaData = JSON.stringify(payload.new?.meta_data)

          if (oldTemplateId !== newTemplateId || oldMetaData !== newMetaData) {
            logger.info('🔔 POS: PRODUCT UPDATED', {
              productId: payload.new?.id,
              templateChanged: oldTemplateId !== newTemplateId,
            })
            get().refreshProducts()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.error('[POS Products Store] ❌ Pricing subscription error')
        }
      })

    set({ pricingChannel: channel })
  },

  unsubscribeFromPricingUpdates: () => {
    const { pricingChannel } = get()

    if (pricingChannel) {
      logger.debug('[POS Products Store] Unsubscribing from pricing updates')
      supabase.removeChannel(pricingChannel)
      set({ pricingChannel: null })
    }
  },

  reset: () => {
    // Cancel any in-flight requests
    get().cancelLoadProducts()

    // Unsubscribe from all updates
    get().unsubscribeFromInventoryUpdates()
    get().unsubscribeFromPricingUpdates()

    set({
      products: [],
      categories: ['All'],
      loading: false,
      error: null,
      locationId: null,
      vendorId: null,
      currentController: null,
      inventoryChannel: null,
      pricingChannel: null,
    })
  },
    }),
    { name: 'POSProductsStore' }
  )
)

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================
export const usePOSProducts = () =>
  usePOSProductsStore((state) => state.products)

export const usePOSProductCategories = () =>
  usePOSProductsStore((state) => state.categories)

export const usePOSProductsLoading = () =>
  usePOSProductsStore((state) => state.loading)

export const usePOSProductsState = () =>
  usePOSProductsStore(
    useShallow((state) => ({
      products: state.products,
      categories: state.categories,
      loading: state.loading,
      error: state.error,
    }))
  )

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters)
// ========================================
export const posProductsActions = {
  get loadProducts() { return usePOSProductsStore.getState().loadProducts },
  get refreshProducts() { return usePOSProductsStore.getState().refreshProducts },
  get setLocation() { return usePOSProductsStore.getState().setLocation },
  get getProductById() { return usePOSProductsStore.getState().getProductById },
  get cancelLoadProducts() { return usePOSProductsStore.getState().cancelLoadProducts },
  get subscribeToInventoryUpdates() { return usePOSProductsStore.getState().subscribeToInventoryUpdates },
  get unsubscribeFromInventoryUpdates() { return usePOSProductsStore.getState().unsubscribeFromInventoryUpdates },
  get subscribeToPricingUpdates() { return usePOSProductsStore.getState().subscribeToPricingUpdates },
  get unsubscribeFromPricingUpdates() { return usePOSProductsStore.getState().unsubscribeFromPricingUpdates },
  get reset() { return usePOSProductsStore.getState().reset },
}
