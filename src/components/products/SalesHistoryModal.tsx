/**
 * SalesHistoryModal Component
 * Product sales history with trends and analytics
 * Apple Engineering: Data visualization, clear insights, beautiful design
 */

import { View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius, typography } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import { useProductSalesHistory } from '@/hooks/useSalesHistory'
import type { Product } from '@/hooks/useProducts'

interface SalesHistoryModalProps {
  visible: boolean
  product: Product | null
  onClose: () => void
}

type DateRange = '7days' | '30days' | '90days' | 'all'

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: '90days', label: '90 Days' },
  { value: 'all', label: 'All Time' },
]

export function SalesHistoryModal({
  visible,
  product,
  onClose,
}: SalesHistoryModalProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30days')
  const [startDate, setStartDate] = useState<string | undefined>()
  const [endDate, setEndDate] = useState<string | undefined>()

  // Calculate date range
  useEffect(() => {
    const now = new Date()
    const end = now.toISOString()
    let start: string | undefined

    if (dateRange === '7days') {
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 7)
      start = startDate.toISOString()
    } else if (dateRange === '30days') {
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 30)
      start = startDate.toISOString()
    } else if (dateRange === '90days') {
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 90)
      start = startDate.toISOString()
    } else {
      start = undefined // All time
    }

    setStartDate(start)
    setEndDate(end)
  }, [dateRange])

  const { salesRecords, stats, loading } = useProductSalesHistory(
    product?.id,
    startDate,
    endDate
  )

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null || isNaN(value)) return '$0.00'
    return `$${value.toFixed(2)}`
  }
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.container}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[styles.background, !isLiquidGlassSupported && styles.backgroundFallback]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 70 }} />
            <Text style={styles.headerTitle}>Sales History</Text>
            <Pressable onPress={handleClose} style={styles.headerButton}>
              <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Product Info */}
            <View style={styles.section}>
              <View style={styles.card}>
                <Text style={styles.productName}>{product?.name || 'Unknown'}</Text>
                <Text style={styles.productSKU}>{product?.sku || 'No SKU'}</Text>
              </View>
            </View>

            {/* Date Range Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TIME PERIOD</Text>
              <View style={styles.dateRangeContainer}>
                {DATE_RANGES.map((range) => (
                  <Pressable
                    key={range.value}
                    style={[
                      styles.dateRangeButton,
                      dateRange === range.value && styles.dateRangeButtonActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setDateRange(range.value)
                    }}
                  >
                    <Text
                      style={[
                        styles.dateRangeButtonText,
                        dateRange === range.value && styles.dateRangeButtonTextActive,
                      ]}
                    >
                      {range.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#60A5FA" />
                <Text style={styles.loadingText}>Loading sales data...</Text>
              </View>
            ) : (
              <>
                {/* Stats Summary */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>SUMMARY</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Total Sales</Text>
                      <Text style={styles.statValue}>{stats?.total_units_sold || 0}g</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Revenue</Text>
                      <Text style={styles.statValue}>{formatCurrency(stats?.total_revenue || 0)}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Orders</Text>
                      <Text style={styles.statValue}>{stats?.total_orders || 0}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Avg Price</Text>
                      <Text style={styles.statValue}>{formatCurrency(stats?.average_unit_price || 0)}/g</Text>
                    </View>
                  </View>
                </View>

                {/* Sales by Order Type */}
                {stats?.by_order_type && Object.keys(stats.by_order_type).length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>BY ORDER TYPE</Text>
                    <View style={styles.card}>
                      {Object.entries(stats.by_order_type).map(([type, data], index, arr) => (
                        <View key={type}>
                          <View style={styles.orderTypeRow}>
                            <View>
                              <Text style={styles.orderTypeLabel}>
                                {type.replace('_', ' ').toUpperCase()}
                              </Text>
                              <Text style={styles.orderTypeUnits}>{data.units}g sold</Text>
                            </View>
                            <Text style={styles.orderTypeRevenue}>{formatCurrency(data.revenue)}</Text>
                          </View>
                          {index < arr.length - 1 && <View style={styles.divider} />}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Simple Chart - Daily Sales */}
                {stats?.by_date && stats.by_date.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>DAILY SALES</Text>
                    <View style={styles.card}>
                      <View style={styles.chartContainer}>
                        {stats.by_date.map((day, index) => {
                          const maxRevenue = Math.max(...stats.by_date.map(d => d.revenue))
                          const barHeight = maxRevenue > 0 ? (day.revenue / maxRevenue) * 120 : 0

                          return (
                            <View key={day.date} style={styles.chartBar}>
                              <View style={styles.chartBarInfo}>
                                <Text style={styles.chartBarValue}>{formatCurrency(day.revenue)}</Text>
                              </View>
                              <View style={[styles.chartBarFill, { height: Math.max(barHeight, 4) }]} />
                              <Text style={styles.chartBarLabel}>{formatDate(day.date)}</Text>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  </View>
                )}

                {/* Recent Sales List */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>RECENT SALES</Text>
                  {salesRecords && salesRecords.length > 0 ? (
                    <View style={styles.card}>
                      {salesRecords.slice(0, 20).map((sale, index) => (
                        <View key={sale.id}>
                          <View style={styles.saleRow}>
                            <View style={styles.saleInfo}>
                              <Text style={styles.saleName}>
                                Order #{sale.order_number}
                              </Text>
                              <Text style={styles.saleDate}>
                                {new Date(sale.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </Text>
                              {sale.customer_name && (
                                <Text style={styles.saleCustomer}>{sale.customer_name}</Text>
                              )}
                            </View>
                            <View style={styles.saleAmount}>
                              <Text style={styles.saleQuantity}>{sale.quantity}g</Text>
                              <Text style={styles.saleTotal}>{formatCurrency(sale.total)}</Text>
                            </View>
                          </View>
                          {index < salesRecords.length - 1 && <View style={styles.divider} />}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>No sales in this period</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </LiquidGlassView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  background: {
    flex: 1,
  },
  backgroundFallback: {
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    minWidth: 70,
    paddingVertical: spacing.xs,
    alignItems: 'flex-end',
  },
  headerButtonText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  headerButtonTextPrimary: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.headline,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.uppercaseLabel,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
  },
  productName: {
    ...typography.title3,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  productSKU: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: '#60A5FA',
    borderColor: '#60A5FA',
  },
  dateRangeButtonText: {
    ...typography.footnote,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  dateRangeButtonTextActive: {
    color: colors.text.primary,
  },
  loadingContainer: {
    marginTop: spacing.huge,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.footnote,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
  },
  statLabel: {
    ...typography.caption1,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.title2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  orderTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  orderTypeLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  orderTypeUnits: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  orderTypeRevenue: {
    ...typography.headline,
    color: colors.text.primary,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border.subtle,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
    paddingTop: spacing.lg,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  chartBarInfo: {
    marginBottom: spacing.xs,
  },
  chartBarValue: {
    ...typography.caption2,
    color: colors.text.tertiary,
    fontSize: 9,
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: radius.xs,
    minHeight: 4,
  },
  chartBarLabel: {
    ...typography.caption2,
    color: colors.text.quaternary,
    marginTop: spacing.xxs,
    fontSize: 8,
    transform: [{ rotate: '-45deg' }],
  },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  saleInfo: {
    flex: 1,
  },
  saleName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  saleDate: {
    ...typography.footnote,
    color: colors.text.tertiary,
  },
  saleCustomer: {
    ...typography.footnote,
    color: colors.text.quaternary,
    marginTop: spacing.xxs,
  },
  saleAmount: {
    alignItems: 'flex-end',
  },
  saleQuantity: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xxs,
  },
  saleTotal: {
    ...typography.headline,
    color: colors.text.primary,
  },
  emptyCard: {
    backgroundColor: colors.glass.regular,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.quaternary,
  },
})
