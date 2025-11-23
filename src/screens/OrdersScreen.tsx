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
import { LocationSelector } from '@/components/LocationSelector'
import { OrderItem, SectionHeader, OrderDetail } from '@/components/orders'
import { ordersStyles as styles } from '@/components/orders/orders.styles'
import { useUserLocations } from '@/hooks/useUserLocations'
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
  const { user, vendor, locations: vendorLocations } = useAppAuth()

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
  const { locations: userLocations } = useUserLocations()
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
  const ordersHeaderOpacity = useRef(new Animated.Value(0)).current
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
    return userLocations
      .filter(ul => selectedLocationIds.includes(ul.location.id))
      .map(ul => ul.location.name)
  }, [selectedLocationIds, userLocations])

  // Show location column when viewing multiple/all locations
  const showLocationColumn = selectedLocationIds.length === 0 || selectedLocationIds.length > 1

  // Date range label
  const dateRangeLabel = useMemo(() => {
    switch (dateRange) {
      case 'today': return 'Today'
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'all': return 'All Time'
    }
  }, [dateRange])

  // ========================================
  // INITIALIZATION & CLEANUP
  // ========================================

  // Initialize: Load orders and subscribe to real-time updates
  useEffect(() => {
    logger.info('[OrdersScreen] Initializing - loading orders and subscribing to real-time')

    // Load initial orders
    loadOrders({ limit: 500 })

    // Subscribe to real-time updates
    subscribeToOrders()

    // Cleanup on unmount
    return () => {
      logger.info('[OrdersScreen] Unmounting - unsubscribing from real-time')
      unsubscribe()
    }
  }, []) // Empty deps - run once on mount

  // Auto-select location for staff users
  useEffect(() => {
    if (userLocations.length > 0) {
      const isAdmin = userLocations.some(ul => ul.role === 'owner')
      const assignedIds = userLocations.map(ul => ul.location.id)
      initializeFromUserLocations(assignedIds, isAdmin)
    }
  }, [userLocations.length, initializeFromUserLocations])

  // ========================================
  // NAV ITEMS (with badge counts from store)
  // ========================================

  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'all',
      icon: 'grid',
      label: 'All Orders',
      count: badgeCounts.all,
    },
    {
      id: 'needs_action',
      icon: 'warning',
      label: 'Needs Action',
      count: badgeCounts.needsAction,
      badge: badgeCounts.needsAction > 0 ? 'warning' as const : undefined,
    },
    {
      id: 'in_progress',
      icon: 'box',
      label: 'In Progress',
      count: badgeCounts.inProgress,
    },
    {
      id: 'completed',
      icon: 'box',
      label: 'Completed',
      count: badgeCounts.completed,
    },
    {
      id: 'cancelled',
      icon: 'box',
      label: 'Cancelled',
      count: badgeCounts.cancelled,
    },
  ], [badgeCounts])

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
  // FLATLIST RENDERING
  // ========================================

  // Flatten for FlatList
  const flatListData = useMemo(() => {
    const items: Array<{ type: 'section'; group: { title: string; data: Order[] }; isFirst: boolean }> = []

    groupedOrders.forEach((group, groupIndex) => {
      items.push({
        type: 'section',
        group,
        isFirst: groupIndex === 0
      })
    })
    return items
  }, [groupedOrders])

  const renderItem = useCallback(({ item }: { item: typeof flatListData[0] }) => {
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
  }, [showLocationColumn])

  const keyExtractor = useCallback((item: typeof flatListData[0], index: number) => {
    return `section-${item.group.title}-${index}`
  }, [])

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
          userName={user?.email?.split('@')[0] || 'User'}
          vendorName={vendor?.store_name || ''}
          vendorLogo={vendor?.logo_url || null}
          onUserProfilePress={openLocationSelector}
          selectedLocationNames={selectedLocationNames}
        />

        {/* SLIDING CONTENT AREA */}
        <View style={styles.contentArea}>
          {/* MIDDLE LIST - Orders */}
          <Animated.View
            style={[
              styles.ordersList,
              {
                transform: [{ translateX: listTranslateX }],
              },
            ]}
          >
            {/* Fixed Header Title - appears on scroll */}
            <Animated.View style={[styles.fixedHeader, { opacity: ordersHeaderOpacity }]}>
              <Text style={styles.fixedHeaderTitle}>
                {activeNav === 'all' ? 'All Orders' :
                 activeNav === 'needs_action' ? 'Needs Action' :
                 activeNav === 'in_progress' ? 'In Progress' :
                 activeNav === 'completed' ? 'Completed' :
                 activeNav === 'cancelled' ? 'Cancelled' :
                 'Orders'}
              </Text>
            </Animated.View>

            {/* Date Range Selector - Always visible, fixed position */}
            <View style={styles.fixedDateRangeSelector}>
              <Pressable
                style={[styles.dateRangeButton, dateRange === 'today' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('today')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'today' && styles.dateRangeButtonTextActive]}>
                  Today
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dateRangeButton, dateRange === 'week' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('week')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'week' && styles.dateRangeButtonTextActive]}>
                  Week
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dateRangeButton, dateRange === 'month' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('month')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'month' && styles.dateRangeButtonTextActive]}>
                  Month
                </Text>
              </Pressable>
              <Pressable
                style={[styles.dateRangeButton, dateRange === 'all' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('all')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'all' && styles.dateRangeButtonTextActive]}>
                  All
                </Text>
              </Pressable>
            </View>

            {/* Fade Gradient */}
            <LinearGradient
              colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
              style={styles.fadeGradient}
              pointerEvents="none"
            />

            {/* Orders List - Virtualized FlatList */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.text.secondary} />
              </View>
            ) : flatListData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No Orders Found</Text>
                <Text style={styles.emptyStateText}>
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : `No orders for ${dateRangeLabel.toLowerCase()}`}
                </Text>
              </View>
            ) : (
              <FlatList
                data={flatListData}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={() => (
                  <View style={styles.cardWrapper}>
                    <View style={styles.titleSectionContainer}>
                      <View style={styles.titleWithLogo}>
                        {vendor?.logo_url ? (
                          <Image
                            source={{ uri: vendor.logo_url }}
                            style={styles.vendorLogoInline}
                            resizeMode="contain"
                            fadeDuration={0}
                          />
                        ) : (
                          <View style={[styles.vendorLogoInline, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No Logo</Text>
                          </View>
                        )}
                        <Text style={styles.largeTitleHeader}>
                          {activeNav === 'all' ? 'All Orders' :
                           activeNav === 'needs_action' ? 'Needs Action' :
                           activeNav === 'in_progress' ? 'In Progress' :
                           activeNav === 'completed' ? 'Completed' :
                           activeNav === 'cancelled' ? 'Cancelled' :
                           'Orders'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={true}
                indicatorStyle="white"
                scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
                onScroll={(e) => {
                  const offsetY = e.nativeEvent.contentOffset.y
                  const threshold = 40
                  ordersHeaderOpacity.setValue(offsetY > threshold ? 1 : 0)
                }}
                scrollEventThrottle={16}
                refreshControl={
                  <RefreshControl
                    refreshing={loading}
                    onRefresh={refreshOrders}
                    tintColor={colors.text.secondary}
                  />
                }
                maxToRenderPerBatch={20}
                updateCellsBatchingPeriod={50}
                initialNumToRender={20}
                windowSize={21}
                removeClippedSubviews={true}
              />
            )}
          </Animated.View>

          {/* RIGHT DETAIL PANEL */}
          <Animated.View
            style={[
              styles.detailPanel,
              {
                transform: [{ translateX: detailTranslateX }],
              },
            ]}
          >
            {selectedOrder ? (
              <OrderDetail />
            ) : (
              <View style={styles.emptyDetail}>
                <Text style={styles.emptyTitle}>Select an order</Text>
                <Text style={styles.emptyText}>
                  Choose an order from the list to view details
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </View>

      {/* LOCATION SELECTOR MODAL */}
      <LocationSelector
        visible={showLocationSelector}
        userLocations={userLocations}
        selectedLocationIds={selectedLocationIds}
        onClose={closeLocationSelector}
        onSelect={setSelectedLocationIds}
        context="orders"
      />
    </SafeAreaView>
  )
}

// Export memoized version for performance
export const OrdersScreen = memo(OrdersScreenComponent)
OrdersScreen.displayName = 'OrdersScreen'
