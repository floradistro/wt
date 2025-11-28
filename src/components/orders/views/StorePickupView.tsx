/**
 * StorePickupView Component
 * Lists all store pickup orders with status filtering
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
import { TitleSection } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { useDateRange, useOrdersUIActions, type DateRange } from '@/stores/orders-ui.store'

interface StorePickupViewProps {
  isLoading?: boolean
}

export function StorePickupView({ isLoading = false }: StorePickupViewProps) {
  const { vendor } = useAppAuth()
  const filteredOrders = useFilteredOrders()
  const dateRange = useDateRange()
  const { setDateRange } = useOrdersUIActions()
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'completed'>('all')

  // Date filter pills
  const dateFilterPills: FilterPill[] = [
    { id: 'today', label: '1 Day' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'all', label: 'All' },
    { id: 'custom', label: 'Custom' },
  ]

  // Filter for only pickup orders
  const pickupOrders = useMemo(() => {
    return filteredOrders.filter((order) => order.order_type === 'pickup')
  }, [filteredOrders])

  // Group pickup orders by status with filter
  const pickupGrouped = useMemo(() => {
    const groups: Array<{ title: string; data: Order[] }> = []

    // Active orders (pending, confirmed, preparing, ready)
    const active = pickupOrders.filter(
      (o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
    )

    // Completed today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const completed = pickupOrders.filter(
      (o) => o.status === 'completed' && new Date(o.created_at) >= today
    )

    // Apply filter
    if (statusFilter === 'all') {
      if (active.length > 0) {
        groups.push({ title: 'Active Pickup Orders', data: active })
      }
      if (completed.length > 0) {
        groups.push({ title: 'Completed Today', data: completed })
      }
    } else if (statusFilter === 'active') {
      if (active.length > 0) {
        groups.push({ title: 'Active Pickup Orders', data: active })
      }
    } else if (statusFilter === 'completed') {
      if (completed.length > 0) {
        groups.push({ title: 'Completed Today', data: completed })
      }
    }

    return groups
  }, [pickupOrders, statusFilter])

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

  // Filter pills for status filtering
  const filterPills: FilterPill[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
  ]

  if (isLoading) {
    return (
      <>
        <TitleSection
          title="Store Pickup"
          logo={vendor?.logo_url}
          subtitle={`${pickupOrders.length} pickup ${pickupOrders.length === 1 ? 'order' : 'orders'}`}
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
          title="Store Pickup"
          logo={vendor?.logo_url}
          subtitle={`${pickupOrders.length} pickup ${pickupOrders.length === 1 ? 'order' : 'orders'}`}
          hideButton
          filterPills={dateFilterPills}
          activeFilterId={dateRange}
          onFilterSelect={(id) => setDateRange(id as DateRange)}
        />
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
      ListHeaderComponent={() => (
        <TitleSection
          title="Store Pickup"
          logo={vendor?.logo_url}
          subtitle={`${pickupOrders.length} pickup ${pickupOrders.length === 1 ? 'order' : 'orders'}`}
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
