/**
 * AuditsView Component
 * Comprehensive audit trail for inventory adjustments and stock movements
 * Apple Engineering: Clean data presentation, powerful filtering
 */

import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Animated, Image } from 'react-native'
import { useState, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useInventoryAdjustments } from '@/hooks/useInventoryAdjustments'
import type { AdjustmentType, InventoryAdjustment } from '@/services/inventory-adjustments.service'

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

interface AuditsViewProps {
  onCreatePress: () => void
  headerOpacity: Animated.Value
  vendorLogo?: string | null
}

export function AuditsView({ onCreatePress, headerOpacity, vendorLogo }: AuditsViewProps) {
  const { adjustments, loading } = useInventoryAdjustments()
  const [filterType, setFilterType] = useState<AdjustmentType | 'all'>('all')
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())

  // Group audit batches - adjustments with same reason starting with "Audit:" created within 60 seconds
  const groupedAdjustments = useMemo(() => {
    const sorted = [...adjustments].sort((a, b) =>
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
          return Math.abs(adjTime - otherTime) < 60000 // Within 60 seconds
        })

        if (batchAdjustments.length > 1) {
          // Create batch
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

      // Add as individual adjustment
      processed.add(adj.id)
      result.push(adj)
    })

    return result
  }, [adjustments])

  // Filter adjustments and batches
  const filteredAdjustments = useMemo(() => {
    if (filterType === 'all') return groupedAdjustments
    return groupedAdjustments.filter(item => {
      if ('type' in item && item.type === 'batch') {
        // For batches, check if all adjustments match the filter
        return item.adjustments.every(adj => adj.adjustment_type === filterType)
      }
      // Type guard: item is InventoryAdjustment
      return 'adjustment_type' in item && item.adjustment_type === filterType
    })
  }, [groupedAdjustments, filterType])

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AdjustmentOrBatch[]> = {}
    filteredAdjustments.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(item)
    })
    return Object.entries(groups).sort((a, b) =>
      new Date(b[1][0].created_at).getTime() - new Date(a[1][0].created_at).getTime()
    )
  }, [filteredAdjustments])

  const toggleBatch = (batchId: string) => {
    const newExpanded = new Set(expandedBatches)
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId)
    } else {
      newExpanded.add(batchId)
    }
    setExpandedBatches(newExpanded)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

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

  const FILTER_OPTIONS: { value: AdjustmentType | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'count_correction', label: 'Corrections' },
    { value: 'damage', label: 'Damage' },
    { value: 'shrinkage', label: 'Shrinkage' },
    { value: 'theft', label: 'Theft' },
    { value: 'expired', label: 'Expired' },
    { value: 'received', label: 'Received' },
    { value: 'return', label: 'Returns' },
  ]

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="rgba(235,235,245,0.6)" />
        <Text style={styles.loadingText}>Loading audit records...</Text>
      </View>
    )
  }

  if (filteredAdjustments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No audit records</Text>
        <Text style={styles.emptySubtitle}>
          {filterType === 'all'
            ? 'Inventory adjustments will appear here'
            : `No ${getTypeLabel(filterType as AdjustmentType).toLowerCase()} records found`
          }
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.content}
      contentContainerStyle={{ paddingTop: 100, paddingBottom: layout.dockHeight, paddingRight: layout.containerMargin }}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, top: 100, bottom: layout.dockHeight }}
      onScroll={(e) => {
        const offsetY = e.nativeEvent.contentOffset.y
        const threshold = 40
        // Instant transition like iOS
        headerOpacity.setValue(offsetY > threshold ? 1 : 0)
      }}
      scrollEventThrottle={16}
    >
      {/* Large Title with Vendor Logo - scrolls with content */}
      <View style={styles.cardWrapper}>
        <View style={styles.titleSectionContainer}>
          <View style={styles.largeTitleContainer}>
            <View>
              <View style={styles.titleWithLogo}>
                {vendorLogo && (
                  <Image
                    source={{ uri: vendorLogo }}
                    style={styles.vendorLogoInline}
                    resizeMode="contain"
                        fadeDuration={0}
                  />
                )}
                <Text style={styles.largeTitleHeader}>Audits</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {filteredAdjustments.length} {filteredAdjustments.length === 1 ? 'record' : 'records'}
              </Text>
            </View>
            <Pressable
              style={styles.addButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onCreatePress()
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Create new audit"
            >
              <Text style={styles.addButtonText}>Create Audit</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTER_OPTIONS.map(option => (
          <Pressable
            key={option.value}
            style={[
              styles.filterPill,
              filterType === option.value && styles.filterPillActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setFilterType(option.value)
            }}
          >
            <Text
              style={[
                styles.filterPillText,
                filterType === option.value && styles.filterPillTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Grouped Adjustments */}
      {groupedByDate.map(([date, dayItems]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              <View style={styles.card}>
                {dayItems.map((item, index) => {
                  // Check if this is a batch or single adjustment
                  if ('type' in item && item.type === 'batch') {
                    const batch = item as AuditBatch
                    const isExpanded = expandedBatches.has(batch.id)

                    return (
                      <View key={batch.id}>
                        {/* Batch Summary Row */}
                        <Pressable
                          style={styles.batchRow}
                          onPress={() => toggleBatch(batch.id)}
                        >
                          <View style={styles.adjustmentLeft}>
                            {/* Time */}
                            <Text style={styles.adjustmentTime}>{formatTime(batch.created_at)}</Text>

                            {/* Batch Info */}
                            <View style={styles.adjustmentInfo}>
                              <View style={styles.batchHeader}>
                                <Text style={styles.batchTitle}>Bulk Audit</Text>
                                <Text style={styles.batchCount}>
                                  {batch.adjustments.length} {batch.adjustments.length === 1 ? 'product' : 'products'}
                                </Text>
                              </View>
                              {batch.location_name && (
                                <Text style={styles.adjustmentLocation}>{batch.location_name}</Text>
                              )}
                            </View>

                            {/* Reason */}
                            <Text style={styles.adjustmentReason}>{batch.reason}</Text>
                          </View>

                          {/* Total Quantity Change */}
                          <View style={styles.batchRight}>
                            <Text style={styles.expandIndicator}>{isExpanded ? '▼' : '▶'}</Text>
                            <Text
                              style={[
                                styles.quantityChange,
                                batch.total_quantity_change > 0 && styles.quantityPositive,
                                batch.total_quantity_change < 0 && styles.quantityNegative,
                              ]}
                            >
                              {batch.total_quantity_change > 0 ? '+' : ''}{batch.total_quantity_change}g
                            </Text>
                          </View>
                        </Pressable>

                        {/* Expanded Product Details */}
                        {isExpanded && (
                          <View style={styles.batchExpanded}>
                            {batch.adjustments.map((adj, adjIndex) => (
                              <View key={adj.id} style={styles.batchItem}>
                                <View style={styles.batchItemLeft}>
                                  <Text style={styles.adjustmentProduct}>{adj.product?.name || 'Unknown'}</Text>
                                  {adj.product?.sku && (
                                    <Text style={styles.adjustmentSKU}>SKU: {adj.product.sku}</Text>
                                  )}
                                </View>
                                <View style={styles.batchItemRight}>
                                  <Text
                                    style={[
                                      styles.batchItemChange,
                                      adj.quantity_change > 0 && styles.quantityPositive,
                                      adj.quantity_change < 0 && styles.quantityNegative,
                                    ]}
                                  >
                                    {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}g
                                  </Text>
                                  <Text style={styles.batchItemBefore}>{adj.quantity_before}g → {adj.quantity_after}g</Text>
                                </View>
                                {adjIndex < batch.adjustments.length - 1 && (
                                  <View style={styles.batchItemDivider} />
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                        {index < dayItems.length - 1 && <View style={styles.divider} />}
                      </View>
                    )
                  }

                  // Regular adjustment
                  const adj = item as InventoryAdjustment
                  return (
                    <View key={adj.id}>
                      <View style={styles.adjustmentRow}>
                        <View style={styles.adjustmentLeft}>
                          {/* Time */}
                          <Text style={styles.adjustmentTime}>{formatTime(adj.created_at)}</Text>

                          {/* Product Info */}
                          <View style={styles.adjustmentInfo}>
                            <Text style={styles.adjustmentProduct}>{adj.product?.name || 'Unknown'}</Text>
                            {adj.product?.sku && (
                              <Text style={styles.adjustmentSKU}>SKU: {adj.product.sku}</Text>
                            )}
                            {adj.location?.name && (
                              <Text style={styles.adjustmentLocation}>{adj.location.name}</Text>
                            )}
                          </View>

                          {/* Reason */}
                          <Text style={styles.adjustmentReason}>{adj.reason}</Text>
                          {adj.notes && (
                            <Text style={styles.adjustmentNotes}>Note: {adj.notes}</Text>
                          )}
                        </View>

                        {/* Quantity Change */}
                        <View style={styles.adjustmentRight}>
                          <Text
                            style={[
                              styles.quantityChange,
                              adj.quantity_change > 0 && styles.quantityPositive,
                              adj.quantity_change < 0 && styles.quantityNegative,
                            ]}
                          >
                            {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}g
                          </Text>
                          <Text style={styles.quantityBefore}>{adj.quantity_before}g</Text>
                          <Text style={styles.quantityArrow}>↓</Text>
                          <Text style={styles.quantityAfter}>{adj.quantity_after}g</Text>
                        </View>
                      </View>

                      {index < dayItems.length - 1 && <View style={styles.divider} />}
                    </View>
                  )
                })}
              </View>
            </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  titleSectionContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  titleWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  vendorLogoInline: {
    width: 80,
    height: 80,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  // Large Title
  largeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
  },
  largeTitleHeader: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  cardWrapper: {
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing (6px)
    marginVertical: layout.contentVertical,
  },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    marginTop: spacing.xxs,
  },
  filtersContainer: {
    maxHeight: 60,
    marginBottom: spacing.md,
  },
  filtersContent: {
    paddingHorizontal: 6, // Match cardWrapper margin
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterPill: {
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
  filterPillTextActive: {
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.huge,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  content: {
    flex: 1,
  },
  dateGroup: {
    marginBottom: spacing.lg,
    marginHorizontal: 6, // Ultra-minimal iOS-style spacing matching Products
  },
  dateHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    paddingHorizontal: layout.cardPadding,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  adjustmentRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  adjustmentLeft: {
    flex: 1,
  },
  adjustmentTime: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
    marginBottom: spacing.xs,
  },
  adjustmentInfo: {
    marginBottom: spacing.xs,
  },
  adjustmentProduct: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: spacing.xxs,
  },
  adjustmentSKU: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  adjustmentLocation: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
    marginTop: spacing.xxs,
  },
  adjustmentReason: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
    letterSpacing: -0.1,
    marginBottom: spacing.xxs,
  },
  adjustmentNotes: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
    fontStyle: 'italic',
  },
  adjustmentRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  quantityChange: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  quantityPositive: {
    color: colors.semantic.success,
  },
  quantityNegative: {
    color: colors.semantic.error,
  },
  quantityBefore: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },
  quantityArrow: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.ghost,
    letterSpacing: -0.1,
    marginVertical: spacing.xxxs,
  },
  quantityAfter: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.1,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: spacing.md,
  },
  // Batch styles
  batchRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  batchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxs,
  },
  batchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  batchCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  batchRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  expandIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  batchExpanded: {
    marginTop: spacing.sm,
    marginLeft: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  batchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  batchItemLeft: {
    flex: 1,
  },
  batchItemRight: {
    alignItems: 'flex-end',
    gap: spacing.xxxs,
  },
  batchItemChange: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  batchItemBefore: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.text.quaternary,
    letterSpacing: -0.1,
  },
  batchItemDivider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
})
