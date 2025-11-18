/**
 * Order Detail Component
 * Comprehensive order workflows with all edge cases
 * Professional, interactive order management - POS-quality UX
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert, Animated, TextInput } from 'react-native'
import { useState, useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { Order } from '@/services/orders.service'

interface OrderItem {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

interface OrderDetailProps {
  order: Order
  onBack: () => void
  onOrderUpdated: () => void
}

export function OrderDetail({ order: initialOrder, onBack, onOrderUpdated }: OrderDetailProps) {
  const [order, setOrder] = useState(initialOrder)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [staffNotes, setStaffNotes] = useState(order.staff_notes || '')
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || '')
  const [shippingCost, setShippingCost] = useState(order.shipping_cost?.toString() || '')

  // Animation values
  const successOpacity = useRef(new Animated.Value(0)).current
  const successScale = useRef(new Animated.Value(0.8)).current
  const buttonScale = useRef(new Animated.Value(1)).current

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          logger.info('Order updated in real-time:', payload.new)
          setOrder(payload.new as Order)
          onOrderUpdated()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [order.id])

  useEffect(() => {
    loadOrderItems()
  }, [order.id])

  const loadOrderItems = async () => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('id, product_name, quantity, unit_price, line_total')
        .eq('order_id', order.id)

      if (error) throw error
      setOrderItems(data || [])
    } catch (error) {
      logger.error('Failed to load order items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const showSuccessAnimation = (message: string) => {
    setSuccessMessage(message)
    setShowSuccess(true)

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

    setTimeout(() => {
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
      ]).start(() => {
        setShowSuccess(false)
      })
    }, 2000)
  }

  const handleStatusUpdate = async (newStatus: Order['status'], label: string) => {
    try {
      setIsUpdating(true)

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

      const now = new Date().toISOString()
      const updates: any = { status: newStatus, updated_at: now }

      // Set timestamps based on status
      switch (newStatus) {
        case 'preparing':
          updates.prepared_at = now
          break
        case 'ready':
          updates.ready_at = now
          updates.notified_at = now
          break
        case 'out_for_delivery':
          updates.ready_at = now
          break
        case 'ready_to_ship':
          updates.ready_at = now
          break
        case 'shipped':
          updates.shipped_at = now
          break
        case 'completed':
          updates.completed_at = now
          break
        case 'delivered':
          updates.delivered_at = now
          updates.completed_at = now
          break
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id)

      if (error) throw error

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showSuccessAnimation(label)
    } catch (error) {
      logger.error('Failed to update order status:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to update order status')
    } finally {
      setIsUpdating(false)
    }
  }

  // Cancel order with confirmation
  const handleCancelOrder = () => {
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
              setIsUpdating(true)
              const { error } = await supabase
                .from('orders')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', order.id)

              if (error) throw error

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              showSuccessAnimation('Order cancelled')
            } catch (error) {
              logger.error('Failed to cancel order:', error)
              Alert.alert('Error', 'Failed to cancel order')
            } finally {
              setIsUpdating(false)
            }
          },
        },
      ]
    )
  }

  // Save staff notes
  const handleSaveNotes = async () => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          staff_notes: staffNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (error) throw error

      setShowNotesModal(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showSuccessAnimation('Notes saved')
    } catch (error) {
      logger.error('Failed to save notes:', error)
      Alert.alert('Error', 'Failed to save notes')
    }
  }

  // Save shipping label info
  const handleSaveLabel = async () => {
    try {
      if (!trackingNumber.trim()) {
        Alert.alert('Error', 'Please enter a tracking number')
        return
      }

      const updates: any = {
        tracking_number: trackingNumber.trim(),
        updated_at: new Date().toISOString(),
      }

      if (shippingCost) {
        const cost = parseFloat(shippingCost)
        if (!isNaN(cost)) {
          updates.shipping_cost = cost
        }
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id)

      if (error) throw error

      setShowLabelModal(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      showSuccessAnimation('Shipping label saved')
    } catch (error) {
      logger.error('Failed to save label:', error)
      Alert.alert('Error', 'Failed to save shipping label')
    }
  }

  const handleCall = () => {
    if (order.customer_phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`tel:${order.customer_phone}`)
    }
  }

  const handleText = () => {
    if (order.customer_phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`sms:${order.customer_phone}`)
    }
  }

  const handleEmail = () => {
    if (order.customer_email) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`mailto:${order.customer_email}`)
    }
  }

  const getOrderType = () => {
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

  // Comprehensive workflow buttons for all order types
  const getActionButtons = () => {
    const buttons = []
    const type = (order.order_type || order.delivery_type || 'walk_in').toLowerCase()

    // Walk-in orders are auto-completed, no actions needed
    if (type === 'walk_in' || type === 'instore') {
      if (order.status === 'completed') return null
    }

    // PICKUP WORKFLOW: pending → preparing → ready → completed
    if (type === 'pickup') {
      switch (order.status) {
        case 'pending':
          buttons.push({
            label: 'Start Preparing',
            action: () => handleStatusUpdate('preparing', 'Started preparing order'),
            primary: true,
          })
          break

        case 'preparing':
          buttons.push({
            label: 'Mark Ready for Pickup',
            action: () => handleStatusUpdate('ready', 'Order ready for pickup'),
            primary: true,
          })
          break

        case 'ready':
          buttons.push({
            label: 'Customer Picked Up',
            action: () => handleStatusUpdate('completed', 'Order completed'),
            primary: true,
          })
          buttons.push({
            label: 'Customer No-Show',
            action: () => handleCancelOrder(),
            primary: false,
          })
          break
      }
    }

    // DELIVERY WORKFLOW: pending → preparing → out_for_delivery → completed
    if (type === 'delivery') {
      switch (order.status) {
        case 'pending':
          buttons.push({
            label: 'Start Preparing',
            action: () => handleStatusUpdate('preparing', 'Started preparing order'),
            primary: true,
          })
          break

        case 'preparing':
          buttons.push({
            label: 'Out for Delivery',
            action: () => handleStatusUpdate('out_for_delivery', 'Order out for delivery'),
            primary: true,
          })
          break

        case 'out_for_delivery':
          buttons.push({
            label: 'Mark Delivered',
            action: () => handleStatusUpdate('completed', 'Order delivered'),
            primary: true,
          })
          buttons.push({
            label: 'Customer Not Home',
            action: () => handleStatusUpdate('ready', 'Returned to store'),
            primary: false,
          })
          buttons.push({
            label: 'Address Issue',
            action: () => setShowNotesModal(true),
            primary: false,
          })
          break
      }
    }

    // SHIPPING WORKFLOW: pending → ready_to_ship → shipped → in_transit → delivered
    if (type === 'shipping') {
      switch (order.status) {
        case 'pending':
          buttons.push({
            label: 'Start Preparing',
            action: () => handleStatusUpdate('preparing', 'Started preparing order'),
            primary: true,
          })
          break

        case 'preparing':
          buttons.push({
            label: 'Ready to Ship',
            action: () => handleStatusUpdate('ready_to_ship', 'Ready for shipping label'),
            primary: true,
          })
          break

        case 'ready_to_ship':
          buttons.push({
            label: 'Mark as Shipped',
            action: () => handleStatusUpdate('shipped', 'Package shipped'),
            primary: true,
          })
          buttons.push({
            label: order.tracking_number ? 'Update Shipping Label' : 'Add Shipping Label',
            action: () => setShowLabelModal(true),
            primary: false,
          })
          break

        case 'shipped':
          buttons.push({
            label: 'In Transit',
            action: () => handleStatusUpdate('in_transit', 'Package in transit'),
            primary: true,
          })
          break

        case 'in_transit':
          buttons.push({
            label: 'Mark Delivered',
            action: () => handleStatusUpdate('delivered', 'Package delivered'),
            primary: true,
          })
          buttons.push({
            label: 'Package Lost',
            action: () => setShowNotesModal(true),
            primary: false,
          })
          break
      }
    }

    // Add cancel button for non-completed orders
    if (order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'delivered') {
      buttons.push({
        label: 'Cancel Order',
        action: () => handleCancelOrder(),
        primary: false,
        danger: true,
      })
    }

    return buttons.length > 0 ? buttons : null
  }

  const getWorkflowSteps = () => {
    const type = (order.order_type || order.delivery_type || 'walk_in').toLowerCase()

    if (type === 'walk_in' || type === 'instore') {
      return ['Completed']
    } else if (type === 'pickup') {
      return ['Pending', 'Preparing', 'Ready', 'Completed']
    } else if (type === 'delivery') {
      return ['Pending', 'Preparing', 'Out for Delivery', 'Completed']
    } else if (type === 'shipping') {
      return ['Pending', 'Preparing', 'Ready to Ship', 'Shipped', 'In Transit', 'Delivered']
    }

    return ['Pending', 'Preparing', 'Completed']
  }

  const getCurrentStepIndex = () => {
    const steps = getWorkflowSteps()
    const status = order.status

    const statusMap: Record<string, string> = {
      'pending': 'Pending',
      'preparing': 'Preparing',
      'ready': 'Ready',
      'out_for_delivery': 'Out for Delivery',
      'ready_to_ship': 'Ready to Ship',
      'shipped': 'Shipped',
      'in_transit': 'In Transit',
      'delivered': 'Delivered',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    }

    const currentLabel = statusMap[status] || 'Pending'
    const index = steps.indexOf(currentLabel)
    return index >= 0 ? index : 0
  }

  const orderType = getOrderType()
  const actionButtons = getActionButtons()
  const workflowSteps = getWorkflowSteps()
  const currentStep = getCurrentStepIndex()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>
        </View>

        {/* Order Info */}
        <View style={styles.compactInfo}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <View style={styles.compactMeta}>
            <Text style={styles.compactMetaText}>{orderType}</Text>
            <Text style={styles.compactMetaDot}>•</Text>
            <Text style={styles.compactMetaText}>{order.customer_name || 'Guest'}</Text>
            <Text style={styles.compactMetaDot}>•</Text>
            <Text style={styles.compactMetaText}>
              ${order.total_amount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Workflow Progress */}
        {order.status !== 'cancelled' && (
          <View style={styles.workflowContainer}>
            <View style={styles.workflowSteps}>
              {workflowSteps.map((step, index) => (
                <View key={step} style={styles.workflowStep}>
                  <View style={[
                    styles.workflowDot,
                    index <= currentStep && styles.workflowDotActive
                  ]} />
                  <Text style={[
                    styles.workflowStepLabel,
                    index === currentStep && styles.workflowStepLabelActive
                  ]}>
                    {step}
                  </Text>
                  {index < workflowSteps.length - 1 && (
                    <View style={[
                      styles.workflowLine,
                      index < currentStep && styles.workflowLineActive
                    ]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cancelled Badge */}
        {order.status === 'cancelled' && (
          <View style={styles.cancelledBadge}>
            <Text style={styles.cancelledText}>ORDER CANCELLED</Text>
          </View>
        )}

        {/* Action Buttons */}
        {actionButtons && actionButtons.length > 0 && (
          <View style={styles.primaryActionContainer}>
            {actionButtons.map((button, index) => (
              <Animated.View
                key={index}
                style={{ transform: [{ scale: button.primary ? buttonScale : 1 }] }}
              >
                <Pressable
                  style={[
                    button.primary ? styles.primaryActionButton : styles.secondaryActionButton,
                    button.danger && styles.dangerActionButton,
                    isUpdating && styles.primaryActionButtonDisabled
                  ]}
                  onPress={button.action}
                  disabled={isUpdating}
                >
                  {isUpdating && button.primary ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={button.primary ? styles.primaryActionText : styles.secondaryActionText}>
                      {button.label}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Staff Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STAFF NOTES</Text>
          <Pressable
            style={styles.card}
            onPress={() => {
              setStaffNotes(order.staff_notes || '')
              setShowNotesModal(true)
            }}
          >
            <Text style={styles.notesText}>
              {order.staff_notes || 'Tap to add notes...'}
            </Text>
          </Pressable>
        </View>

        {/* Customer Contact */}
        {(order.customer_email || order.customer_phone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CUSTOMER CONTACT</Text>
            <View style={styles.card}>
              {order.customer_phone && (
                <View style={styles.contactRow}>
                  <Text style={styles.contactLabel}>Phone</Text>
                  <View style={styles.contactActions}>
                    <Pressable style={styles.contactButton} onPress={handleCall}>
                      <Text style={styles.contactButtonText}>Call</Text>
                    </Pressable>
                    <Pressable style={styles.contactButton} onPress={handleText}>
                      <Text style={styles.contactButtonText}>Text</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {order.customer_email && (
                <View style={[styles.contactRow, !order.customer_phone && styles.contactRowFirst]}>
                  <Text style={styles.contactLabel}>Email</Text>
                  <Pressable style={styles.contactButton} onPress={handleEmail}>
                    <Text style={styles.contactButtonText}>Send Email</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Shipping Info */}
        {(order.order_type === 'shipping' && (order.tracking_number || order.shipping_address_line1)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SHIPPING INFO</Text>
            <View style={styles.card}>
              {order.tracking_number && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tracking Number</Text>
                  <Text style={styles.detailValue}>{order.tracking_number}</Text>
                </View>
              )}
              {order.shipping_cost && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Shipping Cost</Text>
                  <Text style={styles.detailValue}>${order.shipping_cost.toFixed(2)}</Text>
                </View>
              )}
              {order.shipping_address_line1 && (
                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.detailValue}>{order.shipping_name}</Text>
                    <Text style={styles.detailValue}>{order.shipping_address_line1}</Text>
                    {order.shipping_address_line2 && (
                      <Text style={styles.detailValue}>{order.shipping_address_line2}</Text>
                    )}
                    <Text style={styles.detailValue}>
                      {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ITEMS</Text>
          <View style={styles.card}>
            {orderItems.map((item, index) => (
              <View
                key={item.id}
                style={[styles.itemRow, index === orderItems.length - 1 && styles.itemRowLast]}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>${item.line_total.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Order Total */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOTAL</Text>
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>${order.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>${order.tax_amount.toFixed(2)}</Text>
            </View>
            {order.discount_amount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.summaryValue}>-${order.discount_amount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Timestamps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TIMELINE</Text>
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>
                {new Date(order.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {order.prepared_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Started</Text>
                <Text style={styles.detailValue}>
                  {new Date(order.prepared_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            {order.ready_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ready</Text>
                <Text style={styles.detailValue}>
                  {new Date(order.ready_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            {order.shipped_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Shipped</Text>
                <Text style={styles.detailValue}>
                  {new Date(order.shipped_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            {order.completed_at && (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <Text style={styles.detailLabel}>Completed</Text>
                <Text style={styles.detailValue}>
                  {new Date(order.completed_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
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
          <View style={styles.successCard}>
            <View style={styles.successCheckmark}>
              <Text style={styles.successCheckmarkText}>✓</Text>
            </View>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Staff Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={staffNotes}
              onChangeText={setStaffNotes}
              placeholder="Add notes about this order..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonSecondary}
                onPress={() => setShowNotesModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalButtonPrimary}
                onPress={handleSaveNotes}
              >
                <Text style={styles.modalButtonPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Shipping Label Modal */}
      {showLabelModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Shipping Label</Text>

            {/* Tracking Number */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.labelInputLabel}>Tracking Number *</Text>
              <TextInput
                style={styles.labelInput}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                placeholder="Enter USPS tracking number"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoCapitalize="characters"
                autoFocus
              />
            </View>

            {/* Shipping Cost */}
            <View style={{ marginBottom: 20 }}>
              <Text style={styles.labelInputLabel}>Shipping Cost (Optional)</Text>
              <TextInput
                style={styles.labelInput}
                value={shippingCost}
                onChangeText={setShippingCost}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Address Info (Read-only) */}
            {order.shipping_address_line1 && (
              <View style={styles.addressPreview}>
                <Text style={styles.addressPreviewLabel}>SHIPPING TO</Text>
                <Text style={styles.addressPreviewText}>
                  {order.shipping_name}
                </Text>
                <Text style={styles.addressPreviewText}>
                  {order.shipping_address_line1}
                </Text>
                {order.shipping_address_line2 && (
                  <Text style={styles.addressPreviewText}>
                    {order.shipping_address_line2}
                  </Text>
                )}
                <Text style={styles.addressPreviewText}>
                  {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButtonSecondary}
                onPress={() => setShowLabelModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalButtonPrimary}
                onPress={handleSaveLabel}
              >
                <Text style={styles.modalButtonPrimaryText}>Save Label</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: layout.dockHeight + 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: layout.contentHorizontal,
    paddingTop: layout.cardPadding,
    paddingBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
  },

  compactInfo: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: 24,
  },
  orderNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactMetaText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  compactMetaDot: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.3)',
  },

  workflowContainer: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: 24,
  },
  workflowSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workflowStep: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  workflowDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 8,
  },
  workflowDotActive: {
    backgroundColor: '#fff',
  },
  workflowStepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  workflowStepLabelActive: {
    color: '#fff',
  },
  workflowLine: {
    position: 'absolute',
    top: 8,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  workflowLineActive: {
    backgroundColor: '#fff',
  },

  cancelledBadge: {
    marginHorizontal: layout.contentHorizontal,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderWidth: 1,
    borderColor: '#ff3b30',
    alignItems: 'center',
  },
  cancelledText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff3b30',
    letterSpacing: 1,
  },

  primaryActionContainer: {
    paddingHorizontal: layout.contentHorizontal,
    marginBottom: 32,
    gap: 12,
  },
  primaryActionButton: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  secondaryActionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerActionButton: {
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderColor: '#ff3b30',
  },
  primaryActionButtonDisabled: {
    opacity: 0.6,
  },
  primaryActionText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.4,
  },
  secondaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },

  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.contentHorizontal,
  },

  card: {
    marginHorizontal: layout.contentHorizontal,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
  },

  notesText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    lineHeight: 22,
  },

  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  contactRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  contactLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  contactButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  itemRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    marginBottom: 0,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  itemQuantity: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  itemPrice: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '700',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  summaryValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  totalLabel: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 19,
    color: '#fff',
    fontWeight: '700',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  detailRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    marginBottom: 0,
  },
  detailLabel: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  detailValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },

  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 1000,
  },
  successCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  successCheckmark: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34c759',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successCheckmarkText: {
    fontSize: 48,
    color: '#fff',
    fontWeight: '700',
  },
  successText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },

  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 1000,
  },
  modalCard: {
    width: '80%',
    maxWidth: 500,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },

  // Shipping Label Modal Styles
  labelInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  labelInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addressPreview: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addressPreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  addressPreviewText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    lineHeight: 20,
  },
})
