/**
 * InStoreSalesView Component
 * Read-only view of completed in-store POS transactions
 * Follows ProductsListView pattern
 */

import React, { useMemo } from 'react'
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native'
import { colors } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useFilteredOrders } from '@/stores/order-filter.store'
import { OrderItem, SectionHeader } from '@/components/orders'
import { ordersStyles } from '@/components/orders/orders.styles'
import type { Order } from '@/services/orders.service'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { TitleSection, type FilterPill } from '@/components/shared'
import { useDateRange, useOrdersUIActions, type DateRange } from '@/stores/orders-ui.store'

interface InStoreSalesViewProps {
  isLoading?: boolean
}

export function InStoreSalesView({ isLoading = false }: InStoreSalesViewProps) {
  const { vendor } = useAppAuth()
  const filteredOrders = useFilteredOrders()
  const dateRange = useDateRange()
  const { setDateRange } = useOrdersUIActions()

  // Date filter pills
  const dateFilterPills: FilterPill[] = [
    { id: 'today', label: '1 Day' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'all', label: 'All' },
    { id: 'custom', label: 'Custom' },
  ]

  // Filter for only walk-in orders
  const walkInOrders = useMemo(() => {
    return filteredOrders.filter((order) => order.order_type === 'walk_in')
  }, [filteredOrders])

  // Group walk-in orders by date
  const walkInGrouped = useMemo(() => {
    const groups: Array<{ title: string; data: Order[] }> = []

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Today's sales
    const todaySales = walkInOrders.filter((o) => {
      const orderDate = new Date(o.created_at)
      return orderDate >= today
    })
    if (todaySales.length > 0) {
      groups.push({ title: 'Today', data: todaySales })
    }

    // Yesterday's sales
    const yesterdaySales = walkInOrders.filter((o) => {
      const orderDate = new Date(o.created_at)
      return orderDate >= yesterday && orderDate < today
    })
    if (yesterdaySales.length > 0) {
      groups.push({ title: 'Yesterday', data: yesterdaySales })
    }

    // Older sales
    const older = walkInOrders.filter((o) => {
      const orderDate = new Date(o.created_at)
      return orderDate < yesterday
    })
    if (older.length > 0) {
      groups.push({ title: 'Older', data: older })
    }

    return groups
  }, [walkInOrders])

  // Flatten for FlatList
  const flatListData = useMemo(() => {
    return walkInGrouped.map((group, index) => ({
      type: 'section' as const,
      group,
      isFirst: index === 0,
    }))
  }, [walkInGrouped])

  // Calculate today's total
  const todayTotal = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return walkInOrders
      .filter((o) => new Date(o.created_at) >= today)
      .reduce((sum, o) => sum + o.total_amount, 0)
  }, [walkInOrders])

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
        <TitleSection
          title="In-Store Sales"
          logo={vendor?.logo_url}
          subtitle={`Today's sales: $${todayTotal.toFixed(2)}`}
          hideButton
          filterPills={dateFilterPills}
          activeFilterId={dateRange}
          onFilterSelect={(id) => setDateRange(id as DateRange)}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.text.secondary} />
        </View>
      </>
    )
  }

  if (flatListData.length === 0) {
    return (
      <>
        <TitleSection
          title="In-Store Sales"
          logo={vendor?.logo_url}
          subtitle={`Today's sales: $${todayTotal.toFixed(2)}`}
          hideButton
          filterPills={dateFilterPills}
          activeFilterId={dateRange}
          onFilterSelect={(id) => setDateRange(id as DateRange)}
        />
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
      ListHeaderComponent={() => (
        <TitleSection
          title="In-Store Sales"
          logo={vendor?.logo_url}
          subtitle={`Today's sales: $${todayTotal.toFixed(2)}`}
          hideButton
          filterPills={dateFilterPills}
          activeFilterId={dateRange}
          onFilterSelect={(id) => setDateRange(id as DateRange)}
        />
      )}
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
})
