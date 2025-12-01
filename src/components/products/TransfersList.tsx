/**
 * Inventory Transfers List Component - REFACTORED
 *
 * ZERO PROP DRILLING:
 * - Reads from useTransfersStore for transfers data
 * - Reads from AppAuthContext for vendor logo
 * - Reads from products-list.store for UI state
 * - Calls store actions directly
 *
 * Displays inventory transfers in iPad Settings-style glass card layout
 */

import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import type { InventoryTransfer, TransferStatus } from '@/types/pos'
import { TitleSection, LocationSelectorModal } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { useTransfersStore } from '@/stores/inventory-transfers.store'
import * as transferService from '@/services/inventory-transfers.service'

// Memoized Transfer Item to prevent flickering
const TransferItem = React.memo<{
  item: InventoryTransfer
  isLast: boolean
  isSelected: boolean
  onPress: () => void
  onDelete?: (id: string) => void
}>(({ item, isLast, isSelected, onPress, onDelete }) => {
  const statusColor = transferService.getTransferStatusColor(item.status)
  const statusLabel = transferService.getTransferStatusLabel(item.status)
  const isDraft = item.status === 'draft'

  return (
    <Pressable
      style={[
        styles.transferItem,
        isSelected && styles.transferItemActive,
        isLast && styles.transferItemLast,
      ]}
      onPress={onPress}
      accessibilityRole="none"
    >
      {/* Status Indicator */}
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />

      {/* Transfer Info */}
      <View style={styles.transferInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.transferNumber} numberOfLines={1}>
            {item.transfer_number}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.transferRoute} numberOfLines={1}>
          {item.source_location?.name || 'Unknown'} →{' '}
          {item.destination_location?.name || 'Unknown'}
        </Text>
      </View>

      {/* Items Count */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>ITEMS</Text>
        <Text style={styles.dataValue}>{item.items?.length || 0}</Text>
      </View>

      {/* Date */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>CREATED</Text>
        <Text style={styles.dataValue}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      {/* Delete Button for Drafts */}
      {isDraft && onDelete && (
        <Pressable
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation()
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onDelete(item.id)
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteButtonText}>✕</Text>
        </Pressable>
      )}
    </Pressable>
  )
})

TransferItem.displayName = 'TransferItem'

interface TransfersListProps {
  emptyMessage?: string
}

/**
 * TransfersList - ZERO PROPS ✅ (except UI state)
 * Reads from store with real-time updates - no reloads needed
 * Optimistic UI for instant feedback
 */
export function TransfersList({
  emptyMessage = 'No transfers found',
}: TransfersListProps) {
  // ========================================
  // STORES - ZERO PROP DRILLING
  // ========================================
  const { vendor, locations } = useAppAuth()
  // Use selector pattern for Zustand to ensure proper subscription
  const selectedLocationIds = useLocationFilter((state) => state.selectedLocationIds)
  const selectedTransfer = useProductsScreenStore((state) => state.selectedTransfer)

  // Read from transfers store
  const transfers = useTransfersStore((state) => state.transfers)
  const isLoading = useTransfersStore((state) => state.loading)
  const statusFilter = useTransfersStore((state) => state.statusFilter)

  // Location selector modal state
  const [showLocationModal, setShowLocationModal] = useState(false)

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

  // Load data and subscribe to real-time updates
  React.useEffect(() => {
    if (!vendor?.id) return

    // Build filters - for single location, filter server-side
    const filters: { status?: TransferStatus; source_location_id?: string; destination_location_id?: string } = {}
    if (statusFilter !== 'all') {
      filters.status = statusFilter as TransferStatus
    }
    // Note: For single location, we load all and filter client-side to show transfers where
    // the location is either source OR destination

    useTransfersStore.getState().loadTransfers(vendor.id, Object.keys(filters).length > 0 ? filters : undefined)

    // Subscribe to real-time updates
    useTransfersStore.getState().subscribe(vendor.id)

    return () => {
      useTransfersStore.getState().unsubscribe()
    }
  }, [vendor?.id, statusFilter, selectedLocationIds])

  // Debug: Log when component re-renders with new location selection
  React.useEffect(() => {
    console.log('[TransfersList] Location selection changed', {
      selectedLocationIds,
      locationDisplayText,
    })
  }, [selectedLocationIds, locationDisplayText])

  // Filter transfers by location (source OR destination matches selected locations)
  const filteredTransfers = useMemo(() => {
    console.log('[TransfersList] Computing filteredTransfers', {
      selectedLocationIds,
      totalTransfers: transfers.length,
    })

    if (selectedLocationIds.length === 0) {
      console.log('[TransfersList] No filter - showing all', transfers.length)
      return transfers // No location filter - show all
    }

    const filtered = transfers.filter(transfer => {
      const matches = selectedLocationIds.includes(transfer.source_location_id) ||
        selectedLocationIds.includes(transfer.destination_location_id)
      return matches
    })
    console.log('[TransfersList] Filtered result:', filtered.length, 'of', transfers.length)
    return filtered
  }, [transfers, selectedLocationIds])

  // Handlers - call store actions directly
  const handleSelect = async (transfer: InventoryTransfer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Fetch full transfer details with items
    let fullTransfer = transfer
    const details = await transferService.fetchTransferById(transfer.id)
    if (details) {
      fullTransfer = details
    }

    productsScreenActions.selectTransfer(fullTransfer)

    // Open appropriate modal based on status
    if (transfer.status === 'draft') {
      productsScreenActions.openModal('createTransfer')
    } else if (transferService.canReceiveTransfer(transfer.status)) {
      productsScreenActions.openModal('receiveTransfer')
    } else if (transfer.status === 'completed' || transfer.status === 'cancelled') {
      productsScreenActions.openModal('transferDetail')
    }
  }

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Clear selection for new transfer
    productsScreenActions.selectTransfer(null)
    productsScreenActions.openModal('createTransfer')
  }

  const handleDelete = async (transferId: string) => {
    try {
      // Optimistic update - remove from UI immediately
      await useTransfersStore.getState().deleteDraftTransfer(transferId)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      console.log('[TransfersList] Draft transfer deleted', { transferId })
    } catch (error) {
      console.error('[TransfersList] Failed to delete draft transfer', {
        error,
        transferId,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleFilterSelect = (filterId: string) => {
    const status = filterId as TransferStatus | 'all'
    useTransfersStore.getState().setStatusFilter(status)

    // Manually reload transfers with new filter
    if (vendor?.id) {
      const filters = status !== 'all' ? { status } : undefined
      useTransfersStore.getState().loadTransfers(vendor.id, filters)
    }
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
    { id: 'in_transit', label: 'In Transit' },
    { id: 'completed', label: 'Completed' },
  ]

  // Group transfers by date
  const transferSections = useMemo(() => {
    const sections = new Map<string, InventoryTransfer[]>()

    filteredTransfers.forEach(transfer => {
      const date = new Date(transfer.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      if (!sections.has(date)) {
        sections.set(date, [])
      }
      sections.get(date)!.push(transfer)
    })

    // Convert to sorted array (newest first)
    return Array.from(sections.entries())
  }, [filteredTransfers])

  // ========================================
  // RENDER
  // ========================================

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
      >
        {/* Title Section with Location Selector */}
        <TitleSection
          title="Transfers"
          logo={vendor?.logo_url}
          buttonText="+ New Transfer"
          onButtonPress={handleAddPress}
          buttonAccessibilityLabel="Add new transfer"
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
        {filteredTransfers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Transfers</Text>
            <Text style={styles.emptyStateText}>{emptyMessage}</Text>
          </View>
        ) : (
          <>
            {/* Render sections with date headers */}
            {transferSections.map(([date, items]) => (
              <View key={date} style={styles.dateSection}>
                {/* Date Header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{date}</Text>
                </View>

                {/* Transfers in this section */}
                <View style={styles.cardWrapper}>
                  <View style={styles.transfersCardGlass}>
                    {items.map((item, index) => {
                      const isLast = index === items.length - 1

                      return (
                        <TransferItem
                          key={item.id}
                          item={item}
                          isLast={isLast}
                          isSelected={selectedTransfer?.id === item.id}
                          onPress={() => handleSelect(item)}
                          onDelete={handleDelete}
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

// =====================================================
// STYLES
// =====================================================

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
  transfersCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  transferItem: {
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
  transferItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  transferItemLast: {
    borderBottomWidth: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  transferInfo: {
    flex: 1,
    gap: 2,
    minWidth: 200,
  },
  transferNumber: {
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
  transferRoute: {
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
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,69,58,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  deleteButtonText: {
    fontSize: 18,
    fontWeight: '400',
    color: '#ff453a',
  },
})
