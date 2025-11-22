/**
 * Purchase Order Detail Component
 *
 * Displays full purchase order details with items and receiving actions
 */

import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { updatePurchaseOrderStatus, deletePurchaseOrder, type PurchaseOrder, type PurchaseOrderItem } from '@/services/purchase-orders.service'

interface PurchaseOrderDetailProps {
  purchaseOrder: PurchaseOrder
  onBack: () => void
  onUpdated: () => void
  onReceive?: () => void
}

export function PurchaseOrderDetail({
  purchaseOrder,
  onBack,
  onUpdated,
  onReceive,
}: PurchaseOrderDetailProps) {
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    loadItems()
  }, [purchaseOrder.id])

  const loadItems = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          products (
            name,
            sku
          )
        `)
        .eq('purchase_order_id', purchaseOrder.id)
        .order('created_at')

      if (error) throw error

      const itemsWithProducts = (data || []).map((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products
        return {
          ...item,
          product_name: product?.name || '',
          product_sku: product?.sku || '',
          products: undefined,
        }
      })

      setItems(itemsWithProducts)
    } catch (error) {
      logger.error('Failed to load PO items', { error })
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      await updatePurchaseOrderStatus(purchaseOrder.id, newStatus as any)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onUpdated()
    } catch (error) {
      logger.error('Failed to update status', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      await deletePurchaseOrder(purchaseOrder.id)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onBack()
      onUpdated()
    } catch (error) {
      logger.error('Failed to delete PO', { error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setIsUpdating(false)
    }
  }

  const statusColor = getStatusColor(purchaseOrder.status)
  const canReceive = purchaseOrder.po_type === 'inbound' &&
    (purchaseOrder.status === 'draft' || purchaseOrder.status === 'pending' || purchaseOrder.status === 'approved' || purchaseOrder.status === 'partially_received')
  const canDelete = purchaseOrder.status === 'draft' || purchaseOrder.status === 'pending'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: layout.dockHeight, paddingRight: 0 }}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Purchase Orders</Text>
        </Pressable>
      </View>

      {/* Header Card */}
      <View style={styles.cardContainer}>
        <View style={styles.cardGlass}>
          <View style={styles.headerCard}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={styles.headerInfo}>
              <Text style={styles.poNumber}>{purchaseOrder.po_number}</Text>
              <View style={styles.headerMeta}>
                <Text style={styles.statusBadge}>{purchaseOrder.status.toUpperCase()}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{purchaseOrder.po_type.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DETAILS</Text>
        <View style={styles.cardGlass}>
          {purchaseOrder.po_type === 'inbound' && purchaseOrder.supplier_name && (
            <SettingsRow label="Supplier" value={purchaseOrder.supplier_name} showChevron={false} />
          )}
          {purchaseOrder.po_type === 'outbound' && purchaseOrder.customer_name && (
            <SettingsRow label="Customer" value={purchaseOrder.customer_name} showChevron={false} />
          )}
          {purchaseOrder.location_name && (
            <SettingsRow label="Location" value={purchaseOrder.location_name} showChevron={false} />
          )}
          {purchaseOrder.expected_delivery_date && (
            <SettingsRow
              label="Expected Delivery"
              value={new Date(purchaseOrder.expected_delivery_date).toLocaleDateString()}
              showChevron={false}
            />
          )}
          <SettingsRow
            label="Created"
            value={new Date(purchaseOrder.created_at).toLocaleDateString()}
            showChevron={false}
          />
        </View>
      </View>

      {/* Items Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ITEMS ({items.length})</Text>
        <View style={styles.cardGlass}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.text.secondary} />
            </View>
          ) : (
            items.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  index === items.length - 1 && styles.itemRowLast,
                ]}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  {item.product_sku && (
                    <Text style={styles.itemSku}>{item.product_sku}</Text>
                  )}
                </View>
                <View style={styles.itemQuantity}>
                  <Text style={styles.itemQtyText}>
                    {item.received_quantity}/{item.quantity}
                  </Text>
                  <Text style={styles.itemQtyLabel}>RECEIVED</Text>
                </View>
                <Text style={styles.itemPrice}>
                  ${(item.unit_price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Totals Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TOTALS</Text>
        <View style={styles.cardGlass}>
          <SettingsRow label="Subtotal" value={`$${(purchaseOrder.subtotal || 0).toFixed(2)}`} showChevron={false} />
          <SettingsRow label="Tax" value={`$${(purchaseOrder.tax_amount || 0).toFixed(2)}`} showChevron={false} />
          <SettingsRow label="Shipping" value={`$${(purchaseOrder.shipping_cost || 0).toFixed(2)}`} showChevron={false} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${(purchaseOrder.total_amount || 0).toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>
        <View style={styles.cardGlass}>
          {canReceive && onReceive && (
            <Pressable
              style={[styles.row, !purchaseOrder.status.includes('draft') && !canDelete && styles.rowLast]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onReceive()
              }}
            >
              <Text style={styles.actionLabel}>Receive Items</Text>
              <Text style={styles.rowChevron}>􀆊</Text>
            </Pressable>
          )}
          {purchaseOrder.status === 'draft' && (
            <Pressable
              style={[styles.row, !canDelete && styles.rowLast]}
              onPress={() => handleStatusChange('pending')}
              disabled={isUpdating}
            >
              <Text style={styles.actionLabel}>Submit for Approval</Text>
              {isUpdating ? (
                <ActivityIndicator size="small" color={colors.text.secondary} />
              ) : (
                <Text style={styles.rowChevron}>􀆊</Text>
              )}
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              style={[styles.row, styles.rowLast]}
              onPress={handleDelete}
              disabled={isUpdating}
            >
              <Text style={[styles.actionLabel, styles.actionDanger]}>Delete Purchase Order</Text>
              {isUpdating ? (
                <ActivityIndicator size="small" color="#ff3b30" />
              ) : (
                <Text style={styles.rowChevron}>􀆊</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  )
}

function SettingsRow({ label, value, showChevron }: { label: string; value?: string; showChevron: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {showChevron && <Text style={styles.rowChevron}>􀆊</Text>}
      </View>
    </View>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'draft': return 'rgba(235,235,245,0.3)'
    case 'pending':
    case 'approved': return '#ff9500'
    case 'partially_received': return '#0a84ff'
    case 'received': return '#34c759'
    case 'cancelled': return '#ff3b30'
    default: return 'rgba(235,235,245,0.3)'
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.containerMargin,
    paddingVertical: layout.containerMargin,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  cardContainer: {
    marginHorizontal: layout.containerMargin,
    marginTop: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.containerMargin,
    gap: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  headerInfo: {
    flex: 1,
  },
  poNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.3,
  },
  metaDot: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.3,
  },
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  rowChevron: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.3)',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0a84ff',
    letterSpacing: -0.2,
  },
  actionDanger: {
    color: '#ff3b30',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  itemSku: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  itemQuantity: {
    alignItems: 'flex-end',
    gap: 2,
  },
  itemQtyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  itemQtyLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.2,
    minWidth: 80,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34c759',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
})
