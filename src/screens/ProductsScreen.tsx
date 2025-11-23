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

import React, { useRef, useEffect, useMemo, memo } from 'react'
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'

// Views
import { ProductsListView } from '@/components/products/views/ProductsListView'
import { CategoriesView } from '@/components/products/views/CategoriesView'
import { PurchaseOrdersViewWrapper } from '@/components/products/views/PurchaseOrdersViewWrapper'
import { AuditsViewWrapper } from '@/components/products/views/AuditsViewWrapper'

// Stores
import {
  useActiveNav,
  useProductsSearchQuery,
  productsScreenActions,
} from '@/stores/products-list.store'
import { useProductsStore } from '@/stores/products.store'
import { useLocationFilter } from '@/stores/location-filter.store'

// Modals
import { CreateProductModal, CreateAuditModal } from '@/components/products'
import { CategoryModal } from '@/components/categories'
import { CreatePOModal, ReceivePOModal } from '@/components/purchase-orders'

function ProductsScreenComponent() {
  const { user, vendor } = useAppAuth()
  const { width } = useWindowDimensions()

  // ✅ Read from Zustand stores
  const activeNav = useActiveNav()
  const searchQuery = useProductsSearchQuery()
  const { selectedLocationIds } = useLocationFilter()

  // Products store
  const allProducts = useProductsStore(state => state.products)
  const productsLoading = useProductsStore(state => state.loading)
  const loadProducts = useProductsStore(state => state.loadProducts)

  // Load products on mount when location is selected
  useEffect(() => {
    if (selectedLocationIds.length > 0) {
      loadProducts(selectedLocationIds[0])
    }
  }, [selectedLocationIds, loadProducts])

  // Placeholder for other data (TODO: create proper stores)
  const categories: any[] = []
  const categoriesLoading = false
  const purchaseOrders: any[] = []
  const poLoading = false
  const poStats = { pending: 0, received: 0, total: 0 }

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current
  const contentWidth = width - layout.sidebarWidth

  // Compute counts for nav
  const lowStockCount = useMemo(
    () => allProducts.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) < 10).length,
    [allProducts]
  )

  const outOfStockCount = useMemo(
    () => allProducts.filter(p => (p.total_stock || 0) === 0).length,
    [allProducts]
  )

  // Nav Items
  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'all',
      icon: 'grid',
      label: 'All Products',
      count: allProducts.length,
    },
    {
      id: 'low-stock',
      icon: 'warning',
      label: 'Low Stock',
      count: lowStockCount,
      badge: 'warning' as const,
    },
    {
      id: 'out-of-stock',
      icon: 'box',
      label: 'Out of Stock',
      count: outOfStockCount,
      badge: 'error' as const,
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
      count: poStats.pending,
    },
    {
      id: 'audits',
      icon: 'list',
      label: 'Audits',
    },
  ], [allProducts.length, lowStockCount, outOfStockCount, poStats.pending])

  // Handle nav changes
  const handleNavPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.setActiveNav(id as any)
    productsScreenActions.clearSelection()
  }

  // Render active view
  const renderContent = () => {
    switch (activeNav) {
      case 'all':
      case 'low-stock':
      case 'out-of-stock':
        return (
          <ProductsListView
            products={allProducts}
            isLoading={productsLoading}
            vendorLogo={vendor?.logo_url || null}
          />
        )

      case 'categories':
        return (
          <CategoriesView
            categories={categories}
            loading={categoriesLoading}
            vendorLogo={vendor?.logo_url || null}
          />
        )

      case 'purchase-orders':
        return (
          <PurchaseOrdersViewWrapper
            purchaseOrders={purchaseOrders}
            loading={poLoading}
            vendorLogo={vendor?.logo_url || null}
          />
        )

      case 'audits':
        return (
          <AuditsViewWrapper
            vendorLogo={vendor?.logo_url || null}
          />
        )

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
          userName={user?.email || 'User'}
        />

        {/* CONTENT AREA */}
        <View style={styles.contentArea}>
          {renderContent()}
        </View>
      </View>

      {/* MODALS - TODO: These need to be refactored to read from stores */}
      {/* <CreateProductModal /> */}
      {/* <CreateAuditModal /> */}
      {/* <CategoryModal /> */}
      {/* <CreatePOModal /> */}
      {/* <ReceivePOModal /> */}
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
    position: 'relative',
    overflow: 'hidden',
  },
})
