/**
 * Orders Screen
 * iPad Settings-style interface with Liquid Glass
 * Apple-quality performance for hundreds of orders per day
 * Uses FlatList virtualization and intelligent date filtering
 * Client-side location filtering for staff users
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated, useWindowDimensions, FlatList, RefreshControl } from 'react-native'
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { LocationSelector } from '@/components/LocationSelector'
import { OrderDetail } from '@/components/orders'
import { useOrders } from '@/hooks/useOrders'
import { type Order } from '@/services/orders.service'
import { useUserLocations } from '@/hooks/useUserLocations'
import { useAuth } from '@/stores/auth.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { logger } from '@/utils/logger'
import { supabase } from '@/lib/supabase/client'
import { useDockOffset } from '@/navigation/DashboardNavigator'

type NavSection = 'all' | 'needs_action' | 'in_progress' | 'completed' | 'cancelled'
type DateRange = 'today' | 'week' | 'month' | 'all'

// Date range helper
function getDateRangeFilter(range: DateRange): Date | null {
  const now = new Date()
  switch (range) {
    case 'today':
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      return today
    case 'week':
      const week = new Date(now)
      week.setDate(now.getDate() - 7)
      return week
    case 'month':
      const month = new Date(now)
      month.setDate(now.getDate() - 30)
      return month
    case 'all':
      return null
  }
}

// Group orders by date
function groupOrdersByDate(orders: Order[]) {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(today.getDate() - 7)

  const groups: { title: string; data: Order[] }[] = []
  const todayOrders: Order[] = []
  const yesterdayOrders: Order[] = []
  const thisWeekOrders: Order[] = []
  const olderOrders: Order[] = []

  orders.forEach(order => {
    const orderDate = new Date(order.created_at)
    if (orderDate >= today) {
      todayOrders.push(order)
    } else if (orderDate >= yesterday) {
      yesterdayOrders.push(order)
    } else if (orderDate >= thisWeekStart) {
      thisWeekOrders.push(order)
    } else {
      olderOrders.push(order)
    }
  })

  if (todayOrders.length > 0) {
    groups.push({ title: 'Today', data: todayOrders })
  }
  if (yesterdayOrders.length > 0) {
    groups.push({ title: 'Yesterday', data: yesterdayOrders })
  }
  if (thisWeekOrders.length > 0) {
    groups.push({ title: 'This Week', data: thisWeekOrders })
  }
  if (olderOrders.length > 0) {
    groups.push({ title: 'Older', data: olderOrders })
  }

  return groups
}

// Memoized Order Item - Optimized for FlatList
const OrderItem = React.memo<{
  order: Order
  showLocation: boolean
  isSelected: boolean
  isLast: boolean
  onPress: () => void
}>(({ order, showLocation, isSelected, isLast, onPress }) => {
  // Format time
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Get status color - Clean color coding like stock colors
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'completed':
        return '#34c759' // Green
      case 'cancelled':
        return '#ff3b30' // Red
      case 'pending':
      case 'ready_to_ship':
        return '#ff9500' // Orange
      case 'preparing':
      case 'ready':
      case 'out_for_delivery':
      case 'shipped':
      case 'in_transit':
      case 'delivered':
        return '#fff' // White for in-progress
      default:
        return '#8e8e93' // Gray
    }
  }

  // Get status label - Human-friendly
  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'preparing':
        return 'Preparing'
      case 'ready':
        return 'Ready'
      case 'out_for_delivery':
        return 'Out for Delivery'
      case 'ready_to_ship':
        return 'Ready to Ship'
      case 'shipped':
        return 'Shipped'
      case 'in_transit':
        return 'In Transit'
      case 'delivered':
        return 'Delivered'
      case 'completed':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
    }
  }

  // Get order type - Clean, no emojis
  const getOrderType = () => {
    // Prefer new order_type field, fallback to legacy delivery_type
    const type = order.order_type || order.delivery_type || 'walk_in'
    switch (type.toLowerCase()) {
      case 'walk_in':
      case 'instore':
        return 'Walk-in'
      case 'pickup':
        return 'Pickup'
      case 'delivery':
        return 'Delivery'
      case 'shipping':
        return 'Shipping'
      default:
        return 'Store'
    }
  }

  const orderType = getOrderType()

  // Get customer initials for icon
  const customerInitials = order.customer_name
    ? order.customer_name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'G'

  return (
    <Pressable
      style={[
        styles.orderItem,
        isSelected && styles.orderItemActive,
        isLast && styles.orderItemLast,
      ]}
      onPress={onPress}
      accessibilityRole="none"
    >
      {/* Icon/Placeholder */}
      <View style={styles.orderIcon}>
        <View style={[styles.orderIconPlaceholder, styles.orderIconImage]}>
          <Text style={styles.orderIconText}>
            {customerInitials}
          </Text>
        </View>
      </View>

      {/* Customer Name & Time */}
      <View style={styles.orderInfo}>
        <Text style={styles.customerName} numberOfLines={1}>
          {order.customer_name || 'Guest'}
        </Text>
        <Text style={styles.orderMeta} numberOfLines={1}>
          {timeStr}
        </Text>
      </View>

      {/* Location Column (conditional) */}
      {showLocation && (
        <View style={styles.dataColumn}>
          <Text style={styles.dataLabel}>LOCATION</Text>
          <Text style={styles.dataValue} numberOfLines={1}>
            {order.pickup_location_name || 'Online'}
          </Text>
        </View>
      )}

      {/* Type Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>TYPE</Text>
        <Text style={styles.dataValue}>
          {orderType}
        </Text>
      </View>

      {/* Status Column - Apple-style badge */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>STATUS</Text>
        <Text
          style={[
            styles.dataValue,
            { color: getStatusColor(order.status) }
          ]}
        >
          {getStatusLabel(order.status)}
        </Text>
      </View>

      {/* Total Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>TOTAL</Text>
        <Text style={styles.dataValue}>
          ${order.total_amount.toFixed(2)}
        </Text>
      </View>
    </Pressable>
  )
})

OrderItem.displayName = 'OrderItem'

// Section Header Component
const SectionHeader = React.memo<{ title: string; isFirst: boolean }>(({ title, isFirst }) => (
  <View style={[styles.sectionHeader, isFirst && styles.sectionHeaderFirst]}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
))

SectionHeader.displayName = 'SectionHeader'

function OrdersScreenComponent() {
  const { user } = useAuth()
  const { setDockOffset } = useDockOffset()
  const [activeNav, setActiveNav] = useState<NavSection>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [navSearchQuery, setNavSearchQuery] = useState('')
  const [vendorLogo, setVendorLogo] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange>('today')
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
          .eq('email', user.email)
          .single()

        if (userError) {
          logger.error('User query error', { error: userError })
          return
        }

        if (userData?.vendors) {
          const vendor = userData.vendors as any
          setVendorName(vendor.store_name || '')
          setVendorLogo(vendor.logo_url || null)
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
    const items: Array<
      | { type: 'section'; group: { title: string; data: Order[] }; isFirst: boolean }
    > = []

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

  // Automatically update dock position based on detail view visibility
  useEffect(() => {
    if (selectedOrder) {
      // Detail view visible: dock centers on detail panel (right half of content)
      const detailPanelOffset = layout.sidebarWidth + (contentWidth / 2)
      setDockOffset(detailPanelOffset)
    } else {
      // List view: dock uses default sidebar offset
      setDockOffset(null)
    }

    // Cleanup: reset to default when unmounting
    return () => setDockOffset(null)
  }, [selectedOrder, contentWidth, setDockOffset])

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
                    <Text style={styles.largeTitleHeader}>
                      {activeNav === 'all' ? 'All Orders' :
                       activeNav === 'needs_action' ? 'Needs Action' :
                       activeNav === 'in_progress' ? 'In Progress' :
                       activeNav === 'completed' ? 'Completed' :
                       activeNav === 'cancelled' ? 'Cancelled' :
                       'Orders'}
                    </Text>
                  </View>
                )}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={true}
                indicatorStyle="white"
                scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
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


// Helper functions
function getStatusStyle(status: Order['status']) {
  switch (status) {
    case 'completed':
      return { color: '#34c759' }
    case 'preparing':
      return { color: '#0a84ff' }
    case 'ready':
    case 'out_for_delivery':
      return { color: '#bf5af2' }
    case 'cancelled':
      return { color: '#ff3b30' }
    default:
      return { color: '#ff9500' }
  }
}

function getOrderTypeLabel(order: Order): string {
  const type = order.delivery_type || order.order_type || 'instore'
  switch (type.toLowerCase()) {
    case 'pickup':
      return 'Pickup'
    case 'delivery':
    case 'shipping':
      return 'Delivery'
    default:
      return 'In-Store'
  }
}

// SettingsRow Component
function SettingsRow({
  label,
  value,
  showChevron = true,
  onPress,
}: {
  label: string
  value?: string
  showChevron?: boolean
  onPress?: () => void
}) {
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress()
    }
  }

  return (
    <Pressable style={styles.row} onPress={handlePress} disabled={!onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {showChevron && <Text style={styles.rowChevron}>􀆊</Text>}
      </View>
    </Pressable>
  )
}

// Export memoized version for performance
export const OrdersScreen = memo(OrdersScreenComponent)
OrdersScreen.displayName = 'OrdersScreen'

// STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    overflow: 'hidden',
  },

  // MIDDLE ORDERS LIST
  ordersList: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#000',
  },

  // iOS Collapsing Headers
  fixedHeader: {
    position: 'absolute',
    top: layout.cardPadding,
    left: 6,
    minHeight: layout.minTouchTarget,
    zIndex: 20, // Above fade gradient
  },
  fixedDateRangeSelector: {
    position: 'absolute',
    top: layout.cardPadding,
    right: 6,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20, // Above fade gradient
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    paddingTop: 100,
    paddingBottom: 8,
  },

  // Date Range Selector
  dateRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateRangeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dateRangeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  dateRangeButtonTextActive: {
    color: '#fff',
  },

  // FlatList
  flatListContent: {
    paddingBottom: layout.dockHeight,
  },

  // Card Wrapper - iOS-style spacing
  cardWrapper: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginBottom: 8,
  },
  ordersCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', // Solid glass effect
  },

  // Section Headers
  sectionHeader: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  sectionHeaderFirst: {
    paddingTop: 4, // Less padding for first section
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },

  // Order Items
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal + 6,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: layout.minTouchTarget,
  },
  orderItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  orderItemLast: {
    borderBottomWidth: 0,
  },
  orderIcon: {
    width: 44,
    height: 44,
  },
  orderIconImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  orderIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconText: {
    fontSize: 20,
    color: 'rgba(235,235,245,0.6)',
  },
  orderInfo: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  orderMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
  },
  dataColumn: {
    minWidth: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateIcon: {
    fontSize: 40,
    color: 'rgba(235,235,245,0.3)',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.9)',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.2,
  },

  // RIGHT DETAIL PANEL
  detailPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#000',
  },
  emptyDetail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 17,
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'center',
  },

  // DETAIL CONTENT
  detail: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: layout.cardPadding,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  headerCardContainer: {
    marginHorizontal: 6,
    marginTop: layout.sectionSpacing,
    marginBottom: layout.sectionSpacing,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.cardPadding,
    gap: layout.cardPadding,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 28,
    color: 'rgba(235,235,245,0.6)',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
  headerDot: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },

  // SECTIONS
  section: {
    marginHorizontal: 6,
    marginBottom: layout.sectionSpacing,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.cardPadding,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  rowChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.3)',
  },
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inventoryTotal: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#fff',
  },
})
