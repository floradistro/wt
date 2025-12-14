/**
 * InStoreSalesView Component
 * Read-only view of completed in-store POS transactions
 * Follows ProductsListView pattern
 */

import React, { useMemo } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet, ScrollView, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useFilteredOrders } from '@/stores/order-filter.store'
import { OrderItem, SectionHeader } from '@/components/orders'
import { ordersStyles } from '@/components/orders/orders.styles'
import type { Order } from '@/services/orders.service'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { TitleSection, type FilterPill } from '@/components/shared'
import { useDateRange, useOrdersUIActions, type DateRange } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'

interface InStoreSalesViewProps {
  isLoading?: boolean
}

export function InStoreSalesView({ isLoading = false }: InStoreSalesViewProps) {
  const { vendor, locations } = useAppAuth()
  const filteredOrders = useFilteredOrders()
  const dateRange = useDateRange()
  const { setDateRange, openLocationSelector } = useOrdersUIActions()
  const { selectedLocationIds } = useLocationFilter()

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

  // Render the header with title and filters
  const renderHeader = () => (
    <>
      <TitleSection
        title="In-Store Sales"
        logo={vendor?.logo_url}
        subtitle={`Today's sales: $${todayTotal.toFixed(2)}`}
        hideButton
        secondaryButtonText={locationButtonLabel}
        secondaryButtonIcon="location-outline"
        onSecondaryButtonPress={openLocationSelector}
      />
      {/* Date Filter Row - Below Title */}
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

  // Filter for only walk-in orders
  const walkInOrders = useMemo(() => {
    return filteredOrders.filter((order) => order.order_type === 'walk_in')
  }, [filteredOrders])

  // Separate completed vs cancelled/failed orders
  const { completedOrders, cancelledOrders } = useMemo(() => {
    const completed = walkInOrders.filter(
      (o) => o.status === 'completed' && o.payment_status === 'paid'
    )
    const cancelled = walkInOrders.filter(
      (o) => o.status === 'cancelled' || o.payment_status === 'failed'
    )
    return { completedOrders: completed, cancelledOrders: cancelled }
  }, [walkInOrders])

  // Group completed orders by date
  const walkInGrouped = useMemo(() => {
    const groups: Array<{ title: string; data: Order[]; isCancelled?: boolean }> = []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Today's sales (completed only)
    const todaySales = completedOrders.filter((o) => {
      const orderDate = new Date(o.created_at)
      return orderDate >= today
    })
    if (todaySales.length > 0) {
      groups.push({ title: 'Today', data: todaySales })
    }

    // Yesterday's sales (completed only)
    const yesterdaySales = completedOrders.filter((o) => {
      const orderDate = new Date(o.created_at)
      return orderDate >= yesterday && orderDate < today
    })
    if (yesterdaySales.length > 0) {
      groups.push({ title: 'Yesterday', data: yesterdaySales })
    }

    // Older sales (completed only)
    const older = completedOrders.filter((o) => {
      const orderDate = new Date(o.created_at)
      return orderDate < yesterday
    })
    if (older.length > 0) {
      groups.push({ title: 'Older', data: older })
    }

    // Cancelled/Failed orders section
    if (cancelledOrders.length > 0) {
      groups.push({ title: 'Cancelled / Failed', data: cancelledOrders, isCancelled: true })
    }

    return groups
  }, [completedOrders, cancelledOrders])

  // Flatten for FlatList
  const flatListData = useMemo(() => {
    return walkInGrouped.map((group, index) => ({
      type: 'section' as const,
      group,
      isFirst: index === 0,
      isCancelled: group.isCancelled || false,
    }))
  }, [walkInGrouped])

  // Calculate today's total (only completed/paid orders)
  const todayTotal = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return walkInOrders
      .filter((o) => new Date(o.created_at) >= today)
      .filter((o) => o.status === 'completed' && o.payment_status === 'paid')
      .reduce((sum, o) => sum + o.total_amount, 0)
  }, [walkInOrders])

  const renderItem = ({ item }: { item: typeof flatListData[0] }) => {
    const { group, isFirst, isCancelled } = item
    return (
      <>
        {isCancelled ? (
          <View style={styles.cancelledHeader}>
            <Text style={styles.cancelledHeaderText}>{group.title}</Text>
            <Text style={styles.cancelledCount}>{group.data.length}</Text>
          </View>
        ) : (
          <SectionHeader title={group.title} isFirst={isFirst} />
        )}
        <View style={ordersStyles.cardWrapper}>
          <View style={[
            ordersStyles.ordersCardGlass,
            isCancelled && styles.cancelledCard,
          ]}>
            {group.data.map((order, index) => (
              <OrderItem
                key={order.id}
                order={order}
                showLocation={true}
                isLast={index === group.data.length - 1}
              />
            ))}
          </View>
        </View>
      </>
    )
  }

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
          <Text style={styles.emptyStateTitle}>No In-Store Sales</Text>
          <Text style={styles.emptyStateText}>
            Completed POS transactions will appear here
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
  // Date Filter Row - Below Title (Apple Style)
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
  // Cancelled section styles
  cancelledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.contentHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cancelledHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff453a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cancelledCount: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,69,58,0.6)',
    letterSpacing: -0.2,
  },
  cancelledCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.2)',
  },
})
