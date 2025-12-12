/**
 * Purchase Orders List Component - REFACTORED
 *
 * ZERO PROP DRILLING:
 * - Reads from AppAuthContext for vendor logo
 * - Reads from products-list.store for selectedPO
 * - Calls store actions directly for modal opening and PO selection
 *
 * NOTE: purchaseOrders and isLoading still passed as props
 * until proper purchase-orders.store is implemented (see TODO in ProductsScreen)
 *
 * Displays purchase orders in iPad Settings-style glass card layout
 */

import React, { useMemo, useState, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import type { PurchaseOrder } from '@/services/purchase-orders.service'
import { TitleSection, LocationSelectorModal } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { usePurchaseOrdersStore, purchaseOrdersActions } from '@/stores/purchase-orders.store'
import type { PurchaseOrderStatus } from '@/services/purchase-orders.service'

// Memoized PO Item to prevent flickering
const POItem = React.memo<{
  item: PurchaseOrder
  isLast: boolean
  isSelected: boolean
  onPress: () => void
}>(({ item, isLast, isSelected, onPress }) => {
  const statusColor = getStatusColor(item.status)
  const statusLabel = getStatusLabel(item.status)
  const typeLabel = item.po_type === 'inbound' ? 'FROM' : 'TO'
  const partnerName = item.po_type === 'inbound' ? item.supplier_name : item.customer_name

  return (
    <Pressable
      style={[
        styles.poItem,
        isSelected && styles.poItemActive,
        isLast && styles.poItemLast,
      ]}
      onPress={onPress}
      accessibilityRole="none"
    >
      {/* Status Indicator */}
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />

      {/* PO Info */}
      <View style={styles.poInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.poNumber} numberOfLines={1}>
            {item.po_number}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.poRoute} numberOfLines={1}>
          {typeLabel}: {partnerName || 'N/A'}
        </Text>
      </View>

      {/* Location */}
      {item.location_name && (
        <View style={styles.dataColumn}>
          <Text style={styles.dataLabel}>LOCATION</Text>
          <Text style={styles.dataValue} numberOfLines={1}>
            {item.location_name}
          </Text>
        </View>
      )}

      {/* Items Count */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>ITEMS</Text>
        <Text style={styles.dataValue}>
          {item.received_items_count || 0}/{item.items_count || 0}
        </Text>
      </View>

      {/* Total Amount */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>TOTAL</Text>
        <Text style={styles.totalValue}>
          ${(item.total || 0).toFixed(2)}
        </Text>
      </View>
    </Pressable>
  )
})

POItem.displayName = 'POItem'

interface PurchaseOrdersListProps {
  emptyMessage?: string
}

/**
 * PurchaseOrdersList - ZERO PROPS ✅ (except UI state)
 * Reads from store with real-time updates - no reloads needed
 * Optimistic UI for instant feedback
 */
export function PurchaseOrdersList({
  emptyMessage = 'No purchase orders found',
}: PurchaseOrdersListProps) {
  // ========================================
  // STORES - ZERO PROP DRILLING
  // ========================================
  const { vendor, locations } = useAppAuth()
  // Use selector pattern for Zustand to ensure proper subscription
  const selectedLocationIds = useLocationFilter((state) => state.selectedLocationIds)
  const selectedPO = useProductsScreenStore((state) => state.selectedPurchaseOrder)

  // Location selector modal state
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const locationIds = selectedLocationIds.length > 0 ? selectedLocationIds : undefined
    const status = statusFilter !== 'all' ? (statusFilter as PurchaseOrderStatus) : undefined
    await purchaseOrdersActions.loadPurchaseOrders({ locationIds, status })
    setRefreshing(false)
  }, [selectedLocationIds, statusFilter])

  // Compute location display text
  const locationDisplayText = useMemo(() => {
    if (selectedLocationIds.length === 0) {
      return 'All Locations'
    }
    if (selectedLocationIds.length === 1) {
      const loc = locations.find(l => l.id === selectedLocationIds[0])
      return loc?.name || '1 Location'
    }
    return `${selectedLocationIds.length} Locations`
  }, [selectedLocationIds, locations])

  // Read from PO store
  const purchaseOrders = usePurchaseOrdersStore((state) => state.purchaseOrders)
  const isLoading = usePurchaseOrdersStore((state) => state.loading)
  const statusFilter = usePurchaseOrdersStore((state) => state.statusFilter)

  // Load data and subscribe to real-time updates
  React.useEffect(() => {
    if (!vendor?.id) return

    const locationIds = selectedLocationIds.length > 0 ? selectedLocationIds : undefined
    const status = statusFilter !== 'all' ? (statusFilter as PurchaseOrderStatus) : undefined

    // Initial load
    purchaseOrdersActions.loadPurchaseOrders({ locationIds, status })

    // Subscribe to real-time updates
    purchaseOrdersActions.subscribe(vendor.id, locationIds)

    return () => {
      purchaseOrdersActions.unsubscribe()
    }
  }, [vendor?.id, selectedLocationIds, statusFilter])

  // Handlers - call store actions directly
  const handleSelect = (po: PurchaseOrder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.selectPurchaseOrder(po)

    // Open CreatePOModal for drafts to edit them
    if (po.status === 'draft') {
      productsScreenActions.openModal('createPO')
    } else if (po.po_type === 'inbound' &&
               (po.status === 'pending' || po.status === 'approved' || po.status === 'partially_received')) {
      // Open receive modal directly for receivable POs
      productsScreenActions.openModal('receivePO')
    }
    // For other statuses (received, cancelled, outbound), just select - detail view will show in right panel
  }

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.openModal('createPO')
  }

  const handleFilterSelect = (filterId: string) => {
    purchaseOrdersActions.setStatusFilter(filterId as PurchaseOrderStatus | 'all')
  }

  // Handle location pill tap - always opens modal
  const handleLocationPillSelect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowLocationModal(true)
  }

  // Single location pill for TitleSection - opens modal
  const locationPill: FilterPill[] = useMemo(() => {
    return [{ id: 'location', label: locationDisplayText }]
  }, [locationDisplayText])

  // Define status filter pills
  const filterPills: FilterPill[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'received', label: 'Received' },
  ]

  // Group POs by date
  const poSections = useMemo(() => {
    const sections = new Map<string, PurchaseOrder[]>()

    purchaseOrders.forEach(po => {
      const date = new Date(po.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      if (!sections.has(date)) {
        sections.set(date, [])
      }
      sections.get(date)!.push(po)
    })

    // Convert to sorted array (newest first)
    return Array.from(sections.entries())
  }, [purchaseOrders])

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text.secondary} />
      </View>
    )
  }

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingBottom: layout.dockHeight, paddingRight: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.6)"
          />
        }
      >
        {/* Title Section with Location Selector */}
        <TitleSection
          title="Purchase Orders"
          logo={vendor?.logo_url}
          buttonText="+ New Order"
          onButtonPress={handleAddPress}
          buttonAccessibilityLabel="Add new purchase order"
          filterPills={locationPill}
          activeFilterId="location"
          onFilterSelect={handleLocationPillSelect}
        />

        {/* Status Filter Row */}
        <View style={styles.statusFilterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilterContainer}
          >
            {filterPills.map((pill) => (
              <Pressable
                key={pill.id}
                style={[
                  styles.statusFilterPill,
                  statusFilter === pill.id && styles.statusFilterPillActive,
                ]}
                onPress={() => handleFilterSelect(pill.id)}
              >
                <Text style={[
                  styles.statusFilterText,
                  statusFilter === pill.id && styles.statusFilterTextActive,
                ]}>
                  {pill.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Empty State */}
        {purchaseOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Purchase Orders</Text>
            <Text style={styles.emptyStateText}>{emptyMessage}</Text>
          </View>
        ) : (
          <>
            {/* Render sections with date headers */}
            {poSections.map(([date, items]) => (
              <View key={date} style={styles.dateSection}>
                {/* Date Header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{date}</Text>
                </View>

                {/* POs in this section */}
                <View style={styles.cardWrapper}>
                  <View style={styles.posCardGlass}>
                    {items.map((item, index) => {
                      const isLast = index === items.length - 1

                      return (
                        <POItem
                          key={item.id}
                          item={item}
                          isLast={isLast}
                          isSelected={selectedPO?.id === item.id}
                          onPress={() => handleSelect(item)}
                        />
                      )
                    })}
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
      />
    </>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'rgba(235,235,245,0.3)'
    case 'pending':
    case 'approved':
      return '#ff9500'
    case 'partially_received':
      return '#0a84ff'
    case 'received':
      return '#34c759'
    case 'cancelled':
      return '#ff3b30'
    default:
      return 'rgba(235,235,245,0.3)'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'DRAFT'
    case 'pending':
      return 'PENDING'
    case 'approved':
      return 'APPROVED'
    case 'partially_received':
      return 'PARTIAL'
    case 'received':
      return 'RECEIVED'
    case 'cancelled':
      return 'CANCELLED'
    default:
      return status.toUpperCase()
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  // Status Filter Row
  statusFilterWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: spacing.md,
  },
  statusFilterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusFilterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statusFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
  },
  statusFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  cardWrapper: {
    marginHorizontal: layout.containerMargin,
    marginVertical: layout.containerMargin,
  },
  posCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  poItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.rowPaddingHorizontal,
    gap: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: layout.minTouchTarget,
  },
  poItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  poItemLast: {
    borderBottomWidth: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  poInfo: {
    flex: 1,
    gap: 2,
    minWidth: 200,
  },
  poNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  poRoute: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
  },
  dataColumn: {
    minWidth: 90,
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
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.2,
  },
  dateSection: {
    marginBottom: 0,
  },
  sectionHeader: {
    paddingVertical: 4,
    paddingHorizontal: 20,
    backgroundColor: '#000',
    marginTop: 12,
  },
  sectionHeaderText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.huge,
    paddingVertical: 80,
    gap: spacing.xs,
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
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
})
