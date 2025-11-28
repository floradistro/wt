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
import { transformProductsData, extractCategories } from '@/utils/product-transformers'
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
  inventoryChannels: Map<string, RealtimeChannel> // Map of locationId -> channel
  pricingChannel: RealtimeChannel | null // Real-time pricing updates

  // Actions
  loadProducts: (locationId: string, vendorId?: string) => Promise<void>
  refreshProducts: () => Promise<void>
  setLocationId: (locationId: string) => void
  getProductById: (id: string) => Product | undefined
  cancelLoadProducts: () => void
  subscribeToInventoryUpdates: (locationId: string) => void
  unsubscribeFromInventoryUpdates: (locationId?: string) => void
  subscribeToPricingUpdates: (vendorId: string) => void
  unsubscribeFromPricingUpdates: () => void
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
  inventoryChannels: new Map(),
  pricingChannel: null,

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

  loadProducts: async (locationId: string, vendorId?: string, onlyInStock: boolean = false) => {
    // Cancel any previous request
    get().cancelLoadProducts()

    // Create new AbortController for this request
    const controller = new AbortController()

    // ANTI-LOOP: Only updates state once at the end, no circular dependencies
    set({ loading: true, error: null, locationId, currentController: controller })

    try {
      logger.debug('[Products Store] Loading ALL products (including out of stock)', { vendorId })

      // Query from products table to get ALL products, then fetch inventory separately
      // This ensures products without inventory records still appear
      let query = supabase
        .from('products')
        .select(`
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

      // Add vendor filter if provided
      if (vendorId) {
        query = query.eq('vendor_id', vendorId)
      }

      const { data: productsData, error } = await query.abortSignal(controller.signal)

      // Fetch inventory separately for all products
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
        .eq('location_id', locationId)
        : { data: [] }

      // Merge inventory data into products
      if (productsData && inventoryData) {
        productsData.forEach((product: any) => {
          product.inventory = inventoryData.filter(inv => inv.product_id === product.id)
        })
      }

      // Check if request was aborted
      if (controller.signal.aborted) {
        logger.debug('[Products Store] Request was aborted (expected)')
        return
      }

      if (error) throw error

      // Transform products data (ALL products including out of stock)
      // Filter inventory to only selected location
      let transformedProducts = transformProductsData(productsData || [], locationId)

      // Filter to only in-stock products if requested (for POS)
      if (onlyInStock) {
        transformedProducts = transformedProducts.filter(p => (p.inventory_quantity || 0) > 0)
        logger.debug('[Products Store] Filtered to in-stock only:', {
          totalProducts: productsData?.length || 0,
          inStockProducts: transformedProducts.length,
        })
      }

      // Extract unique categories
      const uniqueCategories = extractCategories(transformedProducts)

      logger.debug('[Products Store] Loaded products:', {
        count: transformedProducts.length,
        categories: uniqueCategories.length,
        onlyInStock,
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
      // Silently skip refresh if no locationId (management view doesn't need real-time refresh)
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
   * Subscribe to real-time inventory updates for a location
   * APPLE PRINCIPLE: Instant feedback - no page refresh needed
   *
   * Listens to BOTH inventory AND inventory_holds tables
   * because available quantity = total - held
   *
   * Supports MULTIPLE location subscriptions simultaneously
   */
  subscribeToInventoryUpdates: (locationId: string) => {
    const { inventoryChannels } = get()

    // Don't subscribe if already subscribed to this location
    if (inventoryChannels.has(locationId)) {
      logger.debug('[Products Store] Already subscribed to location:', locationId)
      return
    }

    const channel = supabase
      .channel(`inventory:location:${locationId}`)
      // Listen to inventory table changes (quantity updates)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'inventory',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          get().refreshProducts()
        }
      )
      // Listen to inventory_holds changes (holds created/released)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT (hold created), UPDATE (hold released)
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
          logger.error('[Products Store] ❌ Subscription error for location:', locationId)
        } else if (status === 'TIMED_OUT') {
          logger.error('[Products Store] ⏱️ Subscription timed out for location:', locationId)
        }
      })

    // Store the channel
    inventoryChannels.set(locationId, channel)
    set({ inventoryChannels: new Map(inventoryChannels) })
  },

  /**
   * Unsubscribe from inventory updates
   * If locationId provided, unsubscribe from that location only
   * If no locationId, unsubscribe from ALL locations
   */
  unsubscribeFromInventoryUpdates: (locationId?: string) => {
    const { inventoryChannels } = get()

    if (locationId) {
      // Unsubscribe from specific location
      const channel = inventoryChannels.get(locationId)
      if (channel) {
        logger.debug('[Products Store] Unsubscribing from location:', locationId)
        supabase.removeChannel(channel)
        inventoryChannels.delete(locationId)
        set({ inventoryChannels: new Map(inventoryChannels) })
      }
    } else {
      // Unsubscribe from ALL locations
      if (inventoryChannels.size > 0) {
        logger.debug('[Products Store] Unsubscribing from all locations:', inventoryChannels.size)
        inventoryChannels.forEach((channel) => {
          supabase.removeChannel(channel)
        })
        set({ inventoryChannels: new Map() })
      }
    }
  },

  /**
   * Subscribe to pricing template and product meta_data changes
   * When a pricing template is updated, ALL products refresh instantly
   */
  subscribeToPricingUpdates: (vendorId: string) => {
    const { pricingChannel } = get()

    // Don't subscribe if already subscribed
    if (pricingChannel) {
      logger.debug('[Products Store] Already subscribed to pricing updates')
      return
    }

    const channel = supabase
      .channel(`pricing:vendor:${vendorId}`)
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
          logger.info('🔔 PRICING TEMPLATE UPDATED (real-time)', {
            templateId: payload.new?.id,
            templateName: payload.new?.name,
          })
          get().refreshProducts()
        }
      )
      // Listen to products table changes (for any product updates including pricing_template_id changes)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          // Refresh if pricing_template_id or meta_data changed
          const oldTemplateId = payload.old?.pricing_template_id
          const newTemplateId = payload.new?.pricing_template_id
          const oldMetaData = JSON.stringify(payload.old?.meta_data)
          const newMetaData = JSON.stringify(payload.new?.meta_data)

          if (oldTemplateId !== newTemplateId || oldMetaData !== newMetaData) {
            logger.info('🔔 PRODUCT UPDATED (real-time)', {
              productId: payload.new?.id,
              templateChanged: oldTemplateId !== newTemplateId,
            })
            get().refreshProducts()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.error('[Products Store] ❌ Error subscribing to pricing updates')
        }
      })

    set({ pricingChannel: channel })
  },

  /**
   * Unsubscribe from pricing updates
   */
  unsubscribeFromPricingUpdates: () => {
    const { pricingChannel } = get()

    if (pricingChannel) {
      logger.debug('[Products Store] Unsubscribing from pricing updates')
      supabase.removeChannel(pricingChannel)
      set({ pricingChannel: null })
    }
  },

  reset: () => {
    // Cancel any in-flight requests before reset
    get().cancelLoadProducts()

    // Unsubscribe from ALL locations
    get().unsubscribeFromInventoryUpdates()

    // Unsubscribe from pricing updates
    get().unsubscribeFromPricingUpdates()

    set({
      products: [],
      categories: ['All'],
      loading: false,
      error: null,
      currentController: null,
      inventoryChannels: new Map(),
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
  get subscribeToPricingUpdates() { return useProductsStore.getState().subscribeToPricingUpdates },
  get unsubscribeFromPricingUpdates() { return useProductsStore.getState().unsubscribeFromPricingUpdates },
  get reset() { return useProductsStore.getState().reset },
}
