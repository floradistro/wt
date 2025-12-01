/**
 * ProductsScreen - Refactored Orchestrator
 * Apple Standard: Clean orchestrator with 6 views
 *
 * Views:
 * - All Products / Low Stock / Out of Stock (ProductsListView)
 * - Categories (CategoriesView)
 * - Purchase Orders (PurchaseOrdersViewWrapper)
 * - Audits (AuditsViewWrapper)
 *
 * ZERO PROP DRILLING:
 * - All state managed in products-screen.store (products-list.store)
 * - Views read from stores directly
 * - < 300 lines, atomic, clean
 */

import React, { useRef, useEffect, useMemo, memo, useState } from 'react'
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'
import { useRealtimeInventory } from '@/hooks/useRealtimeInventory'
import { supabase } from '@/lib/supabase/client'
import type { Product } from '@/types/pos'

// Views
import { ProductsListView } from '@/components/products/views/ProductsListView'
import { CategoriesView } from '@/components/products/views/CategoriesView'
import { PurchaseOrdersViewWrapper } from '@/components/products/views/PurchaseOrdersViewWrapper'
import { AuditsViewWrapper } from '@/components/products/views/AuditsViewWrapper'
import { TransfersViewWrapper } from '@/components/products/views/TransfersViewWrapper'
import { ProductDetail } from '@/components/products/detail/ProductDetail'
import { CategoryDetail } from '@/components/categories/CategoryDetail'

// Stores
import {
  useActiveNav,
  useProductsSearchQuery,
  useProductsScreenStore,
  productsScreenActions,
} from '@/stores/products-list.store'
import { useProductsStore, productsActions } from '@/stores/products.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { useSuppliersManagementStore } from '@/stores/suppliers-management.store'

// Modals
import { AddProductModal, CreateAuditModal, CreateTransferModal, ReceiveTransferModal, TransferDetailModal } from '@/components/products'
import { CategoryModal } from '@/components/categories'
import { CreatePOModal, PurchaseOrderDetail, ReceivePOModal } from '@/components/purchase-orders'
import { LocationSelectorModal } from '@/components/shared'

function ProductsScreenComponent() {
  const { user, vendor, locations } = useAppAuth()
  const { width } = useWindowDimensions()

  // Local state for location selector modal
  const [showLocationSelector, setShowLocationSelector] = useState(false)

  // ✅ Read from Zustand stores
  const activeNav = useActiveNav()
  const searchQuery = useProductsSearchQuery()
  const selectedProduct = useProductsScreenStore((state) => state.selectedProduct)
  const selectedPO = useProductsScreenStore((state) => state.selectedPurchaseOrder)
  const selectedCategoryId = useProductsScreenStore((state) => state.selectedCategoryId)
  const { selectedLocationIds, initializeFromUserLocations } = useLocationFilter()

  // ✅ INITIALIZE LOCATION FILTER: Default to all locations for Products screen
  // This ensures products screen shows ALL products by default
  useEffect(() => {
    if (locations.length > 0 && user) {
      const isAdmin = user.role === 'owner'
      // For ProductsScreen, ALWAYS show all locations by default (empty array)
      // Pass empty array to force "all locations" view regardless of user role
      initializeFromUserLocations([], true)
    }
  }, [locations.length, user?.id, user?.role, initializeFromUserLocations])

  // Import useCategories to get full category data for detail view
  const { useCategories } = require('@/hooks/useCategories')
  const { categories: allCategories } = useCategories({ includeGlobal: true, parentId: null })
  const selectedCategory = selectedCategoryId ? allCategories.find((c: any) => c.id === selectedCategoryId) : null

  // Products store - products AND categories
  const allProducts = useProductsStore(state => state.products)
  const productsCategories = useProductsStore(state => state.categories)
  const productsLoading = useProductsStore(state => state.loading)
  const loadProducts = useProductsStore(state => state.loadProducts)

  // Suppliers store (for purchase orders view)
  const suppliersLoading = useSuppliersManagementStore(state => state.isLoading)
  const loadSuppliers = useSuppliersManagementStore(state => state.loadSuppliers)

  // ✅ REAL-TIME INVENTORY: Subscribe to inventory updates for ALL relevant locations
  // This ensures inventory quantities update instantly without page refresh
  useEffect(() => {
    const locationsToSubscribe = selectedLocationIds.length > 0 ? selectedLocationIds : locations.map(l => l.id)

    logger.info('[ProductsScreen] Setting up real-time subscriptions for', locationsToSubscribe.length, 'locations')

    // Subscribe to each location
    locationsToSubscribe.forEach(locationId => {
      productsActions.subscribeToInventoryUpdates(locationId)
    })

    // Cleanup: Unsubscribe when locations change
    return () => {
      logger.info('[ProductsScreen] Cleaning up real-time subscriptions')
      productsActions.unsubscribeFromInventoryUpdates()
    }
  }, [selectedLocationIds, locations])

  // Reusable function to reload products based on current location filter
  const reloadProducts = async () => {
    if (locations.length === 0) return

    logger.info('[ProductsScreen] Starting product reload')
    useProductsStore.setState({ loading: true })

    try {
      if (selectedLocationIds.length === 0) {
        // ALL LOCATIONS - load products from all locations in parallel and merge
        logger.debug('[ProductsScreen] Loading products for ALL locations:', locations.length)

        // Query ALL products first (including out of stock), filtered by vendor
        // This ensures out-of-stock products still appear
        if (!vendor?.id) {
          logger.error('[ProductsScreen] No vendor ID available')
          return
        }

        const { data: allProductsData, error: productsError } = await supabase
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
          .eq('vendor_id', vendor.id)

        if (productsError) throw productsError

        // Load inventory from all locations in parallel
        const loadPromises = locations.map(async (location) => {
          try {
            const productIds = allProductsData?.map(p => p.id) || []
            if (productIds.length === 0) return []

            const { data: inventoryData, error } = await supabase
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
              .eq('location_id', location.id)

            if (error) throw error

            // Merge inventory into products for this location
            const { transformProductsData } = require('@/utils/product-transformers')
            const productsWithInventory = (allProductsData || []).map(product => ({
              ...product,
              inventory: inventoryData?.filter(inv => inv.product_id === product.id) || []
            }))

            // Don't pass locationId to transformer - we want to preserve all inventory records for merging
            return transformProductsData(productsWithInventory)
          } catch (error) {
            logger.error(`[ProductsScreen] Failed to load products for location ${location.id}:`, error)
            return []
          }
        })

        // Wait for all locations to finish loading
        const productsArrays = await Promise.all(loadPromises)

        // Merge products, aggregating inventory across locations
        const allProductsMap = new Map<string, Product>()
        productsArrays.forEach((locationProducts: Product[]) => {
          locationProducts.forEach((product: Product) => {
            if (allProductsMap.has(product.id)) {
              const existing = allProductsMap.get(product.id)!
              // Merge inventory arrays and quantities from this location
              allProductsMap.set(product.id, {
                ...existing,
                inventory_quantity: (existing.inventory_quantity || 0) + (product.inventory_quantity || 0),
                inventory: [...(existing.inventory || []), ...(product.inventory || [])], // Merge inventory arrays
              })
            } else {
              allProductsMap.set(product.id, product)
            }
          })
        })

        const mergedProducts = Array.from(allProductsMap.values())

        // Extract categories
        const { extractCategories } = require('@/utils/product-transformers')
        const uniqueCategories = extractCategories(mergedProducts)

        // Update store with merged products
        useProductsStore.setState({
          products: mergedProducts,
          categories: uniqueCategories,
          loading: false,
        })
        logger.debug('[ProductsScreen] Loaded products from all locations:', mergedProducts.length)
      } else {
        // SPECIFIC LOCATION(S) - load selected locations and hide out-of-stock
        logger.debug('[ProductsScreen] Loading products for selected locations:', selectedLocationIds.length)

        if (!vendor?.id) {
          logger.error('[ProductsScreen] No vendor ID available')
          return
        }

        // Query ALL products first (including out of stock), filtered by vendor
        const { data: allProductsData, error: productsError } = await supabase
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
          .eq('vendor_id', vendor.id)

        if (productsError) throw productsError

        // Load inventory from selected locations in parallel
        const selectedLocations = locations.filter(l => selectedLocationIds.includes(l.id))
        const loadPromises = selectedLocations.map(async (location) => {
          try {
            const productIds = allProductsData?.map(p => p.id) || []
            if (productIds.length === 0) return []

            const { data: inventoryData, error } = await supabase
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
              .eq('location_id', location.id)

            if (error) throw error

            // Merge inventory into products for this location
            const { transformProductsData } = require('@/utils/product-transformers')
            const productsWithInventory = (allProductsData || []).map(product => ({
              ...product,
              inventory: inventoryData?.filter(inv => inv.product_id === product.id) || []
            }))

            // Don't pass locationId to transformer - we want to preserve all inventory records for merging
            return transformProductsData(productsWithInventory)
          } catch (error) {
            logger.error(`[ProductsScreen] Failed to load products for location ${location.id}:`, error)
            return []
          }
        })

        // Wait for all locations to finish loading
        const productsArrays = await Promise.all(loadPromises)

        // Merge products, aggregating inventory across selected locations
        const selectedProductsMap = new Map<string, Product>()
        productsArrays.forEach((locationProducts: Product[]) => {
          locationProducts.forEach((product: Product) => {
            if (selectedProductsMap.has(product.id)) {
              const existing = selectedProductsMap.get(product.id)!
              // Merge inventory arrays and quantities from this location
              selectedProductsMap.set(product.id, {
                ...existing,
                inventory_quantity: (existing.inventory_quantity || 0) + (product.inventory_quantity || 0),
                inventory: [...(existing.inventory || []), ...(product.inventory || [])],
              })
            } else {
              selectedProductsMap.set(product.id, product)
            }
          })
        })

        let mergedSelectedProducts = Array.from(selectedProductsMap.values())

        // FILTER OUT OUT-OF-STOCK when specific locations selected
        mergedSelectedProducts = mergedSelectedProducts.filter(p => (p.inventory_quantity || 0) > 0)

        // Extract categories
        const { extractCategories } = require('@/utils/product-transformers')
        const uniqueCategories = extractCategories(mergedSelectedProducts)

        // Update store with merged products
        useProductsStore.setState({
          products: mergedSelectedProducts,
          categories: uniqueCategories,
          loading: false,
        })
        logger.debug('[ProductsScreen] Loaded products from selected locations:', mergedSelectedProducts.length, 'in-stock products')
      }

      // After reloading, get FRESH products from store and refresh the selected product
      const freshProducts = useProductsStore.getState().products
      logger.info('[ProductsScreen] Refreshing selected product with fresh data', {
        freshProductsCount: freshProducts.length,
      })
      productsScreenActions.refreshSelectedProduct(freshProducts)
    } catch (error) {
      logger.error('[ProductsScreen] Failed to reload products:', error)
      useProductsStore.setState({ loading: false })
    }
  }

  // Load products when vendor locations are available or when location filter changes
  useEffect(() => {
    reloadProducts()
  }, [locations, selectedLocationIds, loadProducts])

  // Load suppliers for purchase orders view
  useEffect(() => {
    if (user?.id) {
      loadSuppliers(user.id)
    }
  }, [user?.id, loadSuppliers])

  // Categories are already loaded in products store
  const categories = productsCategories || []
  const categoriesLoading = productsLoading

  // Animations for iOS Settings-style slide
  const slideAnim = useRef(new Animated.Value(0)).current
  const contentWidth = width - layout.sidebarWidth

  // Animate slide when detail view is shown
  useEffect(() => {
    if (selectedProduct || selectedCategory) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start()
    } else {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start()
    }
  }, [selectedProduct, selectedCategory])

  // Nav Items (without low-stock and out-of-stock - now filter pills)
  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'all',
      icon: 'grid',
      label: 'Products',
      count: allProducts.length,
    },
    {
      id: 'categories',
      icon: 'folder',
      label: 'Categories',
    },
    {
      id: 'purchase-orders',
      icon: 'doc',
      label: 'Purchase Orders',
    },
    {
      id: 'audits',
      icon: 'list',
      label: 'Audits',
    },
    {
      id: 'transfers',
      icon: 'move',
      label: 'Transfers',
    },
  ], [allProducts.length])

  // Handle nav changes
  const handleNavPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.setActiveNav(id as any)
    productsScreenActions.clearSelection()
  }

  // Handle user profile press (opens location selector)
  const handleUserProfilePress = () => {
    setShowLocationSelector(true)
  }

  // Compute selected location names for display
  const selectedLocationNames = useMemo(() => {
    if (selectedLocationIds.length === 0) {
      return ['All locations']
    }
    return locations
      .filter(ul => selectedLocationIds.includes(ul.id))
      .map(ul => ul.name)
  }, [selectedLocationIds, locations])

  // Render active view - ProductsListView is always mounted to preserve scroll
  const renderContent = () => {
    // For 'all' nav, we render ProductsListView outside this function to keep it mounted
    if (activeNav === 'all') return null

    switch (activeNav) {
      case 'categories':
        return <CategoriesView />

      case 'purchase-orders':
        return <PurchaseOrdersViewWrapper />

      case 'audits':
        return <AuditsViewWrapper />

      case 'transfers':
        return <TransfersViewWrapper />

      default:
        return null
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        {/* LEFT SIDEBAR */}
        <NavSidebar
          width={layout.sidebarWidth}
          items={navItems}
          activeItemId={activeNav}
          onItemPress={handleNavPress}
          searchValue={searchQuery}
          onSearchChange={productsScreenActions.setSearchQuery}
          searchPlaceholder="Search..."
          vendorLogo={vendor?.logo_url || null}
          vendorName={vendor?.store_name || 'Vendor'}
          selectedLocationNames={selectedLocationNames}
          onUserProfilePress={handleUserProfilePress}
        />

        {/* CONTENT AREA - Stack Navigation (iOS Settings Style) */}
        <View style={styles.contentArea}>
          {/* Products List View - ALWAYS MOUNTED to preserve scroll position */}
          {activeNav === 'all' && (
            <Animated.View
              style={[
                styles.stackView,
                {
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -contentWidth * 0.3], // Slide left 30%
                      }),
                    },
                  ],
                  opacity: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0], // Fade out
                  }),
                },
              ]}
              pointerEvents={selectedProduct || selectedCategory ? 'none' : 'auto'}
            >
              <ProductsListView products={allProducts} vendorLogo={vendor?.logo_url} isLoading={productsLoading} />
            </Animated.View>
          )}

          {/* Other Views - rendered via renderContent */}
          {activeNav !== 'all' && (
            <Animated.View
              style={[
                styles.stackView,
                {
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -contentWidth * 0.3],
                      }),
                    },
                  ],
                  opacity: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}
              pointerEvents={selectedProduct || selectedCategory ? 'none' : 'auto'}
            >
              {renderContent()}
            </Animated.View>
          )}

          {/* Detail View - Slides in from the right */}
          {(selectedProduct || selectedCategory || selectedPO) && (
            <Animated.View
              style={[
                styles.stackView,
                styles.detailView,
                {
                  transform: [
                    {
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [contentWidth, 0], // Slide in from right
                      }),
                    },
                  ],
                },
              ]}
            >
              {selectedProduct ? (
                <ProductDetail
                  product={selectedProduct}
                  onBack={() => productsScreenActions.selectProduct(null)}
                  onProductUpdated={reloadProducts}
                />
              ) : selectedCategory ? (
                <CategoryDetail
                  category={selectedCategory}
                  onBack={() => productsScreenActions.selectCategory(null)}
                  onCategoryUpdated={() => {
                    // Categories will auto-refresh via useCategories hook
                  }}
                  fieldsCount={0} // TODO: Calculate from custom fields
                  templatesCount={0} // TODO: Calculate from pricing templates
                />
              ) : selectedPO ? (
                <PurchaseOrderDetail
                  purchaseOrder={selectedPO}
                  onBack={() => productsScreenActions.selectPurchaseOrder(null)}
                  onUpdated={() => {
                    // PO will auto-refresh via store
                  }}
                  onReceive={() => {
                    productsScreenActions.openModal('receivePO')
                  }}
                />
              ) : null}
            </Animated.View>
          )}
        </View>
      </View>

      {/* MODALS - Zero Prop Architecture ✅ */}
      <CategoryModal />
      <CreatePOModal
        visible={useProductsScreenStore((state) => state.showCreatePO)}
        onClose={() => productsScreenActions.closeAllModals()}
      />
      <ReceivePOModal />
      <CreateAuditModal
        visible={useProductsScreenStore((state) => state.showCreateAudit)}
        onClose={() => productsScreenActions.closeAllModals()}
        onCreated={() => {
          // Audits will auto-refresh via useInventoryAdjustments hook
          logger.info('Audit created successfully')
        }}
      />
      <LocationSelectorModal
        visible={showLocationSelector}
        onClose={() => setShowLocationSelector(false)}
      />
      <CreateTransferModal />
      <ReceiveTransferModal />
      <TransferDetailModal />
      <AddProductModal
        visible={useProductsScreenStore((state) => state.showCreateProduct)}
        onClose={() => productsScreenActions.closeAllModals()}
        onCreated={(productId) => {
          logger.info('[ProductsScreen] Product created successfully', { productId })
          reloadProducts()
        }}
      />
      {/* PurchaseOrderDetail will be used in the right panel for receiving */}
    </SafeAreaView>
  )
}

export const ProductsScreen = memo(ProductsScreenComponent)

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
    overflow: 'hidden', // Hide content sliding off screen
  },
  stackView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.primary,
  },
  detailView: {
    backgroundColor: colors.background.secondary,
  },
})
