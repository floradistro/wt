/**
 * ECommerceView Component
 * Lists all e-commerce shipping orders with status filtering
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

interface ECommerceViewProps {
  isLoading?: boolean
}

export function ECommerceView({ isLoading = false }: ECommerceViewProps) {
  const { vendor } = useAppAuth()
  const filteredOrders = useFilteredOrders()
  const dateRange = useDateRange()
  const { setDateRange } = useOrdersUIActions()
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'shipped' | 'delivered'>('all')

  // Date filter pills
  const dateFilterPills: FilterPill[] = [
    { id: 'today', label: '1 Day' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'all', label: 'All' },
    { id: 'custom', label: 'Custom' },
  ]

  // Filter for only shipping orders
  const shippingOrders = useMemo(() => {
    return filteredOrders.filter((order) => order.order_type === 'shipping')
  }, [filteredOrders])

  // Group shipping orders by status with filter
  const shippingGrouped = useMemo(() => {
    const groups: Array<{ title: string; data: Order[] }> = []

    // Needs attention (pending, confirmed)
    const needsAction = shippingOrders.filter(
      (o) => ['pending', 'confirmed'].includes(o.status)
    )

    // In progress (packing, packed)
    const inProgress = shippingOrders.filter(
      (o) => ['packing', 'packed'].includes(o.status)
    )

    // Shipped / In Transit
    const shipped = shippingOrders.filter(
      (o) => ['shipped', 'in_transit'].includes(o.status)
    )

    // Delivered today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const delivered = shippingOrders.filter(
      (o) => o.status === 'delivered' && new Date(o.created_at) >= today
    )

    // Apply filter
    if (statusFilter === 'all') {
      if (needsAction.length > 0) {
        groups.push({ title: 'Needs Action', data: needsAction })
      }
      if (inProgress.length > 0) {
        groups.push({ title: 'Ready to Ship', data: inProgress })
      }
      if (shipped.length > 0) {
        groups.push({ title: 'In Transit', data: shipped })
      }
      if (delivered.length > 0) {
        groups.push({ title: 'Delivered Today', data: delivered })
      }
    } else if (statusFilter === 'active') {
      if (needsAction.length > 0) {
        groups.push({ title: 'Needs Action', data: needsAction })
      }
      if (inProgress.length > 0) {
        groups.push({ title: 'Ready to Ship', data: inProgress })
      }
    } else if (statusFilter === 'shipped') {
      if (shipped.length > 0) {
        groups.push({ title: 'In Transit', data: shipped })
      }
    } else if (statusFilter === 'delivered') {
      if (delivered.length > 0) {
        groups.push({ title: 'Delivered Today', data: delivered })
      }
    }

    return groups
  }, [shippingOrders, statusFilter])

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

  // Filter pills for status filtering
  const filterPills: FilterPill[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
  ]

  if (isLoading) {
    return (
      <>
        <TitleSection
          title="E-Commerce"
          logo={vendor?.logo_url}
          subtitle={`${shippingOrders.length} shipping ${shippingOrders.length === 1 ? 'order' : 'orders'}`}
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
          title="E-Commerce"
          logo={vendor?.logo_url}
          subtitle={`${shippingOrders.length} shipping ${shippingOrders.length === 1 ? 'order' : 'orders'}`}
          hideButton
          filterPills={dateFilterPills}
          activeFilterId={dateRange}
          onFilterSelect={(id) => setDateRange(id as DateRange)}
        />
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
      ListHeaderComponent={() => (
        <TitleSection
          title="E-Commerce"
          logo={vendor?.logo_url}
          subtitle={`${shippingOrders.length} shipping ${shippingOrders.length === 1 ? 'order' : 'orders'}`}
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
