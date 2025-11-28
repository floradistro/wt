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

import { View, Text, Pressable, ActivityIndicator, Animated, useWindowDimensions, FlatList, RefreshControl, Image } from 'react-native'
import React, { useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { LocationSelectorModal, TitleSection } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { OrderItem, SectionHeader, OrderDetail } from '@/components/orders'
import { StorePickupView, ECommerceView, InStoreSalesView } from '@/components/orders/views'
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
import { type Order } from '@/services/orders.service'
import { logger } from '@/utils/logger'

// ✅ NEW: Import from Context
import { useAppAuth } from '@/contexts/AppAuthContext'

// ✅ NEW: Import from Zustand stores
import { useOrders, useOrdersLoading, useOrdersActions } from '@/stores/orders.store'
import {
  useActiveNav,
  useSelectedOrderId,
  useSearchQuery,
  useDateRange,
  useShowLocationSelector,
  useOrdersUIActions,
  type NavSection,
  type DateRange
} from '@/stores/orders-ui.store'
import { useFilteredOrders, useGroupedOrders, useBadgeCounts } from '@/stores/order-filter.store'
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
  const dateRange = useDateRange()
  const showLocationSelector = useShowLocationSelector()

  const {
    setActiveNav,
    selectOrder,
    setSearchQuery,
    setDateRange,
    openLocationSelector,
    closeLocationSelector
  } = useOrdersUIActions()

  // ========================================
  // LOCATION FILTERING from Zustand (shared store)
  // ========================================
  const { selectedLocationIds, setSelectedLocationIds, initializeFromUserLocations } = useLocationFilter()

  // ========================================
  // COMPUTED STATE from Zustand (filtering, grouping, badges)
  // ========================================
  const filteredOrders = useFilteredOrders()
  const groupedOrders = useGroupedOrders()
  const badgeCounts = useBadgeCounts()

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

  // Show location column when viewing multiple/all locations
  const showLocationColumn = selectedLocationIds.length === 0 || selectedLocationIds.length > 1

  // Date range label
  const dateRangeLabel = useMemo(() => {
    switch (dateRange) {
      case 'today': return 'Today'
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'custom': return 'Custom Range'
      case 'all': return 'All Time'
    }
  }, [dateRange])

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
    return {
      inStore: orders.filter(o => o.order_type === 'walk_in').length,
      pickup: orders.filter(o => o.order_type === 'pickup').length,
      ecommerce: orders.filter(o => o.order_type === 'shipping').length,
    }
  }, [orders])

  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'in-store',
      icon: 'box',
      label: 'In-Store Sales',
      count: orderTypeCounts.inStore,
    },
    {
      id: 'pickup',
      icon: 'box',
      label: 'Store Pickup',
      count: orderTypeCounts.pickup,
    },
    {
      id: 'ecommerce',
      icon: 'move',
      label: 'E-Commerce',
      count: orderTypeCounts.ecommerce,
    },
    {
      id: 'all',
      icon: 'grid',
      label: 'All Orders',
      count: orders.length,
    },
  ], [orderTypeCounts, orders.length])

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
  // VIEW RENDERING (Products Screen Pattern)
  // ========================================

  const renderContent = () => {
    switch (activeNav) {
      case 'in-store':
        return <InStoreSalesView isLoading={loading} />

      case 'pickup':
        return <StorePickupView isLoading={loading} />

      case 'ecommerce':
        return <ECommerceView isLoading={loading} />

      case 'all':
      default:
        // Fallback to original FlatList for "All Orders"
        const flatListData = groupedOrders.map((group, index) => ({
          type: 'section' as const,
          group,
          isFirst: index === 0,
        }))

        if (loading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.text.secondary} />
            </View>
          )
        }

        if (flatListData.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No Orders Found</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : `No orders for ${dateRangeLabel.toLowerCase()}`}
              </Text>
            </View>
          )
        }

        // Date range filter pills
        const dateFilterPills: FilterPill[] = [
          { id: 'today', label: '1 Day' },
          { id: 'week', label: '7 Days' },
          { id: 'month', label: '30 Days' },
          { id: 'all', label: 'All' },
          { id: 'custom', label: 'Custom' },
        ]

        return (
          <FlatList
            data={flatListData}
            renderItem={({ item }) => {
              const { group, isFirst } = item
              return (
                <>
                  <SectionHeader title={group.title} isFirst={isFirst} />
                  <View style={styles.cardWrapper}>
                    <View style={styles.ordersCardGlass}>
                      {group.data.map((order, index) => (
                        <OrderItem
                          key={order.id}
                          order={order}
                          showLocation={showLocationColumn}
                          isLast={index === group.data.length - 1}
                        />
                      ))}
                    </View>
                  </View>
                </>
              )
            }}
            keyExtractor={(item, index) => `section-${item.group.title}-${index}`}
            ListHeaderComponent={() => (
              <TitleSection
                title="All Orders"
                logo={vendor?.logo_url}
                subtitle={`${orders.length} total ${orders.length === 1 ? 'order' : 'orders'}`}
                hideButton
                filterPills={dateFilterPills}
                activeFilterId={dateRange}
                onFilterSelect={(id) => setDateRange(id as DateRange)}
              />
            )}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refreshOrders}
                tintColor={colors.text.secondary}
              />
            }
            maxToRenderPerBatch={2}
            updateCellsBatchingPeriod={100}
            initialNumToRender={2}
            windowSize={3}
            removeClippedSubviews={true}
          />
        )
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
        visible={false}
        onClose={() => {}}
        orderId={null}
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
