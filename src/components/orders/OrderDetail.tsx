/**
 * Order Detail Component
 * Comprehensive order management with Apple-quality UX
 * Handles all order types: walk_in, pickup, delivery, shipping
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native'
import { useState, useEffect } from 'react'
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

export function OrderDetail({ order, onBack, onOrderUpdated }: OrderDetailProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  // Load order items
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

  // Status transition with timestamps
  const handleStatusUpdate = async (newStatus: Order['status']) => {
    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const now = new Date().toISOString()
      const updates: any = { status: newStatus, updated_at: now }

      // Set appropriate timestamps based on status
      switch (newStatus) {
        case 'preparing':
          updates.prepared_at = now
          break
        case 'ready':
          updates.ready_at = now
          updates.notified_at = now // Auto-notify customer
          break
        case 'out_for_delivery':
          updates.ready_at = now
          break
        case 'completed':
          updates.completed_at = now
          break
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', order.id)

      if (error) throw error

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onOrderUpdated()
    } catch (error) {
      logger.error('Failed to update order status:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to update order status')
    } finally {
      setIsUpdating(false)
    }
  }

  // Customer contact actions
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

  // Get order type display
  const getOrderType = () => {
    const type = order.order_type || order.delivery_type || 'walk_in'
    switch (type.toLowerCase()) {
      case 'walk_in':
      case 'instore':
        return { label: 'Walk-in', icon: '🏪', color: '#34c759' }
      case 'pickup':
        return { label: 'Pickup', icon: '📦', color: '#0a84ff' }
      case 'delivery':
        return { label: 'Delivery', icon: '🚗', color: '#ff9500' }
      case 'shipping':
        return { label: 'Shipping', icon: '📮', color: '#bf5af2' }
      default:
        return { label: 'Store', icon: '🏪', color: '#8e8e93' }
    }
  }

  // Get status color
  const getStatusColor = () => {
    switch (order.status) {
      case 'completed':
        return '#34c759'
      case 'preparing':
        return '#0a84ff'
      case 'ready':
      case 'out_for_delivery':
        return '#bf5af2'
      case 'pending':
        return '#ff9500'
      default:
        return '#8e8e93'
    }
  }

  // Get action buttons based on order type and status
  const getActionButtons = () => {
    // Walk-in orders don't need actions (auto-completed)
    if (order.order_type === 'walk_in' && order.status === 'completed') {
      return null
    }

    const buttons = []

    switch (order.status) {
      case 'pending':
        buttons.push({
          label: 'Start Preparing',
          action: () => handleStatusUpdate('preparing'),
          primary: true,
        })
        break

      case 'preparing':
        if (order.order_type === 'pickup') {
          buttons.push({
            label: 'Mark as Ready for Pickup',
            action: () => handleStatusUpdate('ready'),
            primary: true,
          })
        } else if (order.order_type === 'delivery') {
          buttons.push({
            label: 'Out for Delivery',
            action: () => handleStatusUpdate('out_for_delivery'),
            primary: true,
          })
        }
        break

      case 'ready':
        buttons.push({
          label: 'Complete Pickup',
          action: () => handleStatusUpdate('completed'),
          primary: true,
        })
        break

      case 'out_for_delivery':
        buttons.push({
          label: 'Mark as Delivered',
          action: () => handleStatusUpdate('completed'),
          primary: true,
        })
        break
    }

    return buttons
  }

  const orderType = getOrderType()
  const actionButtons = getActionButtons()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text.secondary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Orders</Text>
        </Pressable>
      </View>

      {/* Order Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerCardInner}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>
              {order.customer_name
                ? order.customer_name
                    .split(' ')
                    .map(n => n.charAt(0))
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'G'}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{order.customer_name || 'Guest'}</Text>
            <View style={styles.headerMeta}>
              <Text style={styles.headerMetaText}>{order.order_number}</Text>
              <Text style={styles.headerDot}>•</Text>
              <Text style={[styles.headerMetaText, { color: orderType.color }]}>
                {orderType.icon} {orderType.label}
              </Text>
              <Text style={styles.headerDot}>•</Text>
              <Text style={[styles.headerMetaText, { color: getStatusColor() }]}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Text>
            </View>
            <Text style={styles.headerTime}>
              {new Date(order.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })} at {new Date(order.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      {actionButtons && actionButtons.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.actionsCard}>
            {actionButtons.map((button, index) => (
              <Pressable
                key={index}
                style={[styles.actionButton, button.primary && styles.actionButtonPrimary]}
                onPress={button.action}
                disabled={isUpdating}
              >
                <Text style={[styles.actionButtonText, button.primary && styles.actionButtonTextPrimary]}>
                  {isUpdating ? 'Updating...' : button.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Customer Info & Contact */}
      {(order.customer_email || order.customer_phone) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CUSTOMER</Text>
          <View style={styles.card}>
            {order.customer_phone && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Phone</Text>
                <View style={styles.rowActions}>
                  <Text style={styles.rowValue}>{order.customer_phone}</Text>
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
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Email</Text>
                <View style={styles.rowActions}>
                  <Text style={styles.rowValue}>{order.customer_email}</Text>
                  <Pressable style={styles.contactButton} onPress={handleEmail}>
                    <Text style={styles.contactButtonText}>Email</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ITEMS ({orderItems.length})</Text>
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

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SUMMARY</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Subtotal</Text>
            <Text style={styles.rowValue}>${order.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tax</Text>
            <Text style={styles.rowValue}>${order.tax_amount.toFixed(2)}</Text>
          </View>
          {order.discount_amount > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Discount</Text>
              <Text style={styles.rowValue}>-${order.discount_amount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Order Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TIMELINE</Text>
        <View style={styles.card}>
          <TimelineItem
            label="Order Placed"
            time={order.created_at}
            completed={true}
          />
          {order.prepared_at && (
            <TimelineItem
              label="Started Preparing"
              time={order.prepared_at}
              completed={true}
            />
          )}
          {order.ready_at && (
            <TimelineItem
              label={order.order_type === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup'}
              time={order.ready_at}
              completed={true}
            />
          )}
          {order.notified_at && (
            <TimelineItem
              label="Customer Notified"
              time={order.notified_at}
              completed={true}
            />
          )}
          {order.completed_at && (
            <TimelineItem
              label="Completed"
              time={order.completed_at}
              completed={true}
            />
          )}
        </View>
      </View>
    </ScrollView>
  )
}

// Timeline Item Component
function TimelineItem({ label, time, completed }: { label: string; time: string; completed: boolean }) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineDot, completed && styles.timelineDotCompleted]} />
      <View style={styles.timelineContent}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineTime}>
          {new Date(time).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    paddingBottom: 12,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 17,
    color: '#60A5FA',
    fontWeight: '600',
  },

  // Header Card
  headerCard: {
    marginHorizontal: layout.contentHorizontal,
    marginBottom: 20,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: layout.cardPadding,
  },
  headerCardInner: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.6)',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerMetaText: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '500',
  },
  headerDot: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.3)',
  },
  headerTime: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.5)',
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: layout.contentHorizontal,
  },

  // Cards
  card: {
    marginHorizontal: layout.contentHorizontal,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: layout.cardPadding,
  },
  actionsCard: {
    marginHorizontal: layout.contentHorizontal,
    gap: 10,
  },

  // Action Buttons
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#60A5FA',
    borderColor: '#60A5FA',
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.3,
  },
  actionButtonTextPrimary: {
    color: '#fff',
  },

  // Rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  rowLabel: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },

  // Contact Buttons
  contactButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(96,165,250,0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(96,165,250,0.3)',
  },
  contactButtonText: {
    fontSize: 13,
    color: '#60A5FA',
    fontWeight: '600',
  },

  // Items
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
  },
  itemPrice: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '700',
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },
  timelineDotCompleted: {
    backgroundColor: '#34c759',
  },
  timelineContent: {
    flex: 1,
    gap: 2,
  },
  timelineLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  timelineTime: {
    fontSize: 13,
    color: 'rgba(235,235,245,0.6)',
  },
})
