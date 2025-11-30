/**
 * ECommerceDetail Component - ZERO PROPS ✅
 * Specialized detail view for e-commerce shipping orders
 *
 * Workflow: Pending → Confirmed → Packing → Packed → Shipped → In Transit → Delivered
 * Uses modals: ConfirmECommerceOrderModal, PackOrderModal, ShipOrderModal, MarkDeliveredModal
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import type { Order } from '@/services/orders.service'
import { ordersService, type OrderItem } from '@/services/orders.service'
import { useOrders, useOrdersStore, useOrdersActions } from '@/stores/orders.store'
import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'
import {
  ConfirmECommerceOrderModal,
  PackOrderModal,
  ShipOrderModal,
  MarkDeliveredModal,
} from '../modals'

export function ECommerceDetail() {
  const selectedOrderId = useSelectedOrderId()
  const orders = useOrders()
  const order = orders.find(o => o.id === selectedOrderId)
  const { selectOrder } = useOrdersUIActions()
  const { refreshOrders } = useOrdersActions()

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPackModal, setShowPackModal] = useState(false)
  const [showShipModal, setShowShipModal] = useState(false)
  const [showDeliveredModal, setShowDeliveredModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  // Load order items
  useEffect(() => {
    if (!order) return

    const loadItems = async () => {
      try {
        setLoadingItems(true)
        const fullOrder = await ordersService.getOrderById(order.id)
        setOrderItems(fullOrder.items || [])
      } catch (error) {
        logger.error('Failed to load order items:', error)
      } finally {
        setLoadingItems(false)
      }
    }

    loadItems()
  }, [order?.id])

  const handleBack = () => {
    selectOrder(null)
  }

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (!order) return

    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      await useOrdersStore.getState().updateOrderStatus(order.id, newStatus)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to update e-commerce order status:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to update order status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCall = () => {
    if (order?.customer_phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`tel:${order.customer_phone}`)
    }
  }

  const handleText = () => {
    if (order?.customer_phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`sms:${order.customer_phone}`)
    }
  }

  const handleEmail = () => {
    if (order?.customer_email) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`mailto:${order.customer_email}`)
    }
  }

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return '#34c759' // Green - Done
      case 'cancelled':
        return '#ff3b30' // Red
      case 'pending':
        return '#ff9500' // Orange - Needs attention
      case 'confirmed':
        return '#0a84ff' // Blue - Confirmed/Ready
      case 'shipped':
      case 'in_transit':
        return '#bf5af2' // Purple - In transit
      case 'preparing':
      case 'packing':
      case 'packed':
      case 'ready_to_ship':
        return '#0a84ff' // Blue for in-progress
      default:
        return '#8e8e93' // Gray
    }
  }

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'confirmed': return 'Confirmed'
      case 'preparing': return 'Preparing'
      case 'packing': return 'Packing'
      case 'packed': return 'Packed'
      case 'ready_to_ship': return 'Ready to Ship'
      case 'shipped': return 'Shipped'
      case 'in_transit': return 'In Transit'
      case 'delivered': return 'Delivered'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  // Get button text and handler based on status
  // Apple-style: processing → shipped → delivered (3 states, 1 action)
  const getActionButton = () => {
    if (!order) {
      return { text: undefined, handler: undefined, disabled: true }
    }

    // Terminal states - no action
    if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'completed') {
      return { text: undefined, handler: undefined, disabled: true }
    }

    // Confirmed/Pending/etc - show Ship button (Apple-style: one action)
    if (['confirmed', 'pending', 'preparing', 'packing', 'packed', 'ready_to_ship'].includes(order.status)) {
      return { text: 'Ship', handler: () => setShowShipModal(true), disabled: isUpdating }
    }

    // Shipped/In Transit - show Delivered button
    if (order.status === 'shipped' || order.status === 'in_transit') {
      return { text: 'Mark Delivered', handler: () => setShowDeliveredModal(true), disabled: isUpdating }
    }

    return { text: undefined, handler: undefined, disabled: true }
  }

  const actionButton = getActionButton()

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>No order selected</Text>
        <Text style={styles.emptyText}>Select an e-commerce order to view details</Text>
      </View>
    )
  }

  return (
    <View style={styles.detail}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: layout.dockHeight }}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        {/* Title Card - Steve Jobs Minimal */}
        <View style={styles.headerCardContainer}>
          <View style={styles.headerCardGlass}>
            <View style={styles.headerCard}>
              {/* Back Button */}
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
              </Pressable>

              {/* Customer Avatar */}
              <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                <Text style={styles.headerIconText}>
                  {(order.customer_name || 'G').charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Customer Info */}
              <View style={styles.headerInfo}>
                <Text style={styles.headerTitle}>{order.customer_name || 'Guest'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="cube-outline" size={13} color="rgba(235,235,245,0.6)" />
                  <Text style={styles.headerSubtitle}>Shipping Order</Text>
                </View>
              </View>

              {/* Right Actions */}
              <View style={styles.headerActions}>
                {/* Contact Icons */}
                {order.customer_phone && (
                  <Pressable style={styles.iconButton} onPress={handleCall}>
                    <Ionicons name="call" size={20} color={colors.text.primary} />
                  </Pressable>
                )}
                {order.customer_email && (
                  <Pressable style={styles.iconButton} onPress={handleEmail}>
                    <Ionicons name="mail" size={20} color={colors.text.primary} />
                  </Pressable>
                )}

                {/* Status Button - Always Visible */}
                <Pressable
                  style={[
                    styles.statusButton,
                    { backgroundColor: getStatusColor(order.status) }
                  ]}
                  onPress={() => {
                    if (actionButton.handler) {
                      actionButton.handler()
                    }
                  }}
                  disabled={isUpdating || !actionButton.text}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.statusButtonText}>
                      {actionButton.text || getStatusLabel(order.status)}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Shipping Information */}
        {order.tracking_number && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Information</Text>
            <View style={styles.cardGlass}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tracking</Text>
                <Text style={styles.infoValue}>{order.tracking_number}</Text>
              </View>
              {order.shipping_cost && (
                <View style={[styles.infoRow, styles.lastRow]}>
                  <Text style={styles.infoLabel}>Shipping Cost</Text>
                  <Text style={styles.infoValue}>${order.shipping_cost.toFixed(2)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Shipping Address */}
        {order.shipping_address_line1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <View style={styles.cardGlass}>
              {order.shipping_name && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{order.shipping_name}</Text>
                </View>
              )}
              <View style={[styles.infoRow, !order.shipping_phone && styles.lastRow]}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>
                  {order.shipping_address_line1}
                  {order.shipping_address_line2 && `\n${order.shipping_address_line2}`}
                  {'\n'}
                  {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                </Text>
              </View>
              {order.shipping_phone && (
                <View style={[styles.infoRow, styles.lastRow]}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{order.shipping_phone}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.cardGlass}>
            {loadingItems ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.text.secondary} />
              </View>
            ) : orderItems.length > 0 ? (
              orderItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.infoRow,
                    index === orderItems.length - 1 && styles.lastRow
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoValue}>{item.product_name}</Text>
                    <Text style={[styles.infoLabel, { marginTop: 4 }]}>
                      Qty: {item.quantity} × ${item.unit_price.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.infoValue}>
                    ${item.line_total.toFixed(2)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={styles.infoLabel}>No items found</Text>
              </View>
            )}
          </View>
        </View>

        {/* Order Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.cardGlass}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Number</Text>
              <Text style={styles.infoValue}>{order.order_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {new Date(order.created_at).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.infoRow, styles.lastRow]}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoValue}>{order.payment_method || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.cardGlass}>
            <View style={[styles.infoRow, styles.totalRow, styles.lastRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <ConfirmECommerceOrderModal
        visible={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <PackOrderModal
        visible={showPackModal}
        onClose={() => {
          setShowPackModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <ShipOrderModal
        visible={showShipModal}
        onClose={() => {
          setShowShipModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <MarkDeliveredModal
        visible={showDeliveredModal}
        onClose={() => {
          setShowDeliveredModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />
    </View>
  )
}

// Reuse same styles as StorePickupDetail
const styles = StyleSheet.create({
  detail: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  headerCardContainer: {
    marginHorizontal: layout.containerMargin,
    marginTop: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.containerMargin,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 36,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 100,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
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
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  infoValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.border.regular,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
})
