/**
 * POSOrderCard - Unified Order Card + Modal for POS
 *
 * Follows the exact same pattern as POSProductCard:
 * - Tap: Open order modal (view mode)
 * - Long-press card: Open in edit mode
 * - Long-press inside modal: Toggle edit mode
 * - Double-tap: Save changes
 * - Swipe handle: Dismiss
 *
 * Zero redundancy - replaces:
 * - OrderDetail
 * - EditOrderModal
 * - ShipOrderModal
 * - MarkReadyModal
 * - PackOrderModal
 * - ConfirmPickupOrderModal
 */

import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Modal, ScrollView, Pressable, TextInput, Alert, Easing, Linking, PanResponder } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useState, useRef, memo, useEffect, useMemo, useCallback } from 'react'

// Stores
import { useOrdersActions } from '@/stores/orders.store'
import { useAuth } from '@/stores/auth.store'
import { useSelectedOrderId, ordersUIActions } from '@/stores/orders-ui.store'
import { checkoutUIActions } from '@/stores/checkout-ui.store'

// Context
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useAppAuth } from '@/contexts/AppAuthContext'

// Services
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { ordersService, type Order, type OrderItem, type OrderLocation } from '@/services/orders.service'

// Layout
import { layout } from '@/theme/layout'

const { width, height } = Dimensions.get('window')

// Apple-standard spring configs for 60fps animations
const SPRING_OPEN = {
  tension: 300,
  friction: 26,
  useNativeDriver: true,
}

const SPRING_DRAG = {
  tension: 350,
  friction: 28,
  useNativeDriver: true,
}

// Status colors
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  packing: '#6366f1',
  packed: '#14b8a6',
  ready: '#10b981',
  ready_to_ship: '#06b6d4',
  shipped: '#0ea5e9',
  in_transit: '#3b82f6',
  out_for_delivery: '#8b5cf6',
  delivered: '#10b981',
  completed: '#10b981',
  cancelled: '#ef4444',
}

// Payment status colors
const PAYMENT_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  paid: '#10b981',
  failed: '#ef4444',
  refunded: '#6366f1',
  partially_refunded: '#8b5cf6',
  partial: '#f97316', // Orange for partial payment (multi-card)
}

// Carrier tracking URLs
const CARRIER_TRACKING_URLS: Record<string, (tracking: string) => string> = {
  usps: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  ups: (t) => `https://www.ups.com/track?tracknum=${t}`,
  fedex: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
  dhl: (t) => `https://www.dhl.com/en/express/tracking.html?AWB=${t}`,
}

// Get next status based on order type
function getNextStatus(order: Order): Order['status'] | null {
  const { order_type, status } = order

  if (order_type === 'walk_in') {
    if (status === 'pending') return 'completed'
    return null
  }

  if (order_type === 'pickup') {
    if (status === 'pending') return 'preparing'
    if (status === 'preparing') return 'ready'
    if (status === 'ready') return 'completed'
    return null
  }

  if (order_type === 'shipping') {
    if (status === 'pending') return 'preparing'
    if (status === 'preparing') return 'ready_to_ship'
    if (status === 'ready_to_ship') return 'shipped'
    if (status === 'shipped') return 'in_transit'
    if (status === 'in_transit') return 'delivered'
    return null
  }

  return null
}

// Get action label for next status
function getActionLabel(order: Order): string {
  const nextStatus = getNextStatus(order)
  if (!nextStatus) return ''

  const labels: Record<string, string> = {
    preparing: 'Start Preparing',
    ready: 'Ready for Pickup',
    ready_to_ship: 'Ready to Ship',
    shipped: 'Ship Order',
    in_transit: 'Mark In Transit',
    delivered: 'Mark Delivered',
    completed: 'Complete Order',
  }

  return labels[nextStatus] || nextStatus
}

interface POSOrderCardProps {
  order: Order
}

const POSOrderCard = memo(({ order }: POSOrderCardProps) => {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { vendor } = useAppAuth()
  const { session } = usePOSSession()
  const { updateOrderStatus, refreshOrders } = useOrdersActions()

  // ✅ ZERO PROP DRILLING: Listen for external selection (like POSProductCard pattern)
  const selectedOrderId = useSelectedOrderId()

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderLocations, setOrderLocations] = useState<OrderLocation[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editedNotes, setEditedNotes] = useState('')
  const [editedTrackingNumber, setEditedTrackingNumber] = useState('')
  const [editedCarrier, setEditedCarrier] = useState<string>('')
  const [editedShippingCost, setEditedShippingCost] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Label generation state
  const [generatingLabel, setGeneratingLabel] = useState(false)
  const [labelUrl, setLabelUrl] = useState<string | null>(null)

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current
  const modalSlideAnim = useRef(new Animated.Value(600)).current
  const modalOpacity = useRef(new Animated.Value(0)).current
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const lastTapTime = useRef<number>(0)
  const dragOffset = useRef(0)

  // PanResponder for drag-to-dismiss - memoized for performance
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        dragOffset.current = 0
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragOffset.current = gestureState.dy
          // Direct setValue for instant 60fps feedback
          modalSlideAnim.setValue(gestureState.dy)
          modalOpacity.setValue(Math.max(0, 1 - gestureState.dy / 300))
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const DISMISS_THRESHOLD = 100
        const VELOCITY_THRESHOLD = 0.5

        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > VELOCITY_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          closeModal()
        } else {
          // Snap back with optimized spring
          Animated.parallel([
            Animated.spring(modalSlideAnim, {
              toValue: 0,
              ...SPRING_DRAG,
            }),
            Animated.timing(modalOpacity, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start()
        }
      },
    }),
    [modalSlideAnim, modalOpacity]
  )

  // ✅ Load order details AFTER animation completes
  // Use requestAnimationFrame for smoother loading start
  useEffect(() => {
    if (showModal && order.id) {
      // Wait for animation to complete (~250ms) then load
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          loadOrderDetails()
        })
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [showModal, order.id])

  // ✅ Auto-open modal when this order is selected externally (like POSProductCard pattern)
  useEffect(() => {
    if (selectedOrderId === order.id && !showModal) {
      openModal()
    }
  }, [selectedOrderId, order.id, showModal])

  const loadOrderDetails = async () => {
    setLoadingDetails(true)
    try {
      // Fetch order items
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)

      if (!itemsError && items) {
        setOrderItems(items)
      }

      // Fetch order locations for multi-location orders
      const { data: locations, error: locationsError } = await supabase
        .from('order_locations')
        .select('*, location:locations(name)')
        .eq('order_id', order.id)

      if (!locationsError && locations) {
        setOrderLocations(locations.map(loc => ({
          ...loc,
          location_name: loc.location?.name || 'Unknown',
        })))
      }

      // Initialize edit fields
      setEditedNotes(order.staff_notes || '')
      setEditedTrackingNumber(order.tracking_number || '')
      setEditedCarrier(order.shipping_carrier || '')
      setEditedShippingCost(order.shipping_cost?.toString() || '')
      setLabelUrl(order.shipping_label_url || null)

    } catch (error) {
      logger.error('Error loading order details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const openModal = useCallback((startInEditMode = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowModal(true)
    setIsEditing(startInEditMode)

    // Reset to start position
    modalSlideAnim.setValue(600)
    modalOpacity.setValue(0)

    // Apple-standard spring animation
    Animated.parallel([
      Animated.spring(modalSlideAnim, {
        toValue: 0,
        ...SPRING_OPEN,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [modalSlideAnim, modalOpacity])

  const closeModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Clear external selection when closing
    if (selectedOrderId === order.id) {
      ordersUIActions.selectOrder(null)
    }

    // Resume any suspended modal (e.g., customer match modal)
    if (checkoutUIActions.isModalSuspended()) {
      checkoutUIActions.resumeModal()
    }

    // Fast exit animation
    Animated.parallel([
      Animated.timing(modalSlideAnim, {
        toValue: 600,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false)
      setIsEditing(false)
      setHasChanges(false)
      setOrderItems([])
      setOrderLocations([])
    })
  }, [selectedOrderId, order.id, modalSlideAnim, modalOpacity])

  // ========================================
  // GESTURE SYSTEM - Clear separation:
  // - Long-hold: ONLY enters edit mode
  // - Double-tap: Saves (if editing with changes) OR closes modal
  // ========================================

  // Long-hold: Enter edit mode ONLY (never saves)
  const handleLongPressIn = useCallback(() => {
    if (saving || isEditing) return // No-op if already editing

    longPressTimer.current = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      setIsEditing(true)
    }, 600)
  }, [saving, isEditing])

  const handleLongPressOut = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Double-tap: Save (if editing) OR close modal (if not editing)
  const handleDoubleTap = useCallback(() => {
    if (saving) return

    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (isEditing) {
        if (hasChanges) {
          // Editing with changes - save
          saveChanges()
        } else {
          // Editing with no changes - exit edit mode
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          setIsEditing(false)
        }
      } else {
        // Not editing - close modal
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        closeModal()
      }
      lastTapTime.current = 0 // Reset to prevent triple tap
    } else {
      lastTapTime.current = now
    }
  }, [saving, isEditing, hasChanges, closeModal])

  // Save all changes
  const saveChanges = async () => {
    if (saving) return
    setSaving(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }

      // Only include changed fields
      if (editedNotes !== (order.staff_notes || '')) {
        updates.staff_notes = editedNotes
      }
      if (editedTrackingNumber !== (order.tracking_number || '')) {
        updates.tracking_number = editedTrackingNumber
        // Auto-generate tracking URL
        if (editedCarrier && editedTrackingNumber) {
          const urlGenerator = CARRIER_TRACKING_URLS[editedCarrier.toLowerCase()]
          if (urlGenerator) {
            updates.tracking_url = urlGenerator(editedTrackingNumber)
          }
        }
      }
      if (editedCarrier !== (order.shipping_carrier || '')) {
        updates.shipping_carrier = editedCarrier
      }
      if (editedShippingCost !== (order.shipping_cost?.toString() || '')) {
        updates.shipping_cost = parseFloat(editedShippingCost) || 0
      }

      if (Object.keys(updates).length > 1) {
        const { error } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', order.id)

        if (error) throw error

        await refreshOrders()
      }

      setIsEditing(false)
      setHasChanges(false)

    } catch (error) {
      logger.error('Error saving order changes:', error)
      Alert.alert('Error', 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  // Advance order to next status
  const advanceStatus = async () => {
    const nextStatus = getNextStatus(order)
    if (!nextStatus) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    try {
      await updateOrderStatus(order.id, nextStatus)

      // If shipping and need tracking, prompt for it
      if (nextStatus === 'shipped' && !order.tracking_number && !editedTrackingNumber) {
        Alert.alert(
          'Tracking Number',
          'Would you like to add a tracking number?',
          [
            { text: 'Skip', style: 'cancel' },
            { text: 'Add', onPress: () => setIsEditing(true) },
          ]
        )
      }

    } catch (error) {
      logger.error('Error advancing order status:', error)
      Alert.alert('Error', 'Failed to update order status')
    }
  }

  // Generate shipping label via EasyPost
  const generateLabel = async () => {
    if (generatingLabel) return
    setGeneratingLabel(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const { data, error } = await supabase.functions.invoke('easypost-create-label', {
        body: {
          orderId: order.id,
          locationId: session?.locationId || order.pickup_location_id,
        },
      })

      if (error) throw error

      if (data?.success) {
        setEditedTrackingNumber(data.trackingNumber || '')
        setLabelUrl(data.labelUrl || null)
        setHasChanges(true)

        // Auto-save the tracking info
        await supabase
          .from('orders')
          .update({
            tracking_number: data.trackingNumber,
            tracking_url: data.trackingUrl,
            shipping_label_url: data.labelUrl,
            shipping_carrier: 'usps',
            postage_paid: data.cost,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        await refreshOrders()

        // Open label for printing
        if (data.labelUrl) {
          Linking.openURL(data.labelUrl)
        }
      }

    } catch (error: any) {
      logger.error('Error generating label:', error)
      // Try to get detailed error message from Supabase FunctionsHttpError
      let errorMessage = 'Failed to generate shipping label'
      try {
        // FunctionsHttpError has a context property with the response
        if (error?.context) {
          const responseBody = await error.context.json()
          logger.error('Edge function response:', responseBody)
          errorMessage = responseBody?.error || responseBody?.message || errorMessage
        } else if (error?.message) {
          errorMessage = error.message
        }
      } catch (parseError) {
        logger.error('Could not parse error response:', parseError)
        if (error?.message) {
          errorMessage = error.message
        }
      }
      Alert.alert('Label Error', errorMessage)
    } finally {
      setGeneratingLabel(false)
    }
  }

  // Track changes
  useEffect(() => {
    const notesChanged = editedNotes !== (order.staff_notes || '')
    const trackingChanged = editedTrackingNumber !== (order.tracking_number || '')
    const carrierChanged = editedCarrier !== (order.shipping_carrier || '')
    const costChanged = editedShippingCost !== (order.shipping_cost?.toString() || '')

    setHasChanges(notesChanged || trackingChanged || carrierChanged || costChanged)
  }, [editedNotes, editedTrackingNumber, editedCarrier, editedShippingCost, order])

  // Format time ago
  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(order.created_at).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }, [order.created_at])

  // Card press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start()
  }

  const statusColor = STATUS_COLORS[order.status] || '#6b7280'
  const paymentColor = PAYMENT_COLORS[order.payment_status] || '#6b7280'
  const nextAction = getActionLabel(order)

  return (
    <>
      {/* Order Card */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => openModal(false)}
        onLongPress={() => openModal(true)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}
      >
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.cardContent}>
            {/* Order number + status dot */}
            <View style={styles.cardHeader}>
              <View style={styles.orderNumberRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={styles.orderNumber}>#{order.order_number}</Text>
              </View>
              <Text style={styles.timeAgo}>{timeAgo}</Text>
            </View>

            {/* Customer name */}
            <Text style={styles.customerName} numberOfLines={1}>
              {order.customer_name || 'Walk-in'}
            </Text>

            {/* Order type + total */}
            <View style={styles.cardFooter}>
              <View style={styles.orderTypeRow}>
                <Text style={styles.orderType}>
                  {order.order_type?.replace('_', ' ') || 'walk-in'}
                </Text>
                {order.payment_status === 'partial' && (
                  <View style={styles.partialBadge}>
                    <Text style={styles.partialBadgeText}>PARTIAL</Text>
                  </View>
                )}
              </View>
              <Text style={styles.totalAmount}>${order.total_amount?.toFixed(2)}</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* Order Modal - Same glass effect as product modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="none"
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={closeModal}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: modalOpacity }]}>
          {/* Tap outside to dismiss - reduced blur for performance */}
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>

          {/* Modal Sheet */}
          <Animated.View
            style={[
              styles.modalBorder,
              {
                marginLeft: 0,
                marginRight: 0,
                marginBottom: 0,
                maxHeight: height - insets.top - 20,
                transform: [{ translateY: modalSlideAnim }],
              },
            ]}
          >
            <Pressable
              style={styles.modalContent}
              onPress={handleDoubleTap}
              onPressIn={handleLongPressIn}
              onPressOut={handleLongPressOut}
              delayLongPress={600}
            >
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

              {/* Pull Handle */}
              <View style={styles.modalHeaderRow} {...panResponder.panHandlers}>
                <View style={[styles.pullHandle, isEditing && styles.pullHandleEditing]} />
                {isEditing && (
                  <View style={styles.editModeIndicator}>
                    <View style={styles.editModeDot} />
                  </View>
                )}
              </View>

              {/* Scrollable content */}
              <ScrollView
                style={styles.modalScrollContent}
                contentContainerStyle={[styles.modalScrollContentContainer, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Order Header Row - Customer Name as Title */}
                <View style={styles.orderHeaderRow}>
                  {/* Left: Customer Name + Order Info */}
                  <View style={styles.orderInfoBlock}>
                    <Text style={styles.orderHeaderName}>
                      {order.customer_name || 'Walk-in Customer'}
                    </Text>
                    <Text style={styles.orderHeaderMeta}>
                      #{order.order_number} • {order.order_type?.replace('_', ' ') || 'Walk-in'} • {timeAgo}
                    </Text>
                    <View style={styles.statusChip}>
                      <View style={[styles.statusDotSmall, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusChipText, { color: statusColor }]}>
                        {order.status?.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>

                  {/* Right: Total + Payment */}
                  <View style={styles.orderTotalBlock}>
                    <Text style={styles.orderHeaderTotal}>${order.total_amount?.toFixed(2)}</Text>
                    <View style={[styles.paymentChip, { backgroundColor: `${paymentColor}20` }]}>
                      <Text style={[styles.paymentChipText, { color: paymentColor }]}>
                        {order.payment_status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Customer Contact Info */}
                {(order.customer_email || order.customer_phone) && (
                  <View style={styles.customerRow}>
                    <Text style={styles.customerLabel}>Contact</Text>
                    {order.customer_email && (
                      <Text style={styles.customerEmail}>{order.customer_email}</Text>
                    )}
                    {order.customer_phone && (
                      <Text style={styles.customerPhone}>{order.customer_phone}</Text>
                    )}
                  </View>
                )}

                {/* Partial Payment Warning - Multi-Card Split */}
                {order.payment_status === 'partial' && (order as any).metadata?.multi_card_split && (
                  <View style={styles.partialPaymentAlert}>
                    <View style={styles.partialPaymentHeader}>
                      <Text style={styles.partialPaymentTitle}>Partial Payment</Text>
                    </View>
                    <View style={styles.partialPaymentDetails}>
                      <View style={styles.partialPaymentRow}>
                        <Text style={styles.partialPaymentLabel}>Card 1 Paid</Text>
                        <Text style={styles.partialPaymentValue}>
                          ${(order as any).metadata.multi_card_split.card1_amount?.toFixed(2)}
                          {(order as any).metadata.multi_card_split.card1_last4 && (
                            <Text style={styles.partialPaymentCardInfo}>
                              {' '}•••• {(order as any).metadata.multi_card_split.card1_last4}
                            </Text>
                          )}
                        </Text>
                      </View>
                      <View style={styles.partialPaymentRow}>
                        <Text style={styles.partialPaymentLabelRemaining}>Remaining</Text>
                        <Text style={styles.partialPaymentValueRemaining}>
                          ${(order as any).metadata.multi_card_split.amount_remaining?.toFixed(2) ||
                            (order as any).metadata.multi_card_split.card2_amount?.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.retryPaymentBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                        const metadata = (order as any).metadata?.multi_card_split
                        const amountRemaining = metadata?.amount_remaining || metadata?.card2_amount || 0

                        // Capture retry data before closing
                        const retryData = {
                          mode: 'retry',
                          orderId: order.id,
                          orderNumber: order.order_number,
                          amountRemaining: amountRemaining,
                          card1Amount: metadata?.card1_amount || 0,
                          card1Auth: metadata?.card1_auth || '',
                          card1Last4: metadata?.card1_last4 || '',
                        }

                        // Close order card first
                        // Animation starts immediately
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

                        // Clear external selection when closing
                        if (selectedOrderId === order.id) {
                          ordersUIActions.selectOrder(null)
                        }

                        // Fast exit animation - then open payment modal in callback
                        Animated.parallel([
                          Animated.timing(modalSlideAnim, {
                            toValue: 600,
                            duration: 200,
                            useNativeDriver: true,
                          }),
                          Animated.timing(modalOpacity, {
                            toValue: 0,
                            duration: 150,
                            useNativeDriver: true,
                          }),
                        ]).start(() => {
                          // Modal fully closed - now safe to open payment modal
                          setShowModal(false)
                          setIsEditing(false)
                          setHasChanges(false)
                          setOrderItems([])
                          setOrderLocations([])

                          // NOW open the payment modal - with a small delay for iOS modal system
                          // Use requestAnimationFrame + setTimeout to ensure iOS modal stack is clear
                          requestAnimationFrame(() => {
                            setTimeout(() => {
                              checkoutUIActions.openModal('payment', retryData)
                            }, 50)
                          })
                        })
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.retryPaymentBtnText}>Retry Card 2 Payment</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Items List - iOS 26 Grouped List Style */}
                <View style={styles.sectionContainer}>
                  <View style={styles.itemsListContainer}>
                    {orderItems.map((item, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.itemRow,
                          index === 0 && styles.itemRowFirst,
                          index === orderItems.length - 1 && styles.itemRowLast,
                        ]}
                      >
                        <View style={styles.itemRowContent}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.product_name}
                          </Text>
                          <View style={styles.itemRight}>
                            <Text style={styles.itemQty}>×{item.quantity}</Text>
                            <Text style={styles.itemPrice}>${item.line_total?.toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Summary Row */}
                  <View style={styles.summaryContainer}>
                    {order.discount_amount > 0 && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Discount</Text>
                        <Text style={styles.summaryValueDiscount}>-${order.discount_amount?.toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Tax</Text>
                      <Text style={styles.summaryValue}>${order.tax_amount?.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                      <Text style={styles.summaryLabelTotal}>Total</Text>
                      <Text style={styles.summaryValueTotal}>${order.total_amount?.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Split Payment Details - Show for completed multi-card payments */}
                  {(order as any).metadata?.multi_card_split && order.payment_status !== 'partial' && (
                    <View style={styles.splitPaymentDetails}>
                      <Text style={styles.splitPaymentTitle}>Split Payment</Text>
                      <View style={styles.splitPaymentRow}>
                        <View style={styles.splitPaymentCard}>
                          <View style={styles.splitPaymentCardHeader}>
                            <View style={styles.splitPaymentCardBadge}>
                              <Text style={styles.splitPaymentCardBadgeText}>1</Text>
                            </View>
                            <Text style={styles.splitPaymentCardLabel}>Card 1</Text>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          </View>
                          <Text style={styles.splitPaymentCardAmount}>
                            ${(order as any).metadata.multi_card_split.card1_amount?.toFixed(2)}
                          </Text>
                          {(order as any).metadata.multi_card_split.card1_last4 && (
                            <Text style={styles.splitPaymentCardLast4}>
                              •••• {(order as any).metadata.multi_card_split.card1_last4}
                            </Text>
                          )}
                        </View>
                        <View style={styles.splitPaymentDivider}>
                          <Ionicons name="add" size={16} color="rgba(255,255,255,0.3)" />
                        </View>
                        <View style={styles.splitPaymentCard}>
                          <View style={styles.splitPaymentCardHeader}>
                            <View style={styles.splitPaymentCardBadge}>
                              <Text style={styles.splitPaymentCardBadgeText}>2</Text>
                            </View>
                            <Text style={styles.splitPaymentCardLabel}>Card 2</Text>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          </View>
                          <Text style={styles.splitPaymentCardAmount}>
                            ${(order as any).metadata.multi_card_split.card2_amount?.toFixed(2)}
                          </Text>
                          {(order as any).metadata.multi_card_split.card2_last4 && (
                            <Text style={styles.splitPaymentCardLast4}>
                              •••• {(order as any).metadata.multi_card_split.card2_last4}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                {/* Shipping Section */}
                {order.order_type === 'shipping' && !isEditing && (
                  <View style={styles.sectionContainer}>
                    {/* Shipping Address */}
                    {order.shipping_address_line1 && (
                      <View style={styles.shippingAddressContainer}>
                        <View style={styles.shippingAddressRow}>
                          <View style={styles.shippingAddressContent}>
                            <Text style={styles.shippingAddressLabel}>Ship to</Text>
                            <Text style={styles.shippingAddressName}>
                              {order.shipping_name || order.customer_name}
                            </Text>
                            <Text style={styles.shippingAddressText}>
                              {order.shipping_address_line1}
                              {order.shipping_address_line2 ? `\n${order.shipping_address_line2}` : ''}
                              {`\n${order.shipping_city}, ${order.shipping_state} ${order.shipping_zip}`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Tracking */}
                    {(order.tracking_number || editedTrackingNumber) && (
                      <View style={styles.trackingContainer}>
                        <View style={styles.trackingRow}>
                          <View style={styles.trackingContent}>
                            <Text style={styles.trackingCarrier}>
                              {(order.shipping_carrier || editedCarrier || 'Tracking').toUpperCase()}
                            </Text>
                            <Text style={styles.trackingNum}>
                              {order.tracking_number || editedTrackingNumber}
                            </Text>
                          </View>
                          {order.tracking_url && (
                            <TouchableOpacity
                              style={styles.trackBtn}
                              onPress={() => Linking.openURL(order.tracking_url!)}
                            >
                              <Text style={styles.trackBtnText}>Track</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Label Buttons */}
                    {!labelUrl && !order.shipping_label_url ? (
                      <TouchableOpacity
                        style={[styles.generateLabelBtn, generatingLabel && styles.generateLabelBtnDisabled]}
                        onPress={generateLabel}
                        disabled={generatingLabel}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.generateLabelBtnText}>
                          {generatingLabel ? 'Generating...' : 'Generate Shipping Label'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.printLabelBtn}
                        onPress={() => Linking.openURL(labelUrl || order.shipping_label_url!)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.printLabelBtnText}>Print Shipping Label</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Staff Notes */}
                {order.staff_notes && !isEditing && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesTitle}>Notes</Text>
                    <Text style={styles.notesContent}>{order.staff_notes}</Text>
                  </View>
                )}

                {/* Edit Mode */}
                {isEditing && (
                  <View style={styles.editContainer}>
                    {order.order_type === 'shipping' && (
                      <>
                        <TextInput
                          style={styles.editTextInput}
                          value={editedTrackingNumber}
                          onChangeText={setEditedTrackingNumber}
                          placeholder="Tracking Number"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                        />
                        <View style={styles.carrierSelector}>
                          {['USPS', 'UPS', 'FedEx', 'DHL'].map((carrier) => (
                            <TouchableOpacity
                              key={carrier}
                              style={[
                                styles.carrierOption,
                                editedCarrier?.toLowerCase() === carrier.toLowerCase() && styles.carrierOptionActive,
                              ]}
                              onPress={() => setEditedCarrier(carrier.toLowerCase())}
                            >
                              <Text style={[
                                styles.carrierOptionText,
                                editedCarrier?.toLowerCase() === carrier.toLowerCase() && styles.carrierOptionTextActive,
                              ]}>
                                {carrier}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                    <TextInput
                      style={[styles.editTextInput, styles.editTextInputMultiline]}
                      value={editedNotes}
                      onChangeText={setEditedNotes}
                      placeholder="Staff notes..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      multiline
                    />
                  </View>
                )}

                {/* Action Button */}
                {nextAction && !isEditing && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: statusColor }]}
                    onPress={advanceStatus}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionButtonText}>{nextAction}</Text>
                  </TouchableOpacity>
                )}

                {/* Save Button - Edit Mode */}
                {isEditing && hasChanges && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.saveBtn]}
                    onPress={saveChanges}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionButtonText}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  )
})

POSOrderCard.displayName = 'POSOrderCard'
export { POSOrderCard }

const styles = StyleSheet.create({
  // Card Styles - Clean, subtle iOS glass style
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8,
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  timeAgo: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderType: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'capitalize',
  },
  partialBadge: {
    backgroundColor: 'rgba(249,115,22,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partialBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f97316',
    letterSpacing: 0.3,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal Styles - Match POSProductCard exactly
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBorder: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    position: 'relative',
    minHeight: 44,
  },
  pullHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  pullHandleEditing: {
    backgroundColor: '#3b82f6',
    width: 60,
  },
  editModeIndicator: {
    position: 'absolute',
    right: 20,
  },
  editModeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  modalScrollContent: {
    // Let content determine size
  },
  modalScrollContentContainer: {
    paddingHorizontal: 24,
  },

  // Order Header Row - Two Column like Product
  orderHeaderRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
    alignItems: 'flex-start',
  },
  orderInfoBlock: {
    flex: 1,
  },
  orderHeaderName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  orderHeaderMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderTotalBlock: {
    alignItems: 'flex-end',
  },
  orderHeaderTotal: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  paymentChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  paymentChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Partial Payment Alert - Multi-Card Split
  partialPaymentAlert: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  partialPaymentHeader: {
    marginBottom: 12,
  },
  partialPaymentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f97316',
    letterSpacing: -0.2,
  },
  partialPaymentDetails: {
    gap: 8,
    marginBottom: 16,
  },
  partialPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partialPaymentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  partialPaymentValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
  },
  partialPaymentCardInfo: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  partialPaymentLabelRemaining: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316',
  },
  partialPaymentValueRemaining: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f97316',
  },
  retryPaymentBtn: {
    backgroundColor: 'rgba(249,115,22,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  retryPaymentBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f97316',
  },

  // Split Payment Details - Completed multi-card payments
  splitPaymentDetails: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  splitPaymentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  splitPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splitPaymentCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  splitPaymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  splitPaymentCardBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitPaymentCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  splitPaymentCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  splitPaymentCardAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  splitPaymentCardLast4: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  splitPaymentDivider: {
    paddingHorizontal: 4,
  },

  // Customer Row
  customerRow: {
    marginBottom: 16,
  },
  customerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Section Container
  sectionContainer: {
    marginBottom: 16,
  },

  // Items List - iOS 26 Grouped Style
  itemsListContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  itemRow: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 0.33,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  itemRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  itemRowContent: {
    flex: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 17,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
    flex: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemQty: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  itemPrice: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    minWidth: 70,
    textAlign: 'right',
  },

  // Summary
  summaryContainer: {
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryRowTotal: {
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  summaryValueDiscount: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f59e0b',
  },
  summaryLabelTotal: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  summaryValueTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },

  // Shipping Address
  shippingAddressContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  shippingAddressRow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
  },
  shippingAddressContent: {
    padding: 16,
  },
  shippingAddressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  shippingAddressName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  shippingAddressText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },

  // Tracking
  trackingContainer: {
    marginBottom: 12,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
  },
  trackingContent: {
    flex: 1,
  },
  trackingCarrier: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  trackingNum: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  trackBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  trackBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Label Buttons
  generateLabelBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  generateLabelBtnDisabled: {
    opacity: 0.5,
  },
  generateLabelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  printLabelBtn: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  printLabelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },

  // Notes
  notesContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  notesContent: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },

  // Edit Container
  editContainer: {
    marginBottom: 16,
  },
  editTextInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#fff',
    marginBottom: 12,
  },
  editTextInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  carrierSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  carrierOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  carrierOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  carrierOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  carrierOptionTextActive: {
    color: '#fff',
  },

  // Action Button
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
})
