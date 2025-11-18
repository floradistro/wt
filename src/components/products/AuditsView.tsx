/**
 * AuditsView Component
 * Comprehensive audit trail for inventory adjustments and stock movements
 * Apple Engineering: Clean data presentation, powerful filtering
 */

import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native'
import { useState, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useInventoryAdjustments } from '@/hooks/useInventoryAdjustments'
import type { AdjustmentType } from '@/services/inventory-adjustments.service'

export function AuditsView() {
  const { adjustments, loading } = useInventoryAdjustments()
  const [filterType, setFilterType] = useState<AdjustmentType | 'all'>('all')

  // Filter adjustments
  const filteredAdjustments = useMemo(() => {
    if (filterType === 'all') return adjustments
    return adjustments.filter(adj => adj.adjustment_type === filterType)
  }, [adjustments, filterType])

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof adjustments> = {}
    filteredAdjustments.forEach(adj => {
      const date = new Date(adj.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(adj)
    })
    return Object.entries(groups).sort((a, b) =>
      new Date(b[1][0].created_at).getTime() - new Date(a[1][0].created_at).getTime()
    )
  }, [filteredAdjustments])

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

  const getTypeBadgeColor = (type: AdjustmentType) => {
    const colors: Record<AdjustmentType, string> = {
      count_correction: '#60A5FA',
      damage: '#EF4444',
      shrinkage: '#F59E0B',
      theft: '#DC2626',
      expired: '#F97316',
      received: '#10B981',
      return: '#3B82F6',
      other: '#6B7280',
    }
    return colors[type]
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Audit Trail</Text>
        <Text style={styles.headerSubtitle}>
          {filteredAdjustments.length} {filteredAdjustments.length === 1 ? 'record' : 'records'}
        </Text>
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

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(235,235,245,0.6)" />
          <Text style={styles.loadingText}>Loading audit records...</Text>
        </View>
      ) : filteredAdjustments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No audit records</Text>
          <Text style={styles.emptySubtitle}>
            {filterType === 'all'
              ? 'Inventory adjustments will appear here'
              : `No ${getTypeLabel(filterType as AdjustmentType).toLowerCase()} records found`
            }
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {groupedByDate.map(([date, dayAdjustments]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              <View style={styles.card}>
                {dayAdjustments.map((adj, index) => (
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

                        {/* Type Badge */}
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor: `${getTypeBadgeColor(adj.adjustment_type)}10`,
                              borderColor: `${getTypeBadgeColor(adj.adjustment_type)}30`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              { color: getTypeBadgeColor(adj.adjustment_type) },
                            ]}
                          >
                            {getTypeLabel(adj.adjustment_type)}
                          </Text>
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

                    {index < dayAdjustments.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.8,
    marginBottom: spacing.xxs,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  filtersContainer: {
    maxHeight: 60,
  },
  filtersContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
    paddingHorizontal: spacing.lg,
  },
  dateGroup: {
    marginBottom: spacing.lg,
  },
  dateHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
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
  typeBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    borderWidth: 0.5,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
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
})
