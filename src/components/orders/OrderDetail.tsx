/**
 * Order Detail Component - REFACTORED (Zero Props)
 * Comprehensive order workflows with all edge cases
 * Professional, interactive order management - POS-quality UX
 *
 * CHANGES FROM ORIGINAL:
 * - NO PROPS (was: order, onBack, onOrderUpdated)
 * - Reads order from stores (by selectedOrderId)
 * - All state from order-detail.store (was: 15+ useState)
 * - Vendor from AppAuthContext (not loaded again)
 * - Real-time in store (not component)
 * - Form state in store (not local)
 * - Modal state in store (not local)
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert, Animated, TextInput, Image } from 'react-native'
import { useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import type { Order } from '@/services/orders.service'

// ✅ NEW: Import from Context
import { useAppAuth } from '@/contexts/AppAuthContext'

// ✅ NEW: Import from Zustand stores
import { useOrders, useOrdersActions, useOrdersStore } from '@/stores/orders.store'
import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'
import {
  useOrderItems,
  useLoyaltyData,
  useTaxDetails,
  useOrderDetailLoading,
  useOrderDetailModals,
  useOrderDetailForm,
  useOrderDetailSuccess,
  useOrderDetailActions,
} from '@/stores/order-detail.store'

// NO PROPS! Component reads from stores
export function OrderDetail() {
  // ========================================
  // FOUNDATION from Context (vendor)
  // ========================================
  const { vendor } = useAppAuth()

  // ========================================
  // GET SELECTED ORDER from Zustand
  // ========================================
  const selectedOrderId = useSelectedOrderId()
  const orders = useOrders()
  const order = orders.find(o => o.id === selectedOrderId)

  // ========================================
  // BUSINESS LOGIC from Zustand (order data)
  // ========================================
  const orderItems = useOrderItems()
  const { loyaltyPointsEarned, loyaltyPointsRedeemed } = useLoyaltyData()
  const taxDetails = useTaxDetails()
  const { loading, isUpdating } = useOrderDetailLoading()

  // ========================================
  // UI STATE from Zustand (modals, success)
  // ========================================
  const { showNotesModal, showLabelModal } = useOrderDetailModals()
  const { staffNotes, trackingNumber, shippingCost } = useOrderDetailForm()
  const { showSuccess, successMessage } = useOrderDetailSuccess()

  // ========================================
  // ACTIONS from Zustand
  // ========================================
  const {
    loadOrderDetails,
    updateNotes,
    updateShippingLabel,
    advanceStatus,
    openNotesModal,
    closeNotesModal,
    openLabelModal,
    closeLabelModal,
    setStaffNotes,
    setTrackingNumber,
    setShippingCost,
    showSuccessOverlay,
    reset: resetDetail,
  } = useOrderDetailActions()

  const { refreshOrders } = useOrdersActions()
  const { selectOrder } = useOrdersUIActions()

  // ========================================
  // LOCAL UI STATE (animations only)
  // ========================================
  const successOpacity = useRef(new Animated.Value(0)).current
  const successScale = useRef(new Animated.Value(0.8)).current
  const buttonScale = useRef(new Animated.Value(1)).current

  // ========================================
  // INITIALIZATION & CLEANUP
  // ========================================

  // Load order details when order selected
  useEffect(() => {
    if (!order?.id) {
      logger.warn('[OrderDetail] No order selected')
      return
    }

    logger.info('[OrderDetail] Loading details for order:', order.id)
    loadOrderDetails(order.id)

    // Cleanup when order deselected
    return () => {
      logger.info('[OrderDetail] Cleaning up order details')
      resetDetail()
    }
  }, [order?.id])

  // ========================================
  // SUCCESS ANIMATION (synced with store state)
  // ========================================

  useEffect(() => {
    if (showSuccess) {
      Animated.parallel([
        Animated.spring(successOpacity, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.spring(successScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(successScale, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [showSuccess])

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleBack = () => {
    selectOrder(null)
  }

  const handleStatusUpdate = async (newStatus: Order['status'], label: string) => {
    if (!order) return

    try {
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Use advanceStatus for context-aware workflows, or direct status update
      // For now, we'll use direct update (advanceStatus is for "next" button)
      await useOrdersStore.getState().updateOrderStatus(order.id, newStatus)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showSuccessOverlay(label)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to update order status:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to update order status')
    }
  }

  const handleAdvanceStatus = async () => {
    if (!order) return

    try {
      const orderType = order.order_type || order.delivery_type || 'walk_in'
      await advanceStatus(order.id, orderType, order.status)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to advance status:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to update status')
    }
  }

  const handleCancelOrder = () => {
    if (!order) return

    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await useOrdersStore.getState().updateOrderStatus(order.id, 'cancelled')
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              showSuccessOverlay('Order cancelled')
              refreshOrders()
            } catch (error) {
              logger.error('Failed to cancel order:', error)
              Alert.alert('Error', 'Failed to cancel order')
            }
          },
        },
      ]
    )
  }

  const handleSaveNotes = async () => {
    if (!order) return

    try {
      await updateNotes(order.id, staffNotes)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to save notes:', error)
      Alert.alert('Error', 'Failed to save notes')
    }
  }

  const handleSaveLabel = async () => {
    if (!order) return

    if (!trackingNumber.trim()) {
      Alert.alert('Error', 'Please enter a tracking number')
      return
    }

    try {
      const cost = shippingCost ? parseFloat(shippingCost) : undefined
      await updateShippingLabel(order.id, trackingNumber.trim(), cost)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to save label:', error)
      Alert.alert('Error', 'Failed to save shipping label')
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

  // ========================================
  // HELPERS (Pure Functions)
  // ========================================

  const getOrderType = () => {
    if (!order) return 'Store'
    const type = order.order_type || order.delivery_type || 'walk_in'
    switch (type.toLowerCase()) {
      case 'walk_in':
      case 'instore':
        return 'Walk-in'
      case 'pickup':
        return 'Pickup'
      case 'delivery':
        return 'Delivery'
      case 'shipping':
        return 'Shipping'
      default:
        return 'Store'
    }
  }

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return '#34c759'
      case 'cancelled':
        return '#ff3b30'
      case 'pending':
      case 'ready_to_ship':
        return '#ff9500'
      case 'preparing':
      case 'ready':
      case 'out_for_delivery':
      case 'shipped':
      case 'in_transit':
        return '#0a84ff'
      default:
        return '#8e8e93'
    }
  }

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'preparing': return 'Preparing'
      case 'ready': return 'Ready'
      case 'out_for_delivery': return 'Out for Delivery'
      case 'ready_to_ship': return 'Ready to Ship'
      case 'shipped': return 'Shipped'
      case 'in_transit': return 'In Transit'
      case 'delivered': return 'Delivered'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
    }
  }

  // Get next status button based on order type
  const getNextStatusButton = () => {
    if (!order) return null

    const orderType = order.order_type || order.delivery_type || 'walk_in'
    const status = order.status

    switch (orderType.toLowerCase()) {
      case 'walk_in':
      case 'instore':
        if (status === 'pending') {
          return { status: 'completed' as Order['status'], label: 'Mark Complete' }
        }
        break

      case 'pickup':
        if (status === 'pending') {
          return { status: 'preparing' as Order['status'], label: 'Start Preparing' }
        } else if (status === 'preparing') {
          return { status: 'ready' as Order['status'], label: 'Mark Ready' }
        } else if (status === 'ready') {
          return { status: 'completed' as Order['status'], label: 'Mark Complete' }
        }
        break

      case 'delivery':
        if (status === 'pending') {
          return { status: 'preparing' as Order['status'], label: 'Start Preparing' }
        } else if (status === 'preparing') {
          return { status: 'out_for_delivery' as Order['status'], label: 'Out for Delivery' }
        } else if (status === 'out_for_delivery') {
          return { status: 'completed' as Order['status'], label: 'Mark Complete' }
        }
        break

      case 'shipping':
        if (status === 'pending') {
          return { status: 'preparing' as Order['status'], label: 'Start Preparing' }
        } else if (status === 'preparing') {
          return { status: 'ready_to_ship' as Order['status'], label: 'Ready to Ship' }
        } else if (status === 'ready_to_ship') {
          return { status: 'shipped' as Order['status'], label: 'Mark Shipped' }
        } else if (status === 'shipped') {
          return { status: 'in_transit' as Order['status'], label: 'In Transit' }
        } else if (status === 'in_transit') {
          return { status: 'delivered' as Order['status'], label: 'Mark Delivered' }
        }
        break
    }

    return null
  }

  // ========================================
  // RENDER
  // ========================================

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>No order selected</Text>
        <Text style={styles.emptyText}>Select an order to view details</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text.secondary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    )
  }

  const nextStatusButton = getNextStatusButton()

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
          <Text style={styles.backButtonText}>Orders</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Vendor Logo */}
          {vendor?.logo_url && (
            <Image
              source={{ uri: vendor.logo_url }}
              style={styles.vendorLogo}
              resizeMode="contain"
            />
          )}

          {/* Order Number */}
          <Text style={styles.orderNumber}>{order.order_number}</Text>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(order.status)}20` },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(order.status) },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(order.status) },
              ]}
            >
              {getStatusLabel(order.status)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {order.status !== 'completed' &&
          order.status !== 'delivered' &&
          order.status !== 'cancelled' && (
            <View style={styles.actionButtonsContainer}>
              {nextStatusButton && (
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonPrimary]}
                    onPress={() =>
                      handleStatusUpdate(
                        nextStatusButton.status,
                        nextStatusButton.label
                      )
                    }
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>
                          {nextStatusButton.label}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </Animated.View>
              )}

              <Pressable
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={handleCancelOrder}
                disabled={isUpdating}
              >
                <Ionicons name="close-circle" size={20} color="#ff3b30" />
                <Text style={[styles.actionButtonText, { color: '#ff3b30' }]}>
                  Cancel Order
                </Text>
              </Pressable>
            </View>
          )}

        {/* Order Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>{order.customer_name || 'Guest'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{getOrderType()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {new Date(order.created_at).toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoValue}>
                {order.payment_method || 'N/A'}
              </Text>
            </View>
            {order.staff_notes && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{order.staff_notes}</Text>
              </View>
            )}
            <Pressable
              style={styles.editNotesButton}
              onPress={() => openNotesModal(order.staff_notes || '')}
            >
              <Ionicons name="create-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.editNotesText}>
                {order.staff_notes ? 'Edit Notes' : 'Add Notes'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Payment Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Breakdown</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subtotal</Text>
              <Text style={styles.infoValue}>${order.subtotal.toFixed(2)}</Text>
            </View>

            {taxDetails.map((tax, index) => (
              <View key={index} style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {tax.name} {tax.rate ? `(${(tax.rate * 100).toFixed(2)}%)` : ''}
                </Text>
                <Text style={styles.infoValue}>${tax.amount.toFixed(2)}</Text>
              </View>
            ))}

            {order.discount_amount > 0 && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: '#34c759' }]}>Discount</Text>
                <Text style={[styles.infoValue, { color: '#34c759' }]}>
                  -${order.discount_amount.toFixed(2)}
                </Text>
              </View>
            )}

            {loyaltyPointsRedeemed > 0 && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: '#34c759' }]}>
                  Loyalty Points Redeemed
                </Text>
                <Text style={[styles.infoValue, { color: '#34c759' }]}>
                  {loyaltyPointsRedeemed} pts
                </Text>
              </View>
            )}

            {loyaltyPointsEarned > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Loyalty Points Earned</Text>
                <Text style={styles.infoValue}>{loyaltyPointsEarned} pts</Text>
              </View>
            )}

            <View style={[styles.infoRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Customer Contact */}
        {(order.customer_phone || order.customer_email) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Contact</Text>
            <View style={styles.contactButtons}>
              {order.customer_phone && (
                <>
                  <Pressable style={styles.contactButton} onPress={handleCall}>
                    <Ionicons name="call" size={20} color={colors.text.primary} />
                    <Text style={styles.contactButtonText}>Call</Text>
                  </Pressable>
                  <Pressable style={styles.contactButton} onPress={handleText}>
                    <Ionicons name="chatbubble" size={20} color={colors.text.primary} />
                    <Text style={styles.contactButtonText}>Text</Text>
                  </Pressable>
                </>
              )}
              {order.customer_email && (
                <Pressable style={styles.contactButton} onPress={handleEmail}>
                  <Ionicons name="mail" size={20} color={colors.text.primary} />
                  <Text style={styles.contactButtonText}>Email</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Shipping Info (for shipping orders) */}
        {(order.order_type as string) === 'shipping' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Information</Text>
            <View style={styles.card}>
              {order.tracking_number && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tracking</Text>
                  <Text style={styles.infoValue}>{order.tracking_number}</Text>
                </View>
              )}
              {order.shipping_cost && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Shipping Cost</Text>
                  <Text style={styles.infoValue}>${order.shipping_cost.toFixed(2)}</Text>
                </View>
              )}
              {order.shipping_address_line1 && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>
                    {order.shipping_address_line1}
                    {order.shipping_address_line2 && `, ${order.shipping_address_line2}`}
                    {'\n'}
                    {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                  </Text>
                </View>
              )}
              <Pressable
                style={styles.editNotesButton}
                onPress={() =>
                  openLabelModal(
                    order.tracking_number || '',
                    order.shipping_cost?.toString() || ''
                  )
                }
              >
                <Ionicons name="create-outline" size={20} color={colors.text.secondary} />
                <Text style={styles.editNotesText}>
                  {order.tracking_number ? 'Edit Label' : 'Add Label'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.card}>
            {orderItems.map((item) => (
              <View key={item.id} style={styles.orderItemRow}>
                <View style={styles.orderItemInfo}>
                  <Text style={styles.orderItemName}>{item.product_name}</Text>
                  <Text style={styles.orderItemDetails}>
                    {item.quantity} × ${item.unit_price.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.orderItemTotal}>
                  ${item.line_total.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Success Overlay */}
      {showSuccess && (
        <Animated.View
          style={[
            styles.successOverlay,
            {
              opacity: successOpacity,
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <BlurView intensity={90} style={styles.successBlur}>
            <Ionicons name="checkmark-circle" size={64} color="#34c759" />
            <Text style={styles.successMessage}>{successMessage}</Text>
          </BlurView>
        </Animated.View>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} style={styles.modalBlur}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Staff Notes</Text>
              <TextInput
                style={styles.modalInput}
                value={staffNotes}
                onChangeText={setStaffNotes}
                placeholder="Enter notes..."
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={4}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={closeNotesModal}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveNotes}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      )}

      {/* Shipping Label Modal */}
      {showLabelModal && (
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} style={styles.modalBlur}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Shipping Label</Text>
              <TextInput
                style={styles.modalInput}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                placeholder="Tracking number *"
                placeholderTextColor={colors.text.tertiary}
                autoFocus
              />
              <TextInput
                style={styles.modalInput}
                value={shippingCost}
                onChangeText={setShippingCost}
                placeholder="Shipping cost (optional)"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={closeLabelModal}
                >
                  <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveLabel}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  )
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.regular,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: 17,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: layout.dockHeight + spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  vendorLogo: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
  },
  orderNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  actionButtonPrimary: {
    backgroundColor: colors.semantic.info,
  },
  actionButtonSecondary: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.regular,
  },
  infoLabel: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.md,
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
    color: colors.text.primary,
  },
  editNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  editNotesText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.regular,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  orderItemDetails: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  orderItemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successBlur: {
    padding: spacing.xl * 2,
    borderRadius: radius.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  successMessage: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBlur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.background.primary,
  },
  modalButtonSave: {
    backgroundColor: colors.semantic.info,
  },
  modalButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonTextCancel: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})
