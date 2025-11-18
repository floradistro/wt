/**
 * Orders Screen
 * iPad Settings-style interface with Liquid Glass
 * Apple-quality performance for hundreds of orders per day
 * Uses FlatList virtualization and intelligent date filtering
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated, useWindowDimensions, FlatList, RefreshControl } from 'react-native'
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { NavSidebar, type NavItem } from '@/components/NavSidebar'
import { LocationSelector } from '@/components/LocationSelector'
import { useOrders } from '@/hooks/useOrders'
import { type Order } from '@/services/orders.service'
import { useUserLocations } from '@/hooks/useUserLocations'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'
import { supabase } from '@/lib/supabase/client'

type NavSection = 'all' | 'pending' | 'processing' | 'ready' | 'completed'
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
  onPress: () => void
}>(({ order, showLocation, isSelected, onPress }) => {
  // Format time
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Get status color
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'completed':
        return '#34c759' // Green
      case 'processing':
        return '#0a84ff' // Blue
      case 'cancelled':
        return '#ff3b30' // Red
      default:
        return '#ff9500' // Orange
    }
  }

  // Get order type label
  const getOrderTypeLabel = () => {
    const type = order.delivery_type || order.order_type || 'instore'
    switch (type.toLowerCase()) {
      case 'pickup':
        return 'Pickup'
      case 'delivery':
      case 'shipping':
        return 'Delivery'
      default:
        return 'Store'
    }
  }

  const orderTypeLabel = getOrderTypeLabel()

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
        <Text style={styles.dataValue}>{orderTypeLabel}</Text>
      </View>

      {/* Status Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>STATUS</Text>
        <Text
          style={[
            styles.dataValue,
            { color: getStatusColor(order.status) }
          ]}
        >
          {order.status.toUpperCase()}
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
const SectionHeader = React.memo<{ title: string }>(({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
))

SectionHeader.displayName = 'SectionHeader'

export function OrdersScreen() {
  const { user } = useAuth()
  const [activeNav, setActiveNav] = useState<NavSection>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [navSearchQuery, setNavSearchQuery] = useState('')
  const [vendorLogo, setVendorLogo] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string>('')
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Location filtering
  const { locations: userLocations } = useUserLocations()
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
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

  // Sliding animation
  const slideAnim = useRef(new Animated.Value(0)).current

  const { width } = useWindowDimensions()
  const contentWidth = width - layout.sidebarWidth

  // Load orders with intelligent defaults (today only)
  const { orders, loading: isLoading, refresh } = useOrders({
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

  // Filter orders by status, date, search, and location
  const filteredOrders = useMemo(() => {
    const dateFilter = getDateRangeFilter(dateRange)

    return orders.filter((order) => {
      // Status filter
      if (activeNav !== 'all') {
        if (order.status !== activeNav) {
          return false
        }
      }

      // Date range filter
      if (dateFilter) {
        const orderDate = new Date(order.created_at)
        if (orderDate < dateFilter) {
          return false
        }
      }

      // Location filter
      if (selectedLocationIds.length > 0) {
        if (!order.pickup_location_id || !selectedLocationIds.includes(order.pickup_location_id)) {
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
  }, [orders, activeNav, dateRange, navSearchQuery, selectedLocationIds])

  // Group filtered orders by date
  const groupedOrders = useMemo(() => groupOrdersByDate(filteredOrders), [filteredOrders])

  // Flatten for FlatList
  const flatListData = useMemo(() => {
    const items: Array<{ type: 'header'; title: string } | { type: 'order'; order: Order }> = []
    groupedOrders.forEach(group => {
      items.push({ type: 'header', title: group.title })
      group.data.forEach(order => {
        items.push({ type: 'order', order })
      })
    })
    return items
  }, [groupedOrders])

  // Calculate counts for badges (from all orders, not filtered)
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const processingCount = orders.filter(o => o.status === 'processing').length
  const completedCount = orders.filter(o => o.status === 'completed').length

  // Nav items configuration
  const navItems: NavItem[] = useMemo(() => [
    {
      id: 'all',
      icon: 'grid',
      label: 'All Orders',
      count: filteredOrders.length,
    },
    {
      id: 'pending',
      icon: 'clock',
      label: 'Pending',
      count: pendingCount,
      badge: pendingCount > 0 ? 'warning' as const : undefined,
    },
    {
      id: 'processing',
      icon: 'package',
      label: 'In Progress',
      count: processingCount,
      badge: processingCount > 0 ? 'info' as const : undefined,
    },
    {
      id: 'ready',
      icon: 'check',
      label: 'Ready',
      count: 0,
    },
    {
      id: 'completed',
      icon: 'checkCircle',
      label: 'Completed',
      count: completedCount,
    },
  ], [filteredOrders.length, pendingCount, processingCount, completedCount])

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
    if (item.type === 'header') {
      return <SectionHeader title={item.title} />
    } else {
      return (
        <OrderItem
          order={item.order}
          showLocation={showLocationColumn}
          isSelected={selectedOrder?.id === item.order.id}
          onPress={() => handleOrderSelect(item.order)}
        />
      )
    }
  }, [showLocationColumn, selectedOrder, handleOrderSelect])

  const keyExtractor = useCallback((item: typeof flatListData[0], index: number) => {
    if (item.type === 'header') {
      return `header-${item.title}`
    } else {
      return item.order.id
    }
  }, [])

  const getItemType = useCallback((item: typeof flatListData[0]) => {
    return item.type
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
            {/* Header with Date Filter */}
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>
                {activeNav === 'all' ? 'All Orders' : activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}
              </Text>

              {/* Date Range Selector */}
              <View style={styles.dateRangeSelector}>
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
            </View>

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
                getItemType={getItemType}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={true}
                indicatorStyle="white"
                scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
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
      />
    </SafeAreaView>
  )
}

// Order Detail Component (same as before)
function OrderDetail({
  order,
  onBack,
  onOrderUpdated,
}: {
  order: Order
  onBack: () => void
  onOrderUpdated: () => void
}) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id)

      if (error) throw error

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onOrderUpdated()
    } catch (error) {
      logger.error('Failed to update order status:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <FlatList
      style={styles.detail}
      contentContainerStyle={{ paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
      data={[1]} // Dummy data to use FlatList as ScrollView
      renderItem={() => (
        <>
          {/* Header */}
          <View style={styles.detailHeader}>
            <Pressable onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>‹ Orders</Text>
            </Pressable>
          </View>

          {/* Order Header Card */}
          <View style={styles.headerCardContainer}>
            <View style={styles.headerCardGlass}>
              <View style={styles.headerCard}>
                <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                  <Text style={styles.headerIconText}>
                    {order.customer_name
                      ? order.customer_name
                          .split(' ')
                          .map(n => n.charAt(0))
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      : 'G'}
                  </Text>
                </View>
                <View style={styles.headerInfo}>
                  <Text style={styles.headerTitle}>{order.customer_name || 'Guest'}</Text>
                  <View style={styles.headerMeta}>
                    <Text style={styles.headerSubtitle}>
                      {order.order_number}
                    </Text>
                    <Text style={styles.headerDot}>•</Text>
                    <Text style={styles.headerSubtitle}>
                      {getOrderTypeLabel(order)}
                    </Text>
                    <Text style={styles.headerDot}>•</Text>
                    <Text style={styles.headerSubtitle}>
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })} at {new Date(order.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text style={styles.headerDot}>•</Text>
                    <Text style={[styles.headerSubtitle, getStatusStyle(order.status)]}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Customer Info */}
          {(order.customer_email || order.customer_phone) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CUSTOMER</Text>
              <View style={styles.cardGlass}>
                {order.customer_email && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Email</Text>
                    <Text style={styles.rowValue}>{order.customer_email}</Text>
                  </View>
                )}
                {order.customer_phone && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Phone</Text>
                    <Text style={styles.rowValue}>{order.customer_phone}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SUMMARY</Text>
            <View style={styles.cardGlass}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Subtotal</Text>
                <Text style={styles.rowValue}>${order.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Tax</Text>
                <Text style={styles.rowValue}>${order.tax_amount.toFixed(2)}</Text>
              </View>
              {order.discount_amount > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Discount</Text>
                  <Text style={styles.rowValue}>-${order.discount_amount.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.inventoryHeader}>
                <Text style={styles.rowLabel}>Total</Text>
                <Text style={styles.inventoryTotal}>${order.total_amount.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Order Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER DETAILS</Text>
            <View style={styles.cardGlass}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Order Type</Text>
                <Text style={styles.rowValue}>{getOrderTypeLabel(order)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Order Status</Text>
                <Text style={[styles.rowValue, getStatusStyle(order.status)]}>
                  {order.status.toUpperCase()}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Payment Status</Text>
                <Text style={styles.rowValue}>{order.payment_status.toUpperCase()}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Fulfillment</Text>
                <Text style={styles.rowValue}>{order.fulfillment_status.toUpperCase()}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Order Date</Text>
                <Text style={styles.rowValue}>
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Order Time</Text>
                <Text style={styles.rowValue}>
                  {new Date(order.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIONS</Text>
            <View style={styles.cardGlass}>
              {order.status === 'pending' && (
                <SettingsRow
                  label="Mark as Processing"
                  onPress={() => handleStatusUpdate('processing')}
                />
              )}
              {order.status === 'processing' && (
                <SettingsRow
                  label="Mark as Completed"
                  onPress={() => handleStatusUpdate('completed')}
                />
              )}
              <SettingsRow label="View Customer" />
              <SettingsRow label="Print Receipt" />
            </View>
          </View>
        </>
      )}
      keyExtractor={() => 'detail'}
    />
  )
}

// Helper functions
function getStatusStyle(status: Order['status']) {
  switch (status) {
    case 'completed':
      return { color: '#34c759' }
    case 'processing':
      return { color: '#0a84ff' }
    case 'cancelled':
      return { color: '#ff3b30' }
    default:
      return {}
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

  // List Header with Date Filter
  listHeader: {
    paddingHorizontal: 6,
    paddingTop: layout.cardPadding,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  listHeaderTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  dateRangeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  dateRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
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

  // Section Headers
  sectionHeader: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: '#000',
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
    minWidth: 100,
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
