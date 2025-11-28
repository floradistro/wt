/**
 * SalesHistoryModal Component - REFACTORED
 * Full-screen modal matching Products screen design
 *
 * ZERO PROP DRILLING:
 * - Reads from product-edit.store for product data
 * - Reads from product-ui.store for modal visibility
 * - Reads from AppAuthContext for vendor data
 *
 * Features:
 * - Clean list format with sale records
 * - Date range filtering
 * - Summary stats
 * - Matches Products screen styling
 * - Shows customer names and store locations
 */

import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { TitleSection } from '@/components/shared'
import { useOriginalProduct } from '@/stores/product-edit.store'
import { useActiveModal, productUIActions } from '@/stores/product-ui.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { fetchSalesHistory, getSalesStats, type SalesRecord } from '@/services/sales-history.service'
import { logger } from '@/utils/logger'

type DateRange = '7days' | '30days' | '90days' | 'all'

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: '90days', label: '90 Days' },
  { value: 'all', label: 'All Time' },
]

export function SalesHistoryModal() {
  // ========================================
  // STORES & CONTEXT - ZERO PROPS
  // ========================================
  const visible = useActiveModal() === 'sales-history'
  const product = useOriginalProduct()
  const { vendor } = useAppAuth()

  // State
  const [dateRange, setDateRange] = useState<DateRange>('30days')
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
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

    return { startDate: start, endDate: end }
  }, [dateRange])

  // Fetch sales data when modal opens or filters change
  useEffect(() => {
    if (!visible || !product?.id || !vendor?.id) {
      logger.info('[SalesHistoryModal] Skipping load - visible:', visible, 'product:', product?.id, 'vendor:', vendor?.id)
      return
    }

    const loadSalesData = async () => {
      setLoading(true)
      logger.info('[SalesHistoryModal] Loading sales data', {
        vendorId: vendor.id,
        productId: product.id,
        startDate,
        endDate,
      })

      try {
        // Fetch sales records
        const { data: records, error: fetchError } = await fetchSalesHistory(vendor.id, {
          product_id: product.id,
          start_date: startDate,
          end_date: endDate,
        })

        logger.info('[SalesHistoryModal] Fetch result:', {
          recordsCount: records?.length || 0,
          hasError: !!fetchError,
          error: fetchError,
        })

        setSalesRecords(records || [])

        // Fetch stats
        const statsData = await getSalesStats(vendor.id, product.id, startDate, endDate)
        logger.info('[SalesHistoryModal] Stats loaded:', statsData)
        setStats(statsData)
      } catch (error) {
        logger.error('[SalesHistoryModal] Error loading sales data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSalesData()
  }, [visible, product?.id, vendor?.id, startDate, endDate])

  // ========================================
  // HANDLERS
  // ========================================
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    productUIActions.closeModal()
  }

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null || isNaN(value)) return '$0.00'
    return `$${value.toFixed(2)}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // ========================================
  // RENDER
  // ========================================
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.container}>
        {/* Fixed Header */}
        <View style={styles.fixedHeader}>
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Sales History</Text>
          <View style={{ width: 70 }} />
        </View>

        {/* Fade Gradient */}
        <LinearGradient
          colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Title Section */}
          <TitleSection
            title={product?.name || 'Product'}
            subtitle={product?.sku ? `SKU: ${product.sku}` : undefined}
            hideButton
          />

          {/* Date Range Filter */}
          <View style={styles.filterSection}>
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
              <ActivityIndicator size="large" color={colors.text.secondary} />
              <Text style={styles.loadingText}>Loading sales data...</Text>
            </View>
          ) : (
            <>
              {/* Summary Stats */}
              {stats && (
                <View style={styles.statsSection}>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Total Sales</Text>
                      <Text style={styles.statValue}>{(stats.total_units_sold || 0).toFixed(2)}g</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Revenue</Text>
                      <Text style={styles.statValue}>{formatCurrency(stats.total_revenue || 0)}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Orders</Text>
                      <Text style={styles.statValue}>{stats.total_orders || 0}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Avg Price</Text>
                      <Text style={styles.statValue}>{formatCurrency(stats.average_unit_price || 0)}/g</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Sales List */}
              <View style={styles.salesSection}>
                {salesRecords && salesRecords.length > 0 ? (
                  <View style={styles.salesCard}>
                    {salesRecords.map((sale, index) => {
                      const isLast = index === salesRecords.length - 1

                      // DEBUG: Log the first sale record
                      if (index === 0) {
                        logger.info('[SalesHistoryModal] First sale record:', {
                          quantity: sale.quantity,
                          unit_price: sale.unit_price,
                          total: sale.total,
                          customer: sale.customer_name,
                          location: sale.location_name,
                        })
                      }

                      return (
                        <View key={sale.id}>
                          <View style={styles.saleItem}>
                            <View style={styles.saleLeft}>
                              {/* Store/Location Name */}
                              <Text style={styles.saleLocation}>
                                {sale.location_name || 'Store'}
                              </Text>

                              {/* Customer Name */}
                              {sale.customer_name && (
                                <Text style={styles.saleCustomer}>{sale.customer_name}</Text>
                              )}

                              {/* Date */}
                              <Text style={styles.saleDate}>{formatDate(sale.created_at)}</Text>

                              {/* Order Number (small) */}
                              <Text style={styles.saleOrderNumber}>
                                Order #{sale.order_number}
                              </Text>
                            </View>

                            <View style={styles.saleRight}>
                              {/* Quantity - Show tier_name if available, otherwise quantity */}
                              <Text style={styles.saleQuantity}>
                                {sale.tier_name || `${(sale.quantity || 0).toFixed(2)}g`}
                              </Text>

                              {/* Unit Price - Calculate actual price per unit weight */}
                              <Text style={styles.saleUnitPrice}>
                                @ {sale.quantity > 0 ? formatCurrency(sale.total / sale.quantity) : formatCurrency(0)}/g
                              </Text>

                              {/* Total */}
                              <Text style={styles.saleTotal}>{formatCurrency(sale.total)}</Text>
                            </View>
                          </View>
                          {!isLast && <View style={styles.saleDivider} />}
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No Sales</Text>
                    <Text style={styles.emptySubtitle}>
                      No sales found for this period
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  fixedHeader: {
    position: 'absolute',
    top: layout.headerTop,
    left: 0,
    right: 0,
    height: layout.searchBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.contentHorizontal,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.subtle,
  },
  headerButton: {
    minWidth: 70,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    fontSize: 17,
    fontWeight: '400',
    color: '#60A5FA',
    letterSpacing: -0.2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  fadeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: layout.contentStartTop,
    paddingBottom: layout.dockHeight + spacing.xl,
  },

  // Date Range Filter
  filterSection: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: spacing.md,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: '#60A5FA',
    borderColor: '#60A5FA',
  },
  dateRangeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
  dateRangeButtonTextActive: {
    color: colors.text.primary,
  },

  // Loading
  loadingContainer: {
    paddingVertical: spacing.huge,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    marginTop: spacing.md,
    letterSpacing: -0.2,
  },

  // Stats Grid
  statsSection: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    padding: spacing.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },

  // Sales List
  salesSection: {
    paddingHorizontal: layout.contentHorizontal,
  },
  salesCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  saleLeft: {
    flex: 1,
    gap: spacing.xxs,
  },
  saleLocation: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  saleCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
  saleDate: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  saleOrderNumber: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.quaternary,
    letterSpacing: 0,
  },
  saleRight: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  saleQuantity: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  saleUnitPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
  },
  saleTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#60A5FA',
    letterSpacing: -0.4,
  },
  saleDivider: {
    height: 0.5,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.md,
  },

  // Empty State
  emptyContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.tertiary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
})
