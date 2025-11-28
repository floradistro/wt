/**
 * StorePickupDetail Component - ZERO PROPS ✅
 * Specialized detail view for store pickup orders
 *
 * Workflow: Pending → Confirmed → Preparing → Ready → Completed
 * Uses modals: ConfirmPickupOrderModal, MarkReadyModal
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native'
import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import type { Order } from '@/services/orders.service'
import { useOrders, useOrdersStore, useOrdersActions } from '@/stores/orders.store'
import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'
import { ConfirmPickupOrderModal, MarkReadyModal } from '../modals'

export function StorePickupDetail() {
  const selectedOrderId = useSelectedOrderId()
  const orders = useOrders()
  const order = orders.find(o => o.id === selectedOrderId)
  const { selectOrder } = useOrdersUIActions()
  const { refreshOrders } = useOrdersActions()

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showReadyModal, setShowReadyModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

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
      logger.error('Failed to update pickup order status:', error)
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
      case 'completed': return '#34c759'
      case 'cancelled': return '#ff3b30'
      case 'pending': return '#ff9500'
      case 'confirmed':
      case 'preparing':
      case 'ready': return '#0a84ff'
      default: return '#8e8e93'
    }
  }

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'confirmed': return 'Confirmed'
      case 'preparing': return 'Preparing'
      case 'ready': return 'Ready for Pickup'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  // Get button text and handler based on status
  const getActionButton = () => {
    if (!order) {
      return { text: undefined, handler: undefined, disabled: true }
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      return { text: undefined, handler: undefined, disabled: true }
    }

    if (order.status === 'pending') {
      return { text: '✓ Confirm Order', handler: () => setShowConfirmModal(true), disabled: isUpdating }
    }
    if (order.status === 'confirmed') {
      return { text: 'Start Preparing', handler: () => handleStatusUpdate('preparing'), disabled: isUpdating }
    }
    if (order.status === 'preparing') {
      return { text: '✓ Mark Ready', handler: () => setShowReadyModal(true), disabled: isUpdating }
    }
    if (order.status === 'ready') {
      return { text: '✓ Complete', handler: () => handleStatusUpdate('completed'), disabled: isUpdating }
    }

    return { text: undefined, handler: undefined, disabled: true }
  }

  const actionButton = getActionButton()

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>No order selected</Text>
        <Text style={styles.emptyText}>Select a pickup order to view details</Text>
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
                <Text style={styles.headerSubtitle}>
                  {order.pickup_location_name || 'Store Pickup'}
                </Text>
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
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoValue}>{order.payment_method || 'N/A'}</Text>
            </View>
            {order.staff_notes && (
              <View style={[styles.infoRow, styles.lastRow]}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{order.staff_notes}</Text>
              </View>
            )}
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
      <ConfirmPickupOrderModal
        visible={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <MarkReadyModal
        visible={showReadyModal}
        onClose={() => {
          setShowReadyModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />
    </View>
  )
}

// Styles (reuse from OrderDetail)
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
