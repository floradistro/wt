/**
 * POSScannedOrderCard - Pickup Order Display for POS
 *
 * Shows when a pickup order QR code is scanned.
 * Monochrome theme matching the POS interface.
 */

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import {
  useScannedOrder,
  useScannedOrderUpdating,
  scannedOrderActions,
} from '@/stores/scanned-order.store'

// Status badge colors (monochrome variants)
const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: 'PENDING', bgColor: 'rgba(255,255,255,0.1)', textColor: 'rgba(255,255,255,0.6)' },
  preparing: { label: 'PREPARING', bgColor: 'rgba(255,200,100,0.2)', textColor: 'rgba(255,200,100,0.9)' },
  ready: { label: 'READY', bgColor: 'rgba(100,255,150,0.2)', textColor: 'rgba(100,255,150,0.9)' },
  ready_to_ship: { label: 'READY TO SHIP', bgColor: 'rgba(100,255,150,0.2)', textColor: 'rgba(100,255,150,0.9)' },
  shipped: { label: 'SHIPPED', bgColor: 'rgba(100,200,255,0.2)', textColor: 'rgba(100,200,255,0.9)' },
  in_transit: { label: 'IN TRANSIT', bgColor: 'rgba(100,200,255,0.2)', textColor: 'rgba(100,200,255,0.9)' },
  out_for_delivery: { label: 'OUT FOR DELIVERY', bgColor: 'rgba(100,200,255,0.2)', textColor: 'rgba(100,200,255,0.9)' },
  delivered: { label: 'DELIVERED', bgColor: 'rgba(100,255,150,0.2)', textColor: 'rgba(100,255,150,0.9)' },
  completed: { label: 'COMPLETED', bgColor: 'rgba(100,200,255,0.2)', textColor: 'rgba(100,200,255,0.9)' },
  cancelled: { label: 'CANCELLED', bgColor: 'rgba(255,100,100,0.2)', textColor: 'rgba(255,100,100,0.9)' },
}

export function POSScannedOrderCard() {
  const order = useScannedOrder()
  const updating = useScannedOrderUpdating()

  if (!order) return null

  const status = statusConfig[order.status] || statusConfig.pending
  const orderType = order.order_type?.toLowerCase() || 'pickup'
  const isPickup = orderType === 'pickup'
  const isShipping = orderType === 'shipping'
  const isDelivery = orderType === 'delivery'

  // Determine if order is in a final state
  const finalStates = ['completed', 'delivered', 'cancelled']
  const isFinished = finalStates.includes(order.status)
  const isCancelled = order.status === 'cancelled'

  // Get next action label based on order type and current status
  const getNextActionLabel = () => {
    if (isPickup) {
      if (order.status === 'pending' || order.status === 'preparing') return 'Mark Ready'
      if (order.status === 'ready') return 'Complete Pickup'
    }
    if (isShipping) {
      if (order.status === 'pending') return 'Start Preparing'
      if (order.status === 'preparing') return 'Ready to Ship'
      if (order.status === 'ready_to_ship') return 'Mark Shipped'
      if (order.status === 'shipped') return 'In Transit'
      if (order.status === 'in_transit') return 'Mark Delivered'
    }
    if (isDelivery) {
      if (order.status === 'pending' || order.status === 'preparing') return 'Out for Delivery'
      if (order.status === 'out_for_delivery') return 'Complete Delivery'
    }
    return 'Advance Status'
  }

  const handleAdvanceStatus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    scannedOrderActions.advanceStatus()
  }

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    scannedOrderActions.clearScannedOrder()
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Format payment display
  const getPaymentDisplay = () => {
    if (order.payment_status === 'paid') {
      if (order.card_last_four) {
        return `Paid •••• ${order.card_last_four}`
      }
      if (order.payment_method === 'cash') {
        return 'Paid Cash'
      }
      return 'Paid Online'
    }
    return order.payment_status?.toUpperCase() || 'PENDING'
  }

  const isPaid = order.payment_status === 'paid'

  return (
    <View style={styles.container}>
      {/* Header with Customer Name and Dismiss */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.customer_name || 'Guest'}
          </Text>
          <View style={styles.subHeaderRow}>
            <Text style={styles.orderNumber}>{order.order_number}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
              <Text style={[styles.statusText, { color: status.textColor }]}>{status.label}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissButton}
          activeOpacity={0.6}
        >
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Payment & Location Info */}
      <View style={styles.infoRow}>
        <View style={[styles.paymentBadge, isPaid && styles.paymentBadgePaid]}>
          <Text style={[styles.paymentText, isPaid && styles.paymentTextPaid]}>
            {getPaymentDisplay()}
          </Text>
        </View>
        {order.pickup_location_name && (
          <Text style={styles.locationText}>@ {order.pickup_location_name}</Text>
        )}
      </View>

      {/* Order Items */}
      <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemQuantity}>{item.quantity}×</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatCurrency(item.line_total)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(order.subtotal)}</Text>
        </View>
        {order.tax_amount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.tax_amount)}</Text>
          </View>
        )}
        {order.loyalty_points_redeemed > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.loyaltyText}>Points Redeemed</Text>
            <Text style={styles.loyaltyValue}>-{order.loyalty_points_redeemed}</Text>
          </View>
        )}
        <View style={styles.totalRowFinal}>
          <Text style={styles.totalLabelFinal}>Total</Text>
          <Text style={styles.totalValueFinal}>{formatCurrency(order.total)}</Text>
        </View>
        {order.loyalty_points_earned > 0 && (
          <View style={styles.loyaltyEarned}>
            <Text style={styles.loyaltyEarnedText}>+{order.loyalty_points_earned} pts earned</Text>
          </View>
        )}
      </View>

      {/* Order Date */}
      <Text style={styles.dateText}>{formatDate(order.created_at)}</Text>

      {/* Action Button */}
      {!isFinished && (
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          interactive
          style={[
            styles.actionButtonPrimary,
            !isLiquidGlassSupported && styles.actionButtonPrimaryFallback
          ]}
        >
          <TouchableOpacity
            onPress={handleAdvanceStatus}
            style={styles.actionButtonPressable}
            activeOpacity={0.7}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonTextPrimary}>{getNextActionLabel()}</Text>
            )}
          </TouchableOpacity>
        </LiquidGlassView>
      )}

      {/* Completed/Delivered State */}
      {isFinished && !isCancelled && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedText}>
            {order.status === 'delivered' ? 'Order Delivered' : 'Order Complete'}
          </Text>
        </View>
      )}

      {/* Cancelled State */}
      {isCancelled && (
        <View style={[styles.completedBanner, { backgroundColor: 'rgba(255,100,100,0.1)' }]}>
          <Text style={[styles.completedText, { color: 'rgba(255,100,100,0.9)' }]}>
            Order Cancelled
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(255,200,100,0.15)',
  },
  paymentBadgePaid: {
    backgroundColor: 'rgba(100,255,150,0.15)',
  },
  paymentText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,200,100,0.9)',
  },
  paymentTextPaid: {
    color: 'rgba(100,255,150,0.9)',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
  },

  // Items
  itemsContainer: {
    flex: 1,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQuantity: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    width: 28,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '400',
    color: '#fff',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 8,
  },

  // Totals
  totalsSection: {
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  totalLabelFinal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalValueFinal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  loyaltyText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(100,200,255,0.8)',
  },
  loyaltyValue: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.8)',
  },
  loyaltyEarned: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  loyaltyEarnedText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(100,255,150,0.8)',
  },

  // Date
  dateText: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 16,
  },

  // Actions
  actionsContainer: {
    gap: 10,
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 48,
  },
  actionButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionButtonPrimary: {
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 52,
  },
  actionButtonPrimaryFallback: {
    backgroundColor: 'rgba(100,255,150,0.15)',
  },
  actionButtonPressable: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  actionButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(100,255,150,0.95)',
  },

  // Completed
  completedBanner: {
    backgroundColor: 'rgba(100,200,255,0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completedText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(100,200,255,0.9)',
  },
})
