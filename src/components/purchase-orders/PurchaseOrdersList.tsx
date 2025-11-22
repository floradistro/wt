/**
 * Purchase Orders List Component
 *
 * Displays purchase orders in iPad Settings-style glass card layout
 */

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import type { PurchaseOrder } from '@/services/purchase-orders.service'

// Memoized PO Item to prevent flickering
const POItem = React.memo<{
  item: PurchaseOrder
  isLast: boolean
  isSelected: boolean
  onPress: () => void
}>(({ item, isLast, isSelected, onPress }) => {
  const statusColor = getStatusColor(item.status)
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
        <Text style={styles.poNumber} numberOfLines={1}>
          {item.po_number}
        </Text>
        <View style={styles.poMeta}>
          <Text style={styles.poMetaLabel}>{typeLabel}</Text>
          <Text style={styles.poMetaValue} numberOfLines={1}>
            {partnerName || 'N/A'}
          </Text>
        </View>
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
  purchaseOrders: PurchaseOrder[]
  selectedPO: PurchaseOrder | null
  onSelect: (po: PurchaseOrder) => void
  isLoading: boolean
  headerOpacity: Animated.Value
  onAddPress: () => void
  vendorLogo?: string | null
  emptyMessage?: string
}

export function PurchaseOrdersList({
  purchaseOrders,
  selectedPO,
  onSelect,
  isLoading,
  headerOpacity,
  onAddPress,
  vendorLogo,
  emptyMessage = 'No purchase orders found',
}: PurchaseOrdersListProps) {
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
    <View style={styles.container}>
      {/* Fixed Header - appears on scroll */}
      <Animated.View style={[styles.fixedHeader, { opacity: headerOpacity }]}>
        <Text style={styles.fixedHeaderTitle}>Purchase Orders</Text>
      </Animated.View>

      {/* Fade Gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      <ScrollView
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, top: layout.contentStartTop, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingTop: layout.contentStartTop, paddingBottom: layout.dockHeight, paddingRight: 0 }}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y
          const threshold = 40
          headerOpacity.setValue(offsetY > threshold ? 1 : 0)
        }}
        scrollEventThrottle={16}
      >
        {/* Large Title with Vendor Logo - scrolls with content */}
        <View style={styles.cardWrapper}>
          <View style={styles.titleSectionContainer}>
            <View style={styles.largeTitleContainer}>
              <View style={styles.titleWithLogo}>
                {vendorLogo && (
                  <Image
                    source={{ uri: vendorLogo }}
                    style={styles.vendorLogoInline}
                    resizeMode="contain"
                        fadeDuration={0}
                  />
                )}
                <Text style={styles.largeTitleHeader}>Purchase Orders</Text>
              </View>
              <Pressable
                style={styles.addButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onAddPress()
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Add new purchase order"
              >
                <Text style={styles.addButtonText}>Add Purchase Order</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Empty State */}
        {purchaseOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIconContainer}>
              <Text style={styles.emptyStateIcon}>📦</Text>
            </View>
            <Text style={styles.emptyStateTitle}>No Purchase Orders</Text>
            <Text style={styles.emptyStateText}>{emptyMessage}</Text>
            <Pressable
              style={styles.emptyStateButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onAddPress()
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Create Purchase Order"
            >
              <Text style={styles.emptyStateButtonText}>Create Purchase Order</Text>
            </Pressable>
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
                          onPress={() => onSelect(item)}
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
    </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  fixedHeader: {
    position: 'absolute',
    top: layout.cardPadding,
    left: 0,
    right: 0,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fixedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
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
    paddingTop: 16,
    paddingBottom: 8,
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
    color: '#fff',
    letterSpacing: -0.2,
  },
  cardWrapper: {
    marginHorizontal: 6,
    marginVertical: layout.contentVertical,
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
  poMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  poMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  poMetaValue: {
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
    paddingHorizontal: 40,
    paddingVertical: 80,
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
    color: 'rgba(235,235,245,0.9)',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  emptyStateButton: {
    marginTop: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
})
