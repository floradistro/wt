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
import { FullScreenModal, modalStyles } from '@/components/shared'

// ✅ NEW: Import from Context
import { useAppAuth } from '@/contexts/AppAuthContext'

// ✅ NEW: Import from Zustand stores
import { useOrders, useOrdersActions, useOrdersStore } from '@/stores/orders.store'
import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'
import {
  useOrderItems,
  useItemsByLocation,
  useLoyaltyData,
  useTaxDetails,
  useOrderDetailLoading,
  useOrderDetailModals,
  useOrderDetailForm,
  useOrderDetailSuccess,
  useOrderDetailActions,
  type LocationGroup,
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
  const itemsByLocation = useItemsByLocation()
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
    fulfillItemsAtLocation,
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
    <View style={styles.detail}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: layout.dockHeight, paddingRight: 0 }}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
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
                {order.pickup_location_name || 'Online Order'}
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

              {/* Status Button - Always Visible, Always Actionable */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <Pressable
                  style={[
                    styles.statusButton,
                    { backgroundColor: getStatusColor(order.status) }
                  ]}
                  onPress={() => {
                    if (nextStatusButton) {
                      handleStatusUpdate(nextStatusButton.status, nextStatusButton.label)
                    }
                  }}
                  disabled={isUpdating || !nextStatusButton}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.statusButtonText}>
                      {nextStatusButton ? nextStatusButton.label : getStatusLabel(order.status)}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </View>
      </View>

        {/* Order Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.cardGlass}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Number</Text>
              <Text style={styles.infoValue}>{order.order_number}</Text>
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
            {order.created_by_user && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created By</Text>
                <Text style={styles.infoValue}>
                  {order.created_by_user.first_name} {order.created_by_user.last_name}
                </Text>
              </View>
            )}
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
              style={[styles.infoRow, styles.lastRow]}
              onPress={() => openNotesModal(order.staff_notes || '')}
            >
              <Text style={styles.infoLabel}>
                {order.staff_notes ? 'Edit Notes' : 'Add Notes'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.infoValue, { color: 'rgba(235,235,245,0.3)' }]}>Tap</Text>
                <Ionicons name="chevron-forward" size={17} color="rgba(235,235,245,0.3)" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Order Items - Grouped by Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Order Items {itemsByLocation.length > 1 ? `(${itemsByLocation.length} locations)` : ''}
          </Text>

          {/* Show items grouped by location if multi-location */}
          {itemsByLocation.length > 1 ? (
            // Multi-location order: show groups
            itemsByLocation.map((group, groupIndex) => (
              <View key={group.locationId || 'unassigned'} style={[styles.cardGlass, { marginBottom: spacing.md }]}>
                {/* Location Header */}
                <View style={styles.locationHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationName}>{group.locationName}</Text>
                    <Text style={styles.locationSubtitle}>
                      {group.fulfilledCount}/{group.totalCount} items fulfilled
                    </Text>
                  </View>
                  {!group.allFulfilled && group.locationId && (
                    <Pressable
                      style={[styles.fulfillButton, isUpdating && styles.fulfillButtonDisabled]}
                      onPress={() => {
                        if (order && group.locationId) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                          fulfillItemsAtLocation(order.id, group.locationId)
                            .then(() => refreshOrders())
                            .catch((err) => {
                              logger.error('Failed to fulfill items:', err)
                              Alert.alert('Error', 'Failed to fulfill items')
                            })
                        }
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.fulfillButtonText}>Mark Fulfilled</Text>
                      )}
                    </Pressable>
                  )}
                  {group.allFulfilled && (
                    <View style={styles.fulfilledBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#34c759" />
                      <Text style={styles.fulfilledText}>Fulfilled</Text>
                    </View>
                  )}
                </View>

                {/* Items at this location */}
                {group.items.map((item, index) => (
                  <View key={item.id} style={[styles.infoRow, index === group.items.length - 1 && styles.lastRow]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.infoLabel}>{item.product_name}</Text>
                        {item.fulfillment_status === 'fulfilled' && (
                          <Ionicons name="checkmark-circle" size={14} color="#34c759" />
                        )}
                      </View>
                      <Text style={[styles.infoValue, { fontSize: 13, marginTop: 2 }]}>
                        {item.quantity} × ${item.unit_price.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.infoValue}>
                      ${item.line_total.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            // Single location or no location: show simple list
            <View style={styles.cardGlass}>
              {orderItems.map((item, index) => (
                <View key={item.id} style={styles.infoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoLabel}>{item.product_name}</Text>
                    <Text style={[styles.infoValue, { fontSize: 13, marginTop: 2 }]}>
                      {item.quantity} × ${item.unit_price.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.infoValue}>
                    ${item.line_total.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Payment Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.cardGlass}>
            {/* Subtotal */}
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

            <View style={[styles.infoRow, styles.totalRow, styles.lastRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>


        {/* Shipping Info (for shipping orders) */}
        {(order.order_type as string) === 'shipping' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipping Information</Text>
            <View style={styles.cardGlass}>
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
                style={[styles.infoRow, styles.lastRow]}
                onPress={() =>
                  openLabelModal(
                    order.tracking_number || '',
                    order.shipping_cost?.toString() || ''
                  )
                }
              >
                <Text style={styles.infoLabel}>
                  {order.tracking_number ? 'Edit Label' : 'Add Label'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.infoValue, { color: 'rgba(235,235,245,0.3)' }]}>Tap</Text>
                  <Ionicons name="chevron-forward" size={17} color="rgba(235,235,245,0.3)" />
                </View>
              </Pressable>
            </View>
          </View>
        )}

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

      {/* Notes Modal - Standard FullScreenModal */}
      <FullScreenModal
        visible={showNotesModal}
        onClose={closeNotesModal}
        searchValue={staffNotes}
        onSearchChange={setStaffNotes}
        searchPlaceholder="Staff notes..."
      >
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionLabel}>NOTES</Text>
          <TextInput
            style={[modalStyles.card, modalStyles.input, { minHeight: 120, textAlignVertical: 'top' }]}
            value={staffNotes}
            onChangeText={setStaffNotes}
            placeholder="Enter staff notes for this order..."
            placeholderTextColor="rgba(235,235,245,0.3)"
            multiline
            numberOfLines={6}
          />
        </View>

        <Pressable
          style={[modalStyles.button, !staffNotes.trim() && modalStyles.buttonDisabled]}
          onPress={handleSaveNotes}
          disabled={!staffNotes.trim()}
        >
          <Text style={modalStyles.buttonText}>SAVE NOTES</Text>
        </Pressable>
      </FullScreenModal>

      {/* Shipping Label Modal - Standard FullScreenModal */}
      <FullScreenModal
        visible={showLabelModal}
        onClose={closeLabelModal}
        searchValue={trackingNumber}
        onSearchChange={setTrackingNumber}
        searchPlaceholder="Tracking number *"
      >
        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionLabel}>TRACKING NUMBER</Text>
          <TextInput
            style={[modalStyles.card, modalStyles.input]}
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            placeholder="Enter tracking number..."
            placeholderTextColor="rgba(235,235,245,0.3)"
          />
        </View>

        <View style={modalStyles.section}>
          <Text style={modalStyles.sectionLabel}>SHIPPING COST (OPTIONAL)</Text>
          <TextInput
            style={[modalStyles.card, modalStyles.input]}
            value={shippingCost}
            onChangeText={setShippingCost}
            placeholder="Enter shipping cost..."
            placeholderTextColor="rgba(235,235,245,0.3)"
            keyboardType="decimal-pad"
          />
        </View>

        <Pressable
          style={[modalStyles.button, !trackingNumber.trim() && modalStyles.buttonDisabled]}
          onPress={handleSaveLabel}
          disabled={!trackingNumber.trim()}
        >
          <Text style={modalStyles.buttonText}>SAVE LABEL</Text>
        </Pressable>
      </FullScreenModal>
    </View>
  )
}

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  detail: {
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
  // Multi-location styles
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: layout.containerMargin,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  locationSubtitle: {
    fontSize: 12,
    color: 'rgba(235,235,245,0.5)',
    marginTop: 2,
  },
  fulfillButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fulfillButtonDisabled: {
    opacity: 0.5,
  },
  fulfillButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  fulfilledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  fulfilledText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34c759',
  },
})
