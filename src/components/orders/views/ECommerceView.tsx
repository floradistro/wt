/**
 * ECommerceView Component
 * Lists all e-commerce shipping orders with status filtering
 * Apple-style: Segmented control for Active/Completed
 */

import React, { useMemo, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet, ScrollView, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useFilteredOrders } from '@/stores/order-filter.store'
import { OrderItem, SectionHeader } from '@/components/orders'
import { ordersStyles } from '@/components/orders/orders.styles'
import type { Order } from '@/services/orders.service'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { TitleSection } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { useDateRange, useOrdersUIActions, type DateRange } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'

interface ECommerceViewProps {
  isLoading?: boolean
}

export function ECommerceView({ isLoading = false }: ECommerceViewProps) {
  const { vendor, locations } = useAppAuth()
  const filteredOrders = useFilteredOrders()
  const dateRange = useDateRange()
  const { setDateRange, openLocationSelector } = useOrdersUIActions()
  const { selectedLocationIds } = useLocationFilter()

  // Apple-style: Simple binary toggle - Active or Completed
  const [viewSegment, setViewSegment] = useState<'active' | 'completed'>('active')

  // Location button label
  const locationButtonLabel = selectedLocationIds.length === 0
    ? 'All Locations'
    : selectedLocationIds.length === 1
      ? locations.find(l => l.id === selectedLocationIds[0])?.name || '1 Location'
      : `${selectedLocationIds.length} Locations`

  // Date filter pills
  const dateFilterPills: FilterPill[] = [
    { id: 'today', label: '1 Day' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'all', label: 'All' },
    { id: 'custom', label: 'Custom' },
  ]

  // Handle date filter selection
  const handleDateFilterSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setDateRange(id as DateRange)
  }

  // Filter for orders with shipping items at user's location
  // SPLIT ORDER SUPPORT: Shows orders where user's location needs to ship items
  const shippingOrders = useMemo(() => {
    return filteredOrders.filter((order) => {
      const fulfillmentLocs = order.fulfillment_locations || []
      const isSplitOrder = fulfillmentLocs.length > 1
      const pickupLocationId = order.pickup_location_id

      // Pure shipping order - always show in E-Commerce
      if (order.order_type === 'shipping') return true

      // Not a split order and not shipping type - don't show
      if (!isSplitOrder) return false

      // Split order - show if user's location needs to ship items
      // (i.e., user's location is NOT the pickup location)
      if (selectedLocationIds.length > 0) {
        // Check if any of user's selected locations need to ship items
        return fulfillmentLocs.some(loc => {
          const isUserLocation = selectedLocationIds.includes(loc.location_id)
          const isShippingPortion = loc.location_id !== pickupLocationId
          return isUserLocation && isShippingPortion
        })
      }

      // No location filter - show all split orders in E-Commerce
      // (they have at least some items that need shipping from non-pickup locations)
      return fulfillmentLocs.some(loc => loc.location_id !== pickupLocationId)
    })
  }, [filteredOrders, selectedLocationIds])

  // Separate active vs completed orders
  const { activeOrders, completedOrders, activeCount, completedCount } = useMemo(() => {
    // Active = needs action (pending, confirmed, preparing, packing, packed, ready_to_ship)
    const active = shippingOrders.filter(
      (o) => ['pending', 'confirmed', 'preparing', 'packing', 'packed', 'ready_to_ship'].includes(o.status)
    )

    // Completed = shipped, in transit, or delivered
    const completed = shippingOrders.filter(
      (o) => ['shipped', 'in_transit', 'delivered'].includes(o.status)
    )

    return {
      activeOrders: active,
      completedOrders: completed,
      activeCount: active.length,
      completedCount: completed.length,
    }
  }, [shippingOrders])

  // Group based on current segment
  // SIMPLIFIED: Just two groups for active - Ready to Ship and To Fulfill
  const shippingGrouped = useMemo(() => {
    const groups: Array<{ title: string; data: Order[] }> = []

    if (viewSegment === 'active') {
      if (activeOrders.length > 0) {
        // Simple two-group approach:
        // 1. Ready to Ship = packed/ready, waiting to ship
        // 2. To Fulfill = everything else (pending, confirmed, preparing)
        const readyToShip = activeOrders.filter(o => ['packed', 'ready_to_ship'].includes(o.status))
        const toFulfill = activeOrders.filter(o => !['packed', 'ready_to_ship'].includes(o.status))

        if (readyToShip.length > 0) groups.push({ title: 'Ready to Ship', data: readyToShip })
        if (toFulfill.length > 0) groups.push({ title: 'To Fulfill', data: toFulfill })
      }
    } else {
      if (completedOrders.length > 0) {
        // All shipped/delivered together
        groups.push({ title: 'Shipped', data: completedOrders.slice(0, 50) })
      }
    }

    return groups
  }, [viewSegment, activeOrders, completedOrders])

  // Flatten for FlatList
  const flatListData = useMemo(() => {
    return shippingGrouped.map((group, index) => ({
      type: 'section' as const,
      group,
      isFirst: index === 0,
    }))
  }, [shippingGrouped])

  const renderItem = ({ item }: { item: typeof flatListData[0] }) => {
    const { group, isFirst } = item
    return (
      <>
        <SectionHeader title={group.title} isFirst={isFirst} />
        <View style={ordersStyles.cardWrapper}>
          <View style={ordersStyles.ordersCardGlass}>
            {group.data.map((order, index) => (
              <OrderItem
                key={order.id}
                order={order}
                showLocation={false}
                isLast={index === group.data.length - 1}
              />
            ))}
          </View>
        </View>
      </>
    )
  }

  // Handle segment change with haptic
  const handleSegmentChange = (segment: 'active' | 'completed') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setViewSegment(segment)
  }

  // Render the header with title and segmented control
  const renderHeader = () => (
    <>
      <TitleSection
        title="E-Commerce"
        logo={vendor?.logo_url}
        subtitle={`${shippingOrders.length} shipping ${shippingOrders.length === 1 ? 'order' : 'orders'}`}
        hideButton
        secondaryButtonText={locationButtonLabel}
        secondaryButtonIcon="location-outline"
        onSecondaryButtonPress={openLocationSelector}
      />

      {/* Apple-style Segmented Control */}
      <View style={styles.segmentWrapper}>
        <View style={styles.segmentContainer}>
          <Pressable
            style={[
              styles.segmentButton,
              viewSegment === 'active' && styles.segmentButtonActive,
            ]}
            onPress={() => handleSegmentChange('active')}
          >
            <Text style={[
              styles.segmentText,
              viewSegment === 'active' && styles.segmentTextActive,
            ]}>
              Active{activeCount > 0 ? ` (${activeCount})` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentButton,
              viewSegment === 'completed' && styles.segmentButtonActive,
            ]}
            onPress={() => handleSegmentChange('completed')}
          >
            <Text style={[
              styles.segmentText,
              viewSegment === 'completed' && styles.segmentTextActive,
            ]}>
              Completed{completedCount > 0 ? ` (${completedCount})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Date Filter Row - Below Segment */}
      <View style={styles.dateFilterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateFilterContainer}
        >
          {dateFilterPills.map((pill) => (
            <Pressable
              key={pill.id}
              style={[
                styles.dateFilterPill,
                dateRange === pill.id && styles.dateFilterPillActive,
              ]}
              onPress={() => handleDateFilterSelect(pill.id)}
            >
              <Text style={[
                styles.dateFilterText,
                dateRange === pill.id && styles.dateFilterTextActive,
              ]}>
                {pill.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </>
  )

  if (isLoading) {
    return (
      <>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.text.secondary} />
        </View>
      </>
    )
  }

  if (flatListData.length === 0) {
    return (
      <>
        {renderHeader()}
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No Shipping Orders</Text>
          <Text style={styles.emptyStateText}>
            E-commerce shipping orders will appear here
          </Text>
        </View>
      </>
    )
  }

  return (
    <FlatList
      data={flatListData}
      renderItem={renderItem}
      keyExtractor={(item, index) => `section-${item.group.title}-${index}`}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={ordersStyles.flatListContent}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
      maxToRenderPerBatch={3}
      updateCellsBatchingPeriod={100}
      initialNumToRender={3}
      windowSize={5}
      removeClippedSubviews={true}
    />
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // Apple-style Segmented Control
  segmentWrapper: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: spacing.md,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118,118,128,0.24)',
    borderRadius: 9,
    padding: 2,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.6)',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Date Filter Row - Below Segment (Apple Style)
  dateFilterWrapper: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: spacing.md,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dateFilterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dateFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
  },
  dateFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
})
