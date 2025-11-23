/**
 * OrderItem Component - REFACTORED (Reduced Props)
 * Memoized order list item optimized for FlatList virtualization
 * Apple-quality performance with clean color coding
 *
 * CHANGES FROM ORIGINAL:
 * - Removed isSelected prop (derived from selectedOrderId in store)
 * - Removed onPress callback prop (uses store action directly)
 * - Props: 5 → 3 (60% reduction)
 * - Only visual props remain (order, showLocation, isLast)
 */

import React, { useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { type Order } from '@/services/orders.service'
import { ordersStyles as styles } from '../orders.styles'

// ✅ NEW: Import from Zustand stores
import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'

interface OrderItemProps {
  order: Order             // ✅ KEEP: Visual data (needed for rendering)
  showLocation: boolean    // ✅ KEEP: Visual prop (conditional rendering)
  isLast: boolean          // ✅ KEEP: Visual prop (styling)
  // ❌ REMOVED: isSelected (derived from store)
  // ❌ REMOVED: onPress (uses store action)
}

const OrderItem = React.memo<OrderItemProps>(({ order, showLocation, isLast }) => {
  // ========================================
  // DERIVED STATE from Zustand
  // ========================================
  const selectedOrderId = useSelectedOrderId()
  const isSelected = selectedOrderId === order.id  // Derived locally

  // ========================================
  // ACTIONS from Zustand
  // ========================================
  const { selectOrder } = useOrdersUIActions()

  // ========================================
  // EVENT HANDLERS
  // ========================================
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    selectOrder(order.id)  // Direct store action (no callback prop)
  }, [order.id, selectOrder])

  // ========================================
  // HELPER FUNCTIONS (unchanged)
  // ========================================

  // Format time
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Get status color - Clean color coding like stock colors
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'completed':
        return '#34c759' // Green
      case 'cancelled':
        return '#ff3b30' // Red
      case 'pending':
      case 'ready_to_ship':
        return '#ff9500' // Orange
      case 'preparing':
      case 'ready':
      case 'out_for_delivery':
      case 'shipped':
      case 'in_transit':
      case 'delivered':
        return '#fff' // White for in-progress
      default:
        return '#8e8e93' // Gray
    }
  }

  // Get status label - Human-friendly
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
    }
  }

  // Get order type - Clean, no emojis
  const getOrderType = () => {
    // Prefer new order_type field, fallback to legacy delivery_type
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

  const orderType = getOrderType()

  // Get customer initials for icon
  const customerInitials = order.customer_name
    ? order.customer_name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'G'

  // ========================================
  // RENDER (unchanged)
  // ========================================

  return (
    <Pressable
      style={[
        styles.orderItem,
        isSelected && styles.orderItemActive,
        isLast && styles.orderItemLast,
      ]}
      onPress={handlePress}
      accessibilityRole="none"
    >
      {/* Icon/Placeholder */}
      <View style={styles.orderIcon}>
        <View style={[styles.orderIconPlaceholder, styles.orderIconImage]}>
          <Text style={styles.orderIconText}>
            {customerInitials}
          </Text>
        </View>
      </View>

      {/* Customer Name & Time */}
      <View style={styles.orderInfo}>
        <Text style={styles.customerName} numberOfLines={1}>
          {order.customer_name || 'Guest'}
        </Text>
        <Text style={styles.orderMeta} numberOfLines={1}>
          {timeStr}
        </Text>
      </View>

      {/* Location Column (conditional) */}
      {showLocation && (
        <View style={styles.dataColumn}>
          <Text style={styles.dataLabel}>LOCATION</Text>
          <Text style={styles.dataValue} numberOfLines={1}>
            {order.pickup_location_name || 'Online'}
          </Text>
        </View>
      )}

      {/* Type Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>TYPE</Text>
        <Text style={styles.dataValue}>
          {orderType}
        </Text>
      </View>

      {/* Status Column - Apple-style badge */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>STATUS</Text>
        <Text
          style={[
            styles.dataValue,
            { color: getStatusColor(order.status) }
          ]}
        >
          {getStatusLabel(order.status)}
        </Text>
      </View>

      {/* Total Column */}
      <View style={styles.dataColumn}>
        <Text style={styles.dataLabel}>TOTAL</Text>
        <Text style={styles.dataValue}>
          ${order.total_amount.toFixed(2)}
        </Text>
      </View>
    </Pressable>
  )
})

OrderItem.displayName = 'OrderItem'

export { OrderItem }
