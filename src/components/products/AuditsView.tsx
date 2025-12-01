/**
 * AuditsView Component - REFACTORED TO MATCH TRANSFERS DESIGN
 * Comprehensive audit trail for inventory adjustments
 * Styled exactly like TransfersList with glass cards and pill badges
 *
 * ZERO PROP DRILLING:
 * - Reads from AppAuthContext for vendor
 * - Reads from products-list.store for selectedLocationIds
 * - Calls store actions directly for modal opening
 */

import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useInventoryAdjustments } from '@/hooks/useInventoryAdjustments'
import type { AdjustmentType, InventoryAdjustment } from '@/services/inventory-adjustments.service'
import { TitleSection, LocationSelectorModal } from '@/components/shared'
import type { FilterPill } from '@/components/shared'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { useProductsScreenStore, productsScreenActions } from '@/stores/products-list.store'
import { useLocationFilter } from '@/stores/location-filter.store'

type AuditBatch = {
  id: string
  type: 'batch'
  reason: string
  created_at: string
  location_name: string | null
  adjustments: InventoryAdjustment[]
  total_quantity_change: number
}

type AdjustmentOrBatch = InventoryAdjustment | AuditBatch

// Memoized Audit Item to prevent flickering
const AuditItem = React.memo<{
  item: AdjustmentOrBatch
  isLast: boolean
  isSelected: boolean
  onPress: () => void
}>(({ item, isLast, isSelected, onPress }) => {
  const isBatch = 'type' in item && item.type === 'batch'
  const batch = isBatch ? (item as AuditBatch) : null
  const adj = !isBatch ? (item as InventoryAdjustment) : null

  // Get user info
  const user = isBatch ? batch!.adjustments[0]?.created_by_user : adj?.created_by_user
  const staffName = user?.first_name && user?.last_name
    ? `${user.first_name} ${user.last_name}`
    : user?.email?.split('@')[0] || 'Unknown'

  const itemCount = isBatch ? batch!.adjustments.length : 1
  const createdAt = item.created_at
  const locationName = isBatch ? batch!.location_name : adj?.location?.name || null
  const reason = isBatch ? batch!.reason.replace('Audit: ', '') : adj!.reason

  return (
    <Pressable
      style={[
        styles.auditItem,
        isSelected && styles.auditItemActive,
        isLast && styles.auditItemLast,
      ]}
      onPress={onPress}
      accessibilityRole="none"
    >
      {/* Status Dot */}
      <View style={[styles.statusDot, { backgroundColor: '#0a84ff' }]} />

      {/* Audit Info */}
      <View style={styles.auditInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.staffName} numberOfLines={1}>
            {staffName}
          </Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {itemCount === 1 ? 'SINGLE' : 'BATCH'}
            </Text>
          </View>
        </View>
        {locationName && (
          <Text style={styles.locationText} numberOfLines={1}>
            {locationName}
          </Text>
        )}
        <Text style={styles.reasonText} numberOfLines={1}>
          {reason}
        </Text>
      </View>

      {/* Items Count */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>ITEMS</Text>
        <Text style={styles.dataValue}>{itemCount}</Text>
      </View>

      {/* Date */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>DATE</Text>
        <Text style={styles.dataValue}>
          {new Date(createdAt).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  )
})

AuditItem.displayName = 'AuditItem'

interface AuditsViewProps {
  emptyMessage?: string
}

/**
 * AuditsView - ZERO PROPS ✅ (except UI state)
 * Reads from store with real-time updates
 */
export function AuditsView({
  emptyMessage = 'No audit records found',
}: AuditsViewProps = {}) {
  // ========================================
  // STORES - ZERO PROP DRILLING
  // ========================================
  const { vendor, locations } = useAppAuth()
  // Use selector pattern for Zustand to ensure proper subscription
  const selectedLocationIds = useLocationFilter((state) => state.selectedLocationIds)
  const insets = useSafeAreaInsets()

  const [viewFilter, setViewFilter] = useState<'all' | 'batches' | 'single'>('all')
  const [selectedAuditBatch, setSelectedAuditBatch] = useState<AuditBatch | null>(null)

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

  // Memoize filters to prevent unnecessary re-fetches
  const filters = useMemo(() => {
    if (selectedLocationIds.length === 1) {
      return { location_id: selectedLocationIds[0] }
    }
    return undefined
  }, [selectedLocationIds])

  const { adjustments, isLoading } = useInventoryAdjustments(undefined, undefined, filters || {})

  // Filter adjustments by location BEFORE grouping (for multiple locations)
  const locationFilteredAdjustments = useMemo(() => {
    if (selectedLocationIds.length <= 1) {
      return adjustments
    }
    return adjustments.filter(adj => adj.location_id && selectedLocationIds.includes(adj.location_id))
  }, [adjustments, selectedLocationIds])

  // Group audit batches
  const groupedAdjustments = useMemo(() => {
    const sorted = [...locationFilteredAdjustments].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const processed = new Set<string>()
    const result: AdjustmentOrBatch[] = []

    sorted.forEach(adj => {
      if (processed.has(adj.id)) return

      // Check if this is part of an audit batch
      if (adj.reason.startsWith('Audit:') && adj.adjustment_type === 'count_correction') {
        const adjTime = new Date(adj.created_at).getTime()

        // Find all related adjustments (same reason, within 60 seconds)
        const batchAdjustments = sorted.filter(other => {
          if (processed.has(other.id)) return false
          if (other.reason !== adj.reason) return false
          if (other.adjustment_type !== 'count_correction') return false

          const otherTime = new Date(other.created_at).getTime()
          return Math.abs(adjTime - otherTime) < 60000
        })

        if (batchAdjustments.length > 1) {
          batchAdjustments.forEach(a => processed.add(a.id))

          const batch: AuditBatch = {
            id: `batch-${adj.id}`,
            type: 'batch',
            reason: adj.reason,
            created_at: adj.created_at,
            location_name: batchAdjustments.every(a => a.location?.name === batchAdjustments[0].location?.name)
              ? batchAdjustments[0].location?.name || null
              : null,
            adjustments: batchAdjustments,
            total_quantity_change: batchAdjustments.reduce((sum, a) => sum + a.quantity_change, 0),
          }
          result.push(batch)
          return
        }
      }

      processed.add(adj.id)
      result.push(adj)
    })

    return result
  }, [locationFilteredAdjustments])

  // Filter by view type
  const filteredAdjustments = useMemo(() => {
    if (viewFilter === 'all') {
      return groupedAdjustments
    }
    if (viewFilter === 'batches') {
      return groupedAdjustments.filter(item => 'type' in item && item.type === 'batch')
    }
    return groupedAdjustments.filter(item => !('type' in item && item.type === 'batch'))
  }, [groupedAdjustments, viewFilter])

  // Handlers
  const handleSelect = (item: AdjustmentOrBatch) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if ('type' in item && item.type === 'batch') {
      setSelectedAuditBatch(item as AuditBatch)
    } else {
      // Create single-item batch for consistent modal display
      const adj = item as InventoryAdjustment
      const singleBatch: AuditBatch = {
        id: `single-${adj.id}`,
        type: 'batch',
        reason: adj.reason,
        created_at: adj.created_at,
        location_name: adj.location?.name || null,
        adjustments: [adj],
        total_quantity_change: adj.quantity_change,
      }
      setSelectedAuditBatch(singleBatch)
    }
  }

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productsScreenActions.openModal('createAudit')
  }

  const handleCloseModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedAuditBatch(null)
  }

  const handleFilterSelect = (filterId: string) => {
    setViewFilter(filterId as 'all' | 'batches' | 'single')
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

  // Define view filter pills
  const filterPills: FilterPill[] = [
    { id: 'all', label: 'All' },
    { id: 'batches', label: 'Batches' },
    { id: 'single', label: 'Single' },
  ]

  // Group audits by date
  const auditSections = useMemo(() => {
    const sections = new Map<string, AdjustmentOrBatch[]>()

    filteredAdjustments.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      if (!sections.has(date)) {
        sections.set(date, [])
      }
      sections.get(date)!.push(item)
    })

    return Array.from(sections.entries())
  }, [filteredAdjustments])

  const getTypeLabel = (type: AdjustmentType) => {
    const labels: Record<AdjustmentType, string> = {
      count_correction: 'Count Correction',
      damage: 'Damage',
      shrinkage: 'Shrinkage',
      theft: 'Theft',
      expired: 'Expired',
      received: 'Received',
      return: 'Return',
      other: 'Other',
    }
    return labels[type]
  }

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
          title="Audits"
          logo={vendor?.logo_url}
          buttonText="+ Create Audit"
          onButtonPress={handleAddPress}
          buttonAccessibilityLabel="Create new audit"
          filterPills={locationPill}
          activeFilterId="location"
          onFilterSelect={handleLocationPillSelect}
        />

        {/* View Filter Row */}
        <View style={styles.viewFilterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.viewFilterContainer}
          >
            {filterPills.map((pill) => (
              <Pressable
                key={pill.id}
                style={[
                  styles.viewFilterPill,
                  viewFilter === pill.id && styles.viewFilterPillActive,
                ]}
                onPress={() => handleFilterSelect(pill.id)}
              >
                <Text style={[
                  styles.viewFilterText,
                  viewFilter === pill.id && styles.viewFilterTextActive,
                ]}>
                  {pill.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Empty State */}
        {filteredAdjustments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Audits</Text>
            <Text style={styles.emptyStateText}>{emptyMessage}</Text>
          </View>
        ) : (
          <>
            {/* Render sections with date headers */}
            {auditSections.map(([date, items]) => (
              <View key={date} style={styles.dateSection}>
                {/* Date Header */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{date}</Text>
                </View>

                {/* Audits in this section */}
                <View style={styles.cardWrapper}>
                  <View style={styles.auditsCardGlass}>
                    {items.map((item, index) => {
                      const isLast = index === items.length - 1

                      return (
                        <AuditItem
                          key={item.id}
                          item={item}
                          isLast={isLast}
                          isSelected={selectedAuditBatch?.id === item.id}
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

      {/* Audit Detail Modal */}
      {selectedAuditBatch && (
        <Modal
          visible={!!selectedAuditBatch}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handleCloseModal}
        >
          <StatusBar barStyle="light-content" />
          <View style={styles.modalContainer}>
            <View style={[styles.modalHeader, { paddingTop: insets.top + 16 }]}>
              <Text style={styles.modalTitle}>Audit Details</Text>
              <Pressable onPress={handleCloseModal} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>AUDIT INFO</Text>
                <View style={styles.modalInfoCard}>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Staff:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedAuditBatch.adjustments[0]?.created_by_user?.first_name}{' '}
                      {selectedAuditBatch.adjustments[0]?.created_by_user?.last_name}
                    </Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Date:</Text>
                    <Text style={styles.modalInfoValue}>
                      {new Date(selectedAuditBatch.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Location:</Text>
                    <Text style={styles.modalInfoValue}>{selectedAuditBatch.location_name}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Reason:</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedAuditBatch.reason.replace('Audit: ', '')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>
                  {selectedAuditBatch.adjustments.length === 1
                    ? `${getTypeLabel(selectedAuditBatch.adjustments[0].adjustment_type).toUpperCase()}`
                    : `CORRECTIONS (${selectedAuditBatch.adjustments.length})`}
                </Text>
                <View style={styles.modalProductsCard}>
                  {selectedAuditBatch.adjustments.map((adj, idx) => {
                    const unitMatch = adj.notes?.match(/(g|units)/)
                    const unit = unitMatch?.[1] || 'g'

                    return (
                      <View key={adj.id}>
                        <View style={styles.modalProductRow}>
                          <View style={styles.modalProductInfo}>
                            <Text style={styles.modalProductName}>
                              {adj.product?.name || 'Unknown'}
                            </Text>
                            {adj.product?.sku && (
                              <Text style={styles.modalProductSku}>SKU: {adj.product.sku}</Text>
                            )}
                          </View>
                          <View style={styles.modalProductQty}>
                            <Text
                              style={[
                                styles.modalProductChange,
                                adj.quantity_change > 0 && styles.quantityPositive,
                                adj.quantity_change < 0 && styles.quantityNegative,
                              ]}
                            >
                              {adj.quantity_change > 0 ? '+' : ''}
                              {adj.quantity_change}
                              {unit}
                            </Text>
                            <Text style={styles.modalProductBeforeAfter}>
                              {adj.quantity_before}
                              {unit} → {adj.quantity_after}
                              {unit}
                            </Text>
                            {adj.notes && (
                              <Text style={styles.modalProductNotes}>{adj.notes}</Text>
                            )}
                          </View>
                        </View>
                        {idx < selectedAuditBatch.adjustments.length - 1 && (
                          <View style={styles.modalProductDivider} />
                        )}
                      </View>
                    )
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
      />
    </>
  )
}

// =====================================================
// STYLES - MATCHING TRANSFERSLIST EXACTLY
// =====================================================

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  // View Filter Row
  viewFilterWrapper: {
    paddingHorizontal: layout.containerMargin,
    marginBottom: spacing.md,
  },
  viewFilterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  viewFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  viewFilterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  viewFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(235,235,245,0.7)',
    letterSpacing: -0.2,
  },
  viewFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  cardWrapper: {
    marginHorizontal: layout.containerMargin,
    marginVertical: layout.containerMargin,
  },
  auditsCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  auditItem: {
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
  auditItemActive: {
    backgroundColor: 'rgba(99,99,102,0.2)',
  },
  auditItemLast: {
    borderBottomWidth: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  auditInfo: {
    flex: 1,
    gap: 2,
    minWidth: 200,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#0a84ff',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
  },
  reasonText: {
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a84ff',
  },
  modalContent: {
    flex: 1,
  },
  modalSection: {
    padding: 16,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  modalInfoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    padding: 16,
    gap: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalInfoLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  modalInfoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  modalProductsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    padding: 16,
  },
  modalProductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 16,
  },
  modalProductInfo: {
    flex: 1,
  },
  modalProductName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalProductSku: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    marginTop: 4,
  },
  modalProductQty: {
    alignItems: 'flex-end',
  },
  modalProductChange: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  quantityPositive: {
    color: colors.semantic.success,
  },
  quantityNegative: {
    color: colors.semantic.error,
  },
  modalProductBeforeAfter: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    marginTop: 4,
  },
  modalProductNotes: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalProductDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
})
