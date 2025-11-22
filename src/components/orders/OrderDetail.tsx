/**
 * Order Detail Component
 * Comprehensive order workflows with all edge cases
 * Professional, interactive order management - POS-quality UX
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert, Animated, TextInput, Image } from 'react-native'
import { useState, useEffect, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
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
  const [vendorLogo, setVendorLogo] = useState<string | null>(null)
  const [vendorName, setVendorName] = useState<string>('')
  const [loyaltyPointsEarned, setLoyaltyPointsEarned] = useState<number>(0)
  const [loyaltyPointsRedeemed, setLoyaltyPointsRedeemed] = useState<number>(0)
  const [taxDetails, setTaxDetails] = useState<Array<{ name: string; amount: number; rate?: number }>>([])


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
    loadVendorInfo()
    loadLoyaltyAndPaymentInfo()
    loadTaxDetails()
  }, [order.id])

  const loadVendorInfo = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('vendor_id, vendors(id, store_name, logo_url)')
        .eq('id', order.id)
        .single()

      if (orderError) {
        logger.error('Order vendor query error', { error: orderError })
        return
      }

      if (orderData?.vendors) {
        const vendor = orderData.vendors as any
        setVendorName(vendor.store_name || '')
        setVendorLogo(vendor.logo_url || null)
      }
    } catch (error) {
      logger.error('Failed to load vendor info', { error })
    }
  }

  const loadLoyaltyAndPaymentInfo = async () => {
    try {
      // Load loyalty transactions
      if (order.customer_id) {
        const { data: loyaltyData, error: loyaltyError} = await supabase
          .from('loyalty_transactions')
          .select('transaction_type, points')
          .eq('reference_type', 'order')
          .eq('reference_id', order.id)

        if (!loyaltyError && loyaltyData) {
          const earned = loyaltyData.find(t => t.transaction_type === 'earned')?.points || 0
          const spent = Math.abs(loyaltyData.find(t => t.transaction_type === 'spent')?.points || 0)
          setLoyaltyPointsEarned(earned)
          setLoyaltyPointsRedeemed(spent)
        }
      }

      // NOTE: Split payment details are not currently stored in the database
      // The payment_method is normalized ('split' -> 'credit') and only one transaction is created
      // To display split payments, we would need to:
      // 1. Add split_payment_cash and split_payment_card columns to orders table
      // 2. OR create multiple payment_transactions records for split payments
      // 3. OR add split_payments JSONB column to orders table
      //
      // For now, we just show the normalized payment method from the order
      logger.debug('[OrderDetail] Payment method from order:', order.payment_method)
    } catch (error) {
      logger.error('Failed to load loyalty and payment info', { error })
    }
  }

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

  const loadTaxDetails = async () => {
    try {
      logger.debug('[OrderDetail] Loading tax details for order', {
        orderId: order.id,
        pickupLocationId: order.pickup_location_id,
        taxAmount: order.tax_amount
      })

      // Load location tax information
      if (order.pickup_location_id) {
        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .select('tax_name, tax_rate')
          .eq('id', order.pickup_location_id)
          .single()

        logger.debug('[OrderDetail] Location tax data', { locationData, locationError })

        if (!locationError && locationData) {
          // Use the ACTUAL tax rate from the location, not calculated
          // The stored tax_amount is calculated on subtotal AFTER loyalty discounts,
          // so calculating rate from tax_amount/subtotal gives wrong results
          const taxes = []
          if (order.tax_amount > 0) {
            taxes.push({
              name: locationData.tax_name || 'Tax',
              amount: order.tax_amount,
              rate: locationData.tax_rate // Store the actual rate from location
            })
          }
          logger.debug('[OrderDetail] Setting tax details', { taxes })
          setTaxDetails(taxes)
        } else {
          logger.warn('[OrderDetail] No location data found or error', { locationError })
        }
      } else {
        logger.warn('[OrderDetail] No pickup_location_id on order')
      }
    } catch (error) {
      logger.error('Failed to load tax details:', error)
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

      // Update local state immediately for instant UI feedback
      setOrder(prev => ({ ...prev, ...updates }))
      onOrderUpdated?.() // Notify parent component

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
              const now = new Date().toISOString()
              const updates = {
                status: 'cancelled' as Order['status'],
                updated_at: now,
              }

              const { error } = await supabase
                .from('orders')
                .update(updates)
                .eq('id', order.id)

              if (error) throw error

              // Update local state immediately for instant UI feedback
              setOrder(prev => ({ ...prev, ...updates }))
              onOrderUpdated?.() // Notify parent component

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
      const now = new Date().toISOString()
      const updates = {
        staff_notes: staffNotes,
        updated_at: now,
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id)

      if (error) throw error

      // Update local state immediately
      setOrder(prev => ({ ...prev, ...updates }))
      onOrderUpdated?.()

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

      // Update local state immediately
      setOrder(prev => ({ ...prev, ...updates }))
      onOrderUpdated?.()

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
      case 'pending':
        return 'Pending'
      case 'preparing':
        return 'Preparing'
      case 'ready':
        return 'Ready'
      case 'out_for_delivery':
        return 'Out for Delivery'
      case 'ready_to_ship':
        return 'Ready to Ship'
      case 'shipped':
        return 'Shipped'
      case 'in_transit':
        return 'In Transit'
      case 'delivered':
        return 'Delivered'
      case 'completed':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
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

  const orderType = getOrderType()
  const actionButtons = getActionButtons()

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

        {/* Hero Header with Vendor Logo */}
        <View style={styles.heroSection}>
          <View style={styles.heroContainer}>
            <View style={styles.heroContent}>
              {/* Vendor Logo */}
              {vendorLogo ? (
                <Image source={{ uri: vendorLogo }} style={styles.vendorLogo} />
              ) : (
                <View style={[styles.vendorLogo, styles.vendorLogoPlaceholder]}>
                  <Ionicons name="storefront" size={32} color="rgba(255,255,255,0.6)" />
                </View>
              )}

              {/* Order Info */}
              <View style={styles.heroInfo}>
                <Text style={styles.heroOrderNumber}>{order.order_number}</Text>
                {vendorName && (
                  <Text style={styles.heroVendorName}>{vendorName}</Text>
                )}
              </View>

              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(order.status) + '20', borderColor: getStatusColor(order.status) }
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: getStatusColor(order.status) }]}>
                  {getStatusLabel(order.status)}
                </Text>
              </View>
            </View>
          </View>
        </View>


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

        {/* Order Info - Unified Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ORDER INFORMATION</Text>
          <View style={styles.infoCard}>
            {/* Customer */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>{order.customer_name || 'Guest'}</Text>
            </View>

            {/* Type */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{orderType}</Text>
            </View>

            {/* Date */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {new Date(order.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            {/* Payment Method */}
            <View style={[styles.infoRow, !order.staff_notes && styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Payment</Text>
              <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: 16 }}>
                {(order as any).split_payment_cash && (order as any).split_payment_card ? (
                  <>
                    <Text style={styles.infoValue}>Split Payment</Text>
                    <Text style={[styles.infoValue, { fontSize: 13, marginTop: 2 }]}>
                      Cash: ${((order as any).split_payment_cash).toFixed(2)}
                    </Text>
                    <Text style={[styles.infoValue, { fontSize: 13 }]}>
                      Card: ${((order as any).split_payment_card).toFixed(2)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.infoValue}>
                    {order.payment_method === 'cash' ? 'Cash'
                      : order.payment_method === 'card' || order.payment_method === 'credit' || order.payment_method === 'debit' ? 'Card'
                      : order.payment_method || 'N/A'}
                  </Text>
                )}
              </View>
            </View>

            {/* Staff Notes */}
            {order.staff_notes && (
              <View style={[styles.infoRow, styles.infoRowLast]}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{order.staff_notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Breakdown - Clean Rows */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENT</Text>
          <View style={styles.infoCard}>
            {/* Subtotal */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subtotal</Text>
              <Text style={styles.infoValue}>${order.subtotal.toFixed(2)}</Text>
            </View>

            {/* Tax Breakdown */}
            {taxDetails.length > 0 ? (
              <>
                {taxDetails.map((tax, index) => (
                  <View key={index} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{tax.name}</Text>
                    <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: 16 }}>
                      <Text style={styles.infoValue}>${tax.amount.toFixed(2)}</Text>
                      <Text style={[styles.infoValue, { fontSize: 13, marginTop: 2 }]}>
                        {tax.rate ? `${(tax.rate * 100).toFixed(2)}% rate` : 'Tax'}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tax</Text>
                <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: 16 }}>
                  <Text style={styles.infoValue}>${order.tax_amount.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {/* Discount */}
            {order.discount_amount > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Discount</Text>
                <Text style={styles.infoValue}>-${order.discount_amount.toFixed(2)}</Text>
              </View>
            )}

            {/* Loyalty Points Redeemed */}
            {loyaltyPointsRedeemed > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Points Redeemed</Text>
                <Text style={styles.infoValue}>-{loyaltyPointsRedeemed} pts</Text>
              </View>
            )}

            {/* Loyalty Points Earned */}
            {loyaltyPointsEarned > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Points Earned</Text>
                <Text style={styles.infoValue}>+{loyaltyPointsEarned} pts</Text>
              </View>
            )}

            {/* Total */}
            <View style={[styles.infoRow, styles.infoRowTotal, styles.infoRowLast]}>
              <Text style={styles.infoLabelTotal}>Total</Text>
              <Text style={styles.infoValueTotal}>${order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Customer Contact */}
        {(order.customer_email || order.customer_phone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT</Text>
            <View style={styles.infoCard}>
              {order.customer_phone && (
                <Pressable
                  style={[styles.infoRow, !order.customer_email && styles.infoRowLast]}
                  onPress={handleCall}
                >
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{order.customer_phone}</Text>
                </Pressable>
              )}

              {order.customer_email && (
                <Pressable
                  style={[styles.infoRow, styles.infoRowLast]}
                  onPress={handleEmail}
                >
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{order.customer_email}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Shipping Info */}
        {(order.order_type === 'shipping' && (order.tracking_number || order.shipping_address_line1)) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SHIPPING</Text>
            <View style={styles.infoCard}>
              {order.tracking_number && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tracking</Text>
                  <Text style={styles.infoValue}>{order.tracking_number}</Text>
                </View>
              )}
              {order.shipping_cost && (
                <View style={[styles.infoRow, !order.shipping_address_line1 && styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>Cost</Text>
                  <Text style={styles.infoValue}>${order.shipping_cost.toFixed(2)}</Text>
                </View>
              )}
              {order.shipping_address_line1 && (
                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: 16 }}>
                    <Text style={styles.infoValue}>{order.shipping_name}</Text>
                    <Text style={styles.infoValue}>{order.shipping_address_line1}</Text>
                    {order.shipping_address_line2 && (
                      <Text style={styles.infoValue}>{order.shipping_address_line2}</Text>
                    )}
                    <Text style={styles.infoValue}>
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
          <Text style={styles.sectionTitle}>ITEMS ({orderItems.length})</Text>
          <View style={styles.infoCard}>
            {orderItems.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  index === orderItems.length - 1 && styles.itemRowLast
                ]}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemQuantity}>Qty {item.quantity} × ${item.unit_price.toFixed(2)}</Text>
                </View>
                <Text style={styles.itemPrice}>${item.line_total.toFixed(2)}</Text>
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
    paddingHorizontal: layout.containerMargin,
    paddingTop: layout.containerMargin,
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

  // Hero Header
  heroSection: {
    marginHorizontal: layout.containerMargin,
    marginBottom: 24,
    backgroundColor: 'rgba(118,118,128,0.24)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  heroContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  vendorLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  vendorLogoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    flex: 1,
    gap: 4,
  },
  heroOrderNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  heroVendorName: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  primaryActionContainer: {
    paddingHorizontal: layout.containerMargin,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerActionButton: {
    backgroundColor: 'rgba(255,59,48,0.15)',
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
    paddingHorizontal: layout.containerMargin,
  },

  // Unified Info Card Pattern (iOS Settings Style)
  infoCard: {
    marginHorizontal: layout.containerMargin,
    backgroundColor: 'rgba(118,118,128,0.24)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(235,235,245,0.6)',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  infoRowTotal: {
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  infoLabelTotal: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  infoValueTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemRowLast: {
    borderBottomWidth: 0,
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
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '400',
  },
  itemPrice: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '600',
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
