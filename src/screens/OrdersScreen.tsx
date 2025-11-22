/**
 * Orders Screen
 * iPad Settings-style interface with Liquid Glass
 * Apple-quality performance for hundreds of orders per day
 * Uses FlatList virtualization and intelligent date filtering
 * Client-side location filtering for staff users
 */

import { View, Text, Pressable, ActivityIndicator, Animated, useWindowDimensions, FlatList, RefreshControl, Image } from 'react-native'
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { LocationSelector } from '@/components/LocationSelector'
import { OrderItem, SectionHeader, OrderDetail } from '@/components/orders'
import { ordersStyles as styles } from '@/components/orders/orders.styles'
import { getDateRangeFilter, groupOrdersByDate, type DateRange } from '@/hooks/orders'
import { useOrders } from '@/hooks/useOrders'
import { type Order } from '@/services/orders.service'
import { useUserLocations } from '@/hooks/useUserLocations'
import { useAuth } from '@/stores/auth.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { logger } from '@/utils/logger'
import { supabase } from '@/lib/supabase/client'

type NavSection = 'all' | 'needs_action' | 'in_progress' | 'completed' | 'cancelled'

function OrdersScreenComponent() {
  const { user } = useAuth()
  const [activeNav, setActiveNav] = useState<NavSection>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [navSearchQuery, setNavSearchQuery] = useState('')
  const [vendorLogo, setVendorLogo] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Location filtering - using global store
  const { locations: userLocations } = useUserLocations()
  const { selectedLocationIds, setSelectedLocationIds, initializeFromUserLocations } = useLocationFilter()
  const [showLocationSelector, setShowLocationSelector] = useState(false)

  // Calculate selected location names for display
  const selectedLocationNames = useMemo(() => {
    if (selectedLocationIds.length === 0) return []
    return userLocations
      .filter(ul => selectedLocationIds.includes(ul.location.id))
      .map(ul => ul.location.name)
  }, [selectedLocationIds, userLocations])

  // Show location column when viewing multiple/all locations
  const showLocationColumn = selectedLocationIds.length === 0 || selectedLocationIds.length > 1

  // Auto-select location for staff users (users assigned to specific locations)
  useEffect(() => {
    if (userLocations.length > 0) {
      // Check if user is admin/owner (they see all locations, so don't auto-filter)
      const isAdmin = userLocations.some(ul => ul.role === 'owner')
      const assignedIds = userLocations.map(ul => ul.location.id)

      // Initialize the global location filter
      initializeFromUserLocations(assignedIds, isAdmin)
    }
  }, [userLocations.length, initializeFromUserLocations])

  // Sliding animation
  const slideAnim = useRef(new Animated.Value(0)).current

  // iOS-style collapsing header
  const ordersHeaderOpacity = useRef(new Animated.Value(0)).current

  const { width } = useWindowDimensions()
  const contentWidth = width - layout.sidebarWidth

  // Load ALL orders (we'll filter client-side)
  const { orders: allOrders, loading: isLoading, refresh } = useOrders({
    autoLoad: true,
    limit: 500, // Reasonable limit for performance
  })

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  // Load vendor info
  useEffect(() => {
    const loadVendorInfo = async () => {
      if (!user?.email) return
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id, vendors(id, store_name, logo_url)')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        if (userError || !userData) {
          logger.error('User query error', { error: userError })
          return
        }

        logger.debug('[OrdersScreen] Vendor data loaded:', {
          hasVendor: !!userData?.vendors,
          vendorData: userData?.vendors,
          logoUrl: (userData?.vendors as any)?.logo_url
        })

        if (userData?.vendors) {
          const vendor = userData.vendors as any
          setVendorName(vendor.store_name || '')
          setVendorLogo(vendor.logo_url || null)
          logger.debug('[OrdersScreen] Set vendor logo to:', vendor.logo_url)
        }
      } catch (error) {
        logger.error('Failed to load vendor info', { error })
      }
    }
    loadVendorInfo()
  }, [user])

  // Filter orders by status, date, search, and location (CLIENT-SIDE)
  const filteredOrders = useMemo(() => {
    const dateFilter = getDateRangeFilter(dateRange)

    return allOrders.filter((order) => {
      // Location filter (FIRST - most important for staff users)
      if (selectedLocationIds.length > 0) {
        if (!order.pickup_location_id || !selectedLocationIds.includes(order.pickup_location_id)) {
          return false
        }
      }

      // Status filter - Smart groupings (The Apple Way)
      if (activeNav !== 'all') {
        if (activeNav === 'needs_action') {
          // "Needs Action" = Orders requiring immediate attention
          const needsAction = ['pending', 'ready', 'out_for_delivery', 'ready_to_ship']
          if (!needsAction.includes(order.status)) {
            return false
          }
        } else if (activeNav === 'in_progress') {
          // "In Progress" = Orders actively being worked on
          const inProgress = ['preparing', 'shipped', 'in_transit']
          if (!inProgress.includes(order.status)) {
            return false
          }
        } else if (activeNav === 'completed') {
          // "Completed" = Finished orders
          const completed = ['completed', 'delivered']
          if (!completed.includes(order.status)) {
            return false
          }
        } else if (activeNav === 'cancelled') {
          // "Cancelled" = Cancelled orders
          if (order.status !== 'cancelled') {
            return false
          }
        }
      }

      // Date range filter
      if (dateFilter) {
        const orderDate = new Date(order.created_at)
        if (orderDate < dateFilter) {
          return false
        }
      }

      // Search filter
      if (navSearchQuery) {
        const searchLower = navSearchQuery.toLowerCase()
        const customerNameMatch = (order.customer_name || '').toLowerCase().includes(searchLower)
        const orderNumberMatch = order.order_number.toLowerCase().includes(searchLower)
        const emailMatch = (order.customer_email || '').toLowerCase().includes(searchLower)

        if (!customerNameMatch && !orderNumberMatch && !emailMatch) return false
      }

      return true
    })
  }, [allOrders, activeNav, dateRange, navSearchQuery, selectedLocationIds])

  // Group filtered orders by date
  const groupedOrders = useMemo(() => groupOrdersByDate(filteredOrders), [filteredOrders])

  // Flatten for FlatList
  const flatListData = useMemo(() => {
    const items: (| { type: 'section'; group: { title: string; data: Order[] }; isFirst: boolean })[] = []

    groupedOrders.forEach((group, groupIndex) => {
      items.push({
        type: 'section',
        group,
        isFirst: groupIndex === 0
      })
    })
    return items
  }, [groupedOrders])

  // Calculate counts for badges (from filtered orders by location, not by status)
  const locationFilteredOrders = useMemo(() => {
    if (selectedLocationIds.length === 0) return allOrders
    return allOrders.filter(o =>
      o.pickup_location_id && selectedLocationIds.includes(o.pickup_location_id)
    )
  }, [allOrders, selectedLocationIds])

  // Calculate counts - The Apple Way: Smart groupings
  // "Needs Action" = Orders requiring immediate staff attention
  const needsActionCount = locationFilteredOrders.filter(o =>
    o.status === 'pending' ||
    o.status === 'ready' ||
    o.status === 'out_for_delivery' ||
    o.status === 'ready_to_ship'
  ).length

  // "In Progress" = Orders actively being worked on
  const inProgressCount = locationFilteredOrders.filter(o =>
    o.status === 'preparing' ||
    o.status === 'shipped' ||
    o.status === 'in_transit'
  ).length

  // "Completed" = Finished orders (completed or delivered)
  const completedCount = locationFilteredOrders.filter(o =>
    o.status === 'completed' ||
    o.status === 'delivered'
  ).length

  // "Cancelled" = Cancelled orders
  const cancelledCount = locationFilteredOrders.filter(o => o.status === 'cancelled').length

  // Nav items configuration - The Apple Way: Simple & Clear
  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'all',
      icon: 'grid',
      label: 'All Orders',
      count: locationFilteredOrders.length,
    },
    {
      id: 'needs_action',
      icon: 'warning',
      label: 'Needs Action',
      count: needsActionCount,
      badge: needsActionCount > 0 ? 'warning' as const : undefined,
    },
    {
      id: 'in_progress',
      icon: 'box',
      label: 'In Progress',
      count: inProgressCount,
    },
    {
      id: 'completed',
      icon: 'box',
      label: 'Completed',
      count: completedCount,
    },
    {
      id: 'cancelled',
      icon: 'box',
      label: 'Cancelled',
      count: cancelledCount,
    },
  ], [
    locationFilteredOrders.length,
    needsActionCount,
    inProgressCount,
    completedCount,
    cancelledCount,
  ])

  // Handle order selection
  const handleOrderSelect = useCallback((order: Order) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedOrder(order)
  }, [])

  const handleOrderUpdated = () => {
    refresh()
  }

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

  // FlatList render functions
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
                isSelected={selectedOrder?.id === order.id}
                isLast={index === group.data.length - 1}
                onPress={() => handleOrderSelect(order)}
              />
            ))}
          </View>
        </View>
      </>
    )
  }, [showLocationColumn, selectedOrder, handleOrderSelect])

  const keyExtractor = useCallback((item: typeof flatListData[0], index: number) => {
    return `section-${item.group.title}-${index}`
  }, [])

  // Date range label
  const dateRangeLabel = useMemo(() => {
    switch (dateRange) {
      case 'today':
        return 'Today'
      case 'week':
        return 'This Week'
      case 'month':
        return 'This Month'
      case 'all':
        return 'All Time'
    }
  }, [dateRange])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.layout}>
        {/* LEFT NAV SIDEBAR */}
        <NavSidebar
          width={layout.sidebarWidth}
          searchValue={navSearchQuery}
          onSearchChange={setNavSearchQuery}
          items={navItems}
          activeItemId={activeNav}
          onItemPress={(id) => setActiveNav(id as NavSection)}
          userName={user?.email?.split('@')[0] || 'User'}
          vendorName={vendorName}
          vendorLogo={vendorLogo}
          onUserProfilePress={() => setShowLocationSelector(true)}
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
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.text.secondary} />
              </View>
            ) : flatListData.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconContainer}>
                  <Text style={styles.emptyStateIcon}>􀈂</Text>
                </View>
                <Text style={styles.emptyStateTitle}>No Orders Found</Text>
                <Text style={styles.emptyStateText}>
                  {navSearchQuery
                    ? `No results for "${navSearchQuery}"`
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
                        {vendorLogo ? (
                          <Image
                            source={{ uri: vendorLogo }}
                            style={styles.vendorLogoInline}
                            resizeMode="contain"
                        fadeDuration={0}
                            onError={(e) => logger.debug('[OrdersScreen] Image load error:', e.nativeEvent.error)}
                            onLoad={() => logger.debug('[OrdersScreen] Image loaded successfully')}
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
                  // Instant transition like iOS
                  ordersHeaderOpacity.setValue(offsetY > threshold ? 1 : 0)
                }}
                scrollEventThrottle={16}
                refreshControl={
                  <RefreshControl
                    refreshing={isLoading}
                    onRefresh={refresh}
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
              <OrderDetail
                order={selectedOrder}
                onBack={() => setSelectedOrder(null)}
                onOrderUpdated={handleOrderUpdated}
              />
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
        onClose={() => setShowLocationSelector(false)}
        onSelect={setSelectedLocationIds}
        context="orders"
      />
    </SafeAreaView>
  )
}

// Export memoized version for performance
export const OrdersScreen = memo(OrdersScreenComponent)
OrdersScreen.displayName = 'OrdersScreen'
