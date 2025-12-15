/**
 * POSOrderFeed - Order Grid for POS
 *
 * Mirrors POSProductBrowser structure:
 * - FlatList virtualized grid
 * - Real-time order updates via store
 * - Status-based filtering via pos-order-filter.store
 * - Search bar matching product search bar exactly
 * - Filter dropdown for status groups
 * - Zero prop drilling
 */

import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { View, Text, StyleSheet, RefreshControl, FlatList, Pressable, ScrollView, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { layout } from '@/theme/layout'

// Components
import { POSOrderCard } from '../POSOrderCard'

// Context
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useAppAuth } from '@/contexts/AppAuthContext'

// Stores
import { useOrders, useOrdersLoading, useOrdersActions } from '@/stores/orders.store'
import {
  usePOSOrderFilters,
  usePOSOrderActiveFilterCount,
  posOrderFilterActions,
  applyPOSOrderFilters,
  type POSOrderStatusGroup,
} from '@/stores/pos-order-filter.store'

// Types
import type { Order } from '@/services/orders.service'
import { logger } from '@/utils/logger'

// Status group labels for filter dropdown
const STATUS_GROUP_LABELS: { key: POSOrderStatusGroup; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'errors', label: 'Errors' },
  { key: 'all', label: 'All Orders' },
]

// Order type labels for filter dropdown
const ORDER_TYPE_LABELS: { key: string; label: string }[] = [
  { key: 'all', label: 'All Types' },
  { key: 'walk_in', label: 'Walk-in (POS)' },
  { key: 'pickup', label: 'In-Store Pickup' },
  { key: 'shipping', label: 'Ship to Customer' },
]

export function POSOrderFeed() {
  const { session } = usePOSSession()
  const { vendor } = useAppAuth()
  const insets = useSafeAreaInsets()

  // Store data
  const orders = useOrders()
  const loading = useOrdersLoading()
  const { loadOrders, refreshOrders, subscribeToOrders, unsubscribe } = useOrdersActions()

  // Filter store
  const filters = usePOSOrderFilters()
  const activeFilterCount = usePOSOrderActiveFilterCount()

  // Local state
  const [refreshing, setRefreshing] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Animations
  const filterDropdownAnim = useRef(new Animated.Value(0)).current
  const filterScaleAnim = useRef(new Animated.Value(0.92)).current

  // Load orders and subscribe to real-time updates
  useEffect(() => {
    if (vendor?.id) {
      logger.info('[POSOrderFeed] Loading orders for vendor:', vendor.id)
      loadOrders()
      subscribeToOrders()

      return () => {
        unsubscribe()
      }
    }
  }, [vendor?.id])

  // Animate filter dropdown
  useEffect(() => {
    if (showFilterDropdown) {
      Animated.parallel([
        Animated.spring(filterDropdownAnim, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.spring(filterScaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(filterDropdownAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(filterScaleAnim, {
          toValue: 0.92,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [showFilterDropdown, filterDropdownAnim, filterScaleAnim])

  // Apply filters from store
  const filteredOrders = useMemo(() => {
    return applyPOSOrderFilters(orders, filters)
  }, [orders, filters])

  // Filter by current location if in POS session
  const locationFilteredOrders = useMemo(() => {
    if (!session?.locationId) return filteredOrders

    // Show orders that include the current POS location
    return filteredOrders.filter(order => {
      // Check if pickup location matches
      if (order.pickup_location_id === session.locationId) return true

      // Check if order has fulfillment from this location
      if (order.fulfillment_locations?.some(loc => loc.location_id === session.locationId)) return true

      // Walk-in orders created at this location (via pickup_location_id for walk-ins)
      if (order.order_type === 'walk_in' && order.pickup_location_id === session.locationId) return true

      return false
    })
  }, [filteredOrders, session?.locationId])

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await refreshOrders()
    setRefreshing(false)
  }, [refreshOrders])

  // Handlers
  const handleFilterPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowFilterDropdown(true)
  }, [])

  const handleClearFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    posOrderFilterActions.clearFilters()
  }, [])

  const handleStatusGroupPress = useCallback((group: POSOrderStatusGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    posOrderFilterActions.setStatusGroup(group)
    setShowFilterDropdown(false)
  }, [])

  const handleOrderTypePress = useCallback((type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    posOrderFilterActions.setOrderType(type)
    setShowFilterDropdown(false)
  }, [])

  // Render order card
  const renderItem = useCallback(({ item }: { item: Order }) => (
    <POSOrderCard order={item} />
  ), [])

  // Key extractor
  const keyExtractor = useCallback((item: Order) => item.id, [])

  // Content container style with safe area - matches POSProductGrid
  const listContentStyle = useMemo(() => ({
    padding: 8,
    paddingTop: insets.top + layout.pos.searchBarHeight + 16, // insets.top + 48px search bar + 16px gap
    paddingBottom: Math.max(layout.dockHeight, insets.bottom + 16),
  }), [insets.top, insets.bottom])

  if (!vendor) return null

  return (
    <View style={styles.container}>
      {/* Filter Dropdown - Dock style with liquid glass */}
      {showFilterDropdown && (
        <>
          <Animated.View
            style={[
              styles.filterOverlay,
              { opacity: filterDropdownAnim }
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setShowFilterDropdown(false)}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.filterDropdownWrapper,
              {
                opacity: filterDropdownAnim,
                transform: [
                  { scale: filterScaleAnim },
                  {
                    translateY: filterDropdownAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <LiquidGlassView
              key="pos-order-filter-dropdown-container"
              effect="regular"
              colorScheme="dark"
              style={[
                styles.filterDropdownContainer,
                !isLiquidGlassSupported && styles.filterDropdownFallback
              ]}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.filterScrollView}
                contentContainerStyle={styles.filterScrollContent}
              >
                {/* Status Group Section */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionLabel}>STATUS</Text>
                  <View style={styles.filterGroupContainer}>
                    {STATUS_GROUP_LABELS.map((item, index) => {
                      const isSelected = filters.statusGroup === item.key
                      const isFirst = index === 0
                      const isLast = index === STATUS_GROUP_LABELS.length - 1
                      return (
                        <LiquidGlassView
                          key={`filter-status-${item.key}-${isSelected}`}
                          effect="clear"
                          colorScheme="dark"
                          interactive
                          style={[
                            styles.filterItem,
                            isFirst && styles.filterItemFirst,
                            isLast && styles.filterItemLast,
                            isSelected && styles.filterItemSelected,
                            !isLiquidGlassSupported && styles.filterItemFallback
                          ]}
                        >
                          <Pressable
                            onPress={() => handleStatusGroupPress(item.key)}
                            style={[
                              styles.filterItemPressable,
                              isLast && styles.filterItemPressableLast
                            ]}
                          >
                            <Text style={styles.filterItemText}>{item.label}</Text>
                            {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                          </Pressable>
                        </LiquidGlassView>
                      )
                    })}
                  </View>
                </View>

                {/* Order Type Section */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionLabel}>ORDER TYPE</Text>
                  <View style={styles.filterGroupContainer}>
                    {ORDER_TYPE_LABELS.map((item, index) => {
                      const isSelected = filters.orderType === item.key
                      const isFirst = index === 0
                      const isLast = index === ORDER_TYPE_LABELS.length - 1
                      return (
                        <LiquidGlassView
                          key={`filter-type-${item.key}-${isSelected}`}
                          effect="clear"
                          colorScheme="dark"
                          interactive
                          style={[
                            styles.filterItem,
                            isFirst && styles.filterItemFirst,
                            isLast && styles.filterItemLast,
                            isSelected && styles.filterItemSelected,
                            !isLiquidGlassSupported && styles.filterItemFallback
                          ]}
                        >
                          <Pressable
                            onPress={() => handleOrderTypePress(item.key)}
                            style={[
                              styles.filterItemPressable,
                              isLast && styles.filterItemPressableLast
                            ]}
                          >
                            <Text style={styles.filterItemText}>{item.label}</Text>
                            {isSelected && <Text style={styles.filterItemCheck}>✓</Text>}
                          </Pressable>
                        </LiquidGlassView>
                      )
                    })}
                  </View>
                </View>
              </ScrollView>
            </LiquidGlassView>
          </Animated.View>
        </>
      )}

      {/* Orders List */}
      <FlatList
        data={locationFilteredOrders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={listContentStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="rgba(255,255,255,0.5)"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No orders found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {!loading && (activeFilterCount > 0
                ? 'Try clearing filters'
                : 'New orders will appear here')}
            </Text>
          </View>
        }
      />

      {/* Search bar removed - unified search bar lives in POSSwipeableBrowser */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.2)',
  },
  // Filter Dropdown - Same as POSProductBrowser
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 999,
  },
  filterDropdownWrapper: {
    position: 'absolute',
    top: 56,
    left: 8,
    right: 8,
    zIndex: 1000,
  },
  filterDropdownContainer: {
    maxHeight: 400,
    borderRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 20,
    elevation: 12,
  },
  filterDropdownFallback: {
    backgroundColor: 'rgba(20,20,20,0.95)',
  },
  filterScrollView: {
    maxHeight: 400,
    backgroundColor: 'transparent',
  },
  filterScrollContent: {
    paddingVertical: layout.cardPadding,
    paddingHorizontal: layout.cardPadding,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  filterGroupContainer: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  filterItem: {
    overflow: 'hidden',
  },
  filterItemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  filterItemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  filterItemFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  filterItemPressable: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  filterItemPressableLast: {
    borderBottomWidth: 0,
  },
  filterItemText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.4,
  },
  filterItemCheck: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
  },
})
