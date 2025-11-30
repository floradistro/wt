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
  order: Order             // Order data
  showLocation?: boolean   // Legacy - no longer used in Apple-style layout
  isLast: boolean          // Styling for last item (no border)
}

const OrderItem = React.memo<OrderItemProps>(({ order, isLast }) => {
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
      case 'ready':
      case 'ready_to_ship':
      case 'out_for_delivery':
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
      case 'confirmed':
        return 'Confirmed'
      case 'preparing':
        return 'Preparing'
      case 'packing':
        return 'Packing'
      case 'packed':
        return 'Packed'
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

  // Get customer initials for avatar
  const customerInitials = order.customer_name
    ? order.customer_name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'G'

  // ========================================
  // RENDER - Apple-style two-line layout
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
      {/* Avatar */}
      <View style={styles.orderIcon}>
        <View style={[styles.orderIconPlaceholder, styles.orderIconImage]}>
          <Text style={styles.orderIconText}>
            {customerInitials}
          </Text>
        </View>
      </View>

      {/* Content - Two lines */}
      <View style={styles.orderInfo}>
        {/* Line 1: Name + Total */}
        <View style={styles.orderLine}>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.customer_name || 'Guest'}
          </Text>
          <Text style={styles.orderTotal}>
            ${order.total_amount.toFixed(2)}
          </Text>
        </View>

        {/* Line 2: Time + Status */}
        <View style={styles.orderLine}>
          <Text style={styles.orderMeta} numberOfLines={1}>
            {timeStr}
          </Text>
          <Text style={[styles.orderStatus, { color: getStatusColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
})

OrderItem.displayName = 'OrderItem'

export { OrderItem }
