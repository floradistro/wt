/**
 * Orders Screen - REFACTORED (Zero Prop Drilling)
 * iPad Settings-style interface with Liquid Glass
 * Apple-quality performance for hundreds of orders per day
 * Uses FlatList virtualization and intelligent date filtering
 * Client-side location filtering for staff users
 *
 * CHANGES FROM ORIGINAL:
 * - Removed all useState (10+ → 0)
 * - Vendor from AppAuthContext (not local state)
 * - Orders from orders.store (not useOrders hook)
 * - UI state from orders-ui.store
 * - Filtering from order-filter.store
 * - Real-time in store (not component)
 */

import { View, Text, Animated, useWindowDimensions } from 'react-native'
import React, { useRef, useEffect, useMemo, memo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { LocationSelectorModal } from '@/components/shared'
import { OrderDetail } from '@/components/orders'
import { FulfillmentBoard, InStoreSalesView, ErrorFeedView } from '@/components/orders/views'
import { StorePickupDetail, ECommerceDetail } from '@/components/orders/detail'
import {
  ConfirmPickupOrderModal,
  MarkReadyModal,
  ConfirmECommerceOrderModal,
  PackOrderModal,
  ShipOrderModal,
  MarkDeliveredModal,
  CustomDateRangeModal,
} from '@/components/orders/modals'
import { ordersStyles as styles } from '@/components/orders/orders.styles'
import { logger } from '@/utils/logger'

// ✅ NEW: Import from Context
import { useAppAuth } from '@/contexts/AppAuthContext'

// ✅ NEW: Import from Zustand stores
import { useOrders, useOrdersLoading, useOrdersActions } from '@/stores/orders.store'
import {
  useActiveNav,
  useSelectedOrderId,
  useSearchQuery,
  useShowLocationSelector,
  useShowShipModal,
  useShipModalOrderId,
  useShipModalLocationId,
  useOrdersUIActions,
  type NavSection,
} from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'

function OrdersScreenComponent() {
  // ========================================
  // FOUNDATION from Context (user, vendor, locations)
  // ========================================
  const { user, vendor, locations } = useAppAuth()

  // ========================================
  // BUSINESS LOGIC from Zustand (orders data)
  // ========================================
  const orders = useOrders()
  const loading = useOrdersLoading()
  const { loadOrders, refreshOrders, subscribeToOrders, unsubscribe } = useOrdersActions()

  // ========================================
  // UI STATE from Zustand (navigation, filters, modals)
  // ========================================
  const activeNav = useActiveNav()
  const selectedOrderId = useSelectedOrderId()
  const searchQuery = useSearchQuery()
  const showLocationSelector = useShowLocationSelector()

  // Ship modal state from Zustand (persists across re-renders)
  const showShipModal = useShowShipModal()
  const shipModalOrderId = useShipModalOrderId()
  const shipModalLocationId = useShipModalLocationId()

  const {
    setActiveNav,
    selectOrder,
    setSearchQuery,
    openLocationSelector,
    closeLocationSelector,
    closeShipModal
  } = useOrdersUIActions()

  // ========================================
  // LOCATION FILTERING from Zustand (shared store)
  // ========================================
  const { selectedLocationIds, initializeFromUserLocations } = useLocationFilter()

  // ========================================
  // LOCAL UI STATE (animations, dimensions)
  // ========================================
  const slideAnim = useRef(new Animated.Value(0)).current
  const { width } = useWindowDimensions()
  const contentWidth = width - layout.sidebarWidth

  // ========================================
  // DERIVED VALUES (local calculations)
  // ========================================

  // Selected order (from orders array by ID)
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null

  // Calculate selected location names for display
  const selectedLocationNames = useMemo(() => {
    if (selectedLocationIds.length === 0) return []
    return locations
      .filter(loc => selectedLocationIds.includes(loc.id))
      .map(loc => loc.name)
  }, [selectedLocationIds, locations])


  // ========================================
  // INITIALIZATION & CLEANUP
  // ========================================

  // Initialize: Load orders and subscribe to real-time updates
  useEffect(() => {
    logger.info('[OrdersScreen] Initializing - loading orders and subscribing to real-time')

    // Load ALL orders (no limit)
    loadOrders({})

    // Subscribe to real-time updates
    subscribeToOrders()

    // Cleanup on unmount
    return () => {
      logger.info('[OrdersScreen] Unmounting - unsubscribing from real-time')
      unsubscribe()
    }
  }, []) // Empty deps - run once on mount

  // ✅ INITIALIZE LOCATION FILTER: Default to all locations for Orders screen
  // This ensures orders screen shows ALL orders by default
  useEffect(() => {
    if (locations.length > 0 && user) {
      // For OrdersScreen, ALWAYS show all locations by default (empty array)
      // Users can manually filter if needed via location selector
      initializeFromUserLocations([], true)
    }
  }, [locations.length, user?.id, initializeFromUserLocations])

  // ========================================
  // NAV ITEMS (with badge counts from store)
  // ========================================

  // Calculate order type counts
  const orderTypeCounts = useMemo(() => {
    const inStore = orders.filter(o => o.order_type === 'walk_in').length
    const fulfillment = orders.filter(o =>
      o.order_type === 'pickup' || o.order_type === 'shipping'
    ).length
    // Count active (not done) fulfillment orders
    const activeFulfillment = orders.filter(o =>
      (o.order_type === 'pickup' || o.order_type === 'shipping') &&
      !['completed', 'delivered', 'shipped', 'in_transit', 'cancelled'].includes(o.status)
    ).length
    // Count error orders (failed payments, cancelled e-commerce)
    const errors = orders.filter(o =>
      o.order_type !== 'walk_in' && (
        o.payment_status === 'failed' ||
        o.status === 'cancelled'
      )
    ).length

    return { inStore, fulfillment, activeFulfillment, errors }
  }, [orders])

  // Nav items: Fulfillment, In-Store Sales, Error Feed
  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'fulfillment',
      icon: 'cube',
      label: 'Fulfillment',
      count: orderTypeCounts.activeFulfillment,
    },
    {
      id: 'in-store',
      icon: 'storefront',
      label: 'In-Store Sales',
      count: orderTypeCounts.inStore,
    },
    {
      id: 'errors',
      icon: 'warning',
      label: 'Error Feed',
      count: orderTypeCounts.errors,
    },
  ], [orderTypeCounts])

  // ========================================
  // EVENT HANDLERS
  // ========================================

  // ========================================
  // ANIMATIONS
  // ========================================

  // Animate when order is selected/deselected
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedOrder ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [selectedOrder, slideAnim])

  // Calculate translateX for sliding panels
  const listTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -contentWidth],
  })

  const detailTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [contentWidth, 0],
  })

  // ========================================
  // VIEW RENDERING
  // ========================================

  const renderContent = () => {
    switch (activeNav) {
      case 'fulfillment':
        return <FulfillmentBoard />

      case 'in-store':
        return <InStoreSalesView isLoading={loading} />

      case 'errors':
        return <ErrorFeedView />

      default:
        return <FulfillmentBoard />
    }
  }

  // Render specialized detail component based on order type
  const renderDetail = () => {
    if (!selectedOrder) {
      return (
        <View style={styles.emptyDetail}>
          <Text style={styles.emptyTitle}>Select an order</Text>
          <Text style={styles.emptyText}>
            Choose an order from the list to view details
          </Text>
        </View>
      )
    }

    const orderType = selectedOrder.order_type || 'walk_in'

    switch (orderType) {
      case 'pickup':
        return <StorePickupDetail />

      case 'shipping':
        return <ECommerceDetail />

      case 'walk_in':
      default:
        return <OrderDetail />
    }
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        {/* LEFT NAV SIDEBAR */}
        <NavSidebar
          width={layout.sidebarWidth}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          items={navItems}
          activeItemId={activeNav}
          onItemPress={(id) => setActiveNav(id as NavSection)}
          vendorName={vendor?.store_name || ''}
          vendorLogo={vendor?.logo_url || null}
          onUserProfilePress={openLocationSelector}
          selectedLocationNames={selectedLocationNames}
        />

        {/* SLIDING CONTENT AREA */}
        <View style={styles.contentArea}>
          {/* MIDDLE LIST - View-Based Rendering */}
          <Animated.View
            style={[
              styles.ordersList,
              {
                transform: [{ translateX: listTranslateX }],
              },
            ]}
          >
            {renderContent()}
          </Animated.View>

          {/* RIGHT DETAIL PANEL - Specialized Detail Components */}
          <Animated.View
            style={[
              styles.detailPanel,
              {
                transform: [{ translateX: detailTranslateX }],
              },
            ]}
          >
            {renderDetail()}
          </Animated.View>
        </View>
      </View>

      {/* MODALS - Zero Prop Architecture ✅ */}
      <LocationSelectorModal
        visible={showLocationSelector}
        onClose={closeLocationSelector}
      />

      {/* Store Pickup Modals */}
      <ConfirmPickupOrderModal
        visible={false}
        onClose={() => {}}
        orderId={null}
      />
      <MarkReadyModal
        visible={false}
        onClose={() => {}}
        orderId={null}
      />

      {/* E-Commerce Modals */}
      <ConfirmECommerceOrderModal
        visible={false}
        onClose={() => {}}
        orderId={null}
      />
      <PackOrderModal
        visible={false}
        onClose={() => {}}
        orderId={null}
      />
      <ShipOrderModal
        visible={showShipModal}
        onClose={closeShipModal}
        orderId={shipModalOrderId}
        locationId={shipModalLocationId}
      />
      <MarkDeliveredModal
        visible={false}
        onClose={() => {}}
        orderId={null}
      />

      {/* Custom Date Range Modal */}
      <CustomDateRangeModal />
    </SafeAreaView>
  )
}

// Export memoized version for performance
export const OrdersScreen = memo(OrdersScreenComponent)
OrdersScreen.displayName = 'OrdersScreen'
