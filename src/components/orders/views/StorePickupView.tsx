/**
 * StorePickupView Component
 * Lists all store pickup orders with status filtering
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

interface StorePickupViewProps {
  isLoading?: boolean
}

export function StorePickupView({ isLoading = false }: StorePickupViewProps) {
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

  // Filter for orders with pickup items at user's location
  // SPLIT ORDER SUPPORT: Shows orders where user's location handles pickup
  const pickupOrders = useMemo(() => {
    return filteredOrders.filter((order) => {
      const fulfillmentLocs = order.fulfillment_locations || []
      const isSplitOrder = fulfillmentLocs.length > 1
      const pickupLocationId = order.pickup_location_id

      // Not a pickup order type at all - don't show
      if (order.order_type !== 'pickup') return false

      // Pure pickup order (single location or no fulfillment tracking) - show
      if (!isSplitOrder) return true

      // Split order - show only if user's location is the pickup location
      if (selectedLocationIds.length > 0) {
        // User has location filter - only show if their location is the pickup location
        return pickupLocationId && selectedLocationIds.includes(pickupLocationId)
      }

      // No location filter - show all pickup orders (including split ones)
      return true
    })
  }, [filteredOrders, selectedLocationIds])

  // Separate active vs completed orders
  const { activeOrders, completedOrders, activeCount, completedCount } = useMemo(() => {
    // Active = needs action (pending, confirmed, preparing, ready)
    const active = pickupOrders.filter(
      (o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
    )

    // Completed = picked up or done
    const completed = pickupOrders.filter(
      (o) => o.status === 'completed' || o.status === 'picked_up'
    )

    return {
      activeOrders: active,
      completedOrders: completed,
      activeCount: active.length,
      completedCount: completed.length,
    }
  }, [pickupOrders])

  // Group based on current segment
  // SIMPLIFIED: Just two groups for active - Ready (waiting for customer) and To Prepare (everything else)
  const pickupGrouped = useMemo(() => {
    const groups: Array<{ title: string; data: Order[] }> = []

    if (viewSegment === 'active') {
      if (activeOrders.length > 0) {
        // Simple two-group approach:
        // 1. Ready for Pickup = items prepared, waiting for customer
        // 2. To Prepare = everything else (pending, confirmed, preparing)
        const ready = activeOrders.filter(o => o.status === 'ready')
        const toPrepare = activeOrders.filter(o => o.status !== 'ready')

        if (ready.length > 0) groups.push({ title: 'Ready for Pickup', data: ready })
        if (toPrepare.length > 0) groups.push({ title: 'To Prepare', data: toPrepare })
      }
    } else {
      if (completedOrders.length > 0) {
        groups.push({ title: 'Picked Up', data: completedOrders.slice(0, 50) })
      }
    }

    return groups
  }, [viewSegment, activeOrders, completedOrders])

  // Flatten for FlatList
  const flatListData = useMemo(() => {
    return pickupGrouped.map((group, index) => ({
      type: 'section' as const,
      group,
      isFirst: index === 0,
    }))
  }, [pickupGrouped])

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
        title="Store Pickup"
        logo={vendor?.logo_url}
        subtitle={`${pickupOrders.length} pickup ${pickupOrders.length === 1 ? 'order' : 'orders'}`}
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
          <Text style={styles.emptyStateTitle}>No Pickup Orders</Text>
          <Text style={styles.emptyStateText}>
            Store pickup orders will appear here
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
