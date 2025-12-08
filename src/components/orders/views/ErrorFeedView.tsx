/**
 * ErrorFeedView Component
 * Live feed of failed e-commerce orders for proactive customer service
 * Shows full debug data: state_log, metadata, payment info
 */

import React, { useMemo, useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Linking,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useFilteredOrders } from '@/stores/order-filter.store'
import { useOrdersLoading, useOrdersActions } from '@/stores/orders.store'
import { useOrdersUIActions, useSelectedOrderId, useDateRange } from '@/stores/orders-ui.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { TitleSection } from '@/components/shared'
import { OrderFilterBar } from '@/components/orders/shared'
import type { Order } from '@/services/orders.service'

interface ErrorOrder {
  order: Order
  errorType: 'payment_failed' | 'cancelled' | 'error'
  errorReason: string
  timeAgo: string
  canContact: boolean
}

function formatTimestamp(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getTimeAgo(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getErrorInfo(order: Order): { type: ErrorOrder['errorType']; reason: string; color: string; icon: string } {
  // Check state_log for error details
  const stateLog = order.state_log || []
  const lastState = stateLog[stateLog.length - 1]

  if (order.payment_status === 'failed') {
    let reason = 'Payment declined or failed'

    // Check for specific payment data
    if (order.payment_data && typeof order.payment_data === 'object') {
      const pd = order.payment_data as any
      if (pd.error) reason = pd.error
      if (pd.decline_reason) reason = pd.decline_reason
      if (pd.message) reason = pd.message
    }

    return { type: 'payment_failed', reason, color: '#ff3b30', icon: 'card-outline' }
  }

  if (order.status === 'cancelled') {
    let reason = 'Order was cancelled'

    if (lastState) {
      if (lastState.from_payment_status === 'pending' && lastState.to_payment_status === 'failed') {
        reason = 'Cancelled due to payment failure'
      }
    }

    if (order.internal_notes) {
      reason = order.internal_notes
    }

    return { type: 'cancelled', reason, color: '#ff9500', icon: 'close-circle-outline' }
  }

  return { type: 'error', reason: 'Unknown error', color: '#ff3b30', icon: 'warning-outline' }
}

interface ErrorItemProps {
  item: ErrorOrder
  isExpanded: boolean
  onPress: () => void
  onContact: (type: 'phone' | 'email') => void
}

const ErrorItem = React.memo<ErrorItemProps>(({ item, isExpanded, onPress, onContact }) => {
  const { order, errorType, errorReason, timeAgo, canContact } = item
  const errorInfo = getErrorInfo(order)

  const customerInitials = order.customer_name
    ? order.customer_name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const hasPhone = !!order.customer_phone
  const hasEmail = !!order.customer_email

  // Parse state log
  const stateLog = order.state_log || []
  const metadata = order.metadata || {}

  return (
    <Pressable
      style={[
        styles.errorItem,
        { borderLeftColor: errorInfo.color },
        isExpanded && styles.errorItemExpanded,
      ]}
      onPress={onPress}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.itemLeft}>
          <View style={[styles.avatar, { backgroundColor: `${errorInfo.color}20` }]}>
            <Text style={[styles.avatarText, { color: errorInfo.color }]}>
              {customerInitials}
            </Text>
          </View>

          <View style={styles.itemInfo}>
            <View style={styles.itemTopRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {order.customer_name || 'Unknown Customer'}
              </Text>
              <View style={[styles.errorBadge, { backgroundColor: `${errorInfo.color}20` }]}>
                <Ionicons name={errorInfo.icon as any} size={12} color={errorInfo.color} />
                <Text style={[styles.errorBadgeText, { color: errorInfo.color }]}>
                  {errorType === 'payment_failed' ? 'Payment Failed' : 'Cancelled'}
                </Text>
              </View>
            </View>

            <View style={styles.itemMiddleRow}>
              <Text style={styles.orderNumber}>#{order.order_number}</Text>
              <Text style={styles.amount}>${order.total_amount?.toFixed(2) || '0.00'}</Text>
            </View>

            <Text style={styles.errorReason} numberOfLines={isExpanded ? undefined : 1}>
              {errorReason}
            </Text>
          </View>
        </View>

        {/* Contact Buttons */}
        {canContact && (
          <View style={styles.contactButtons}>
            {hasPhone && (
              <Pressable
                style={styles.contactButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onContact('phone')
                }}
              >
                <Ionicons name="call" size={18} color="#34c759" />
              </Pressable>
            )}
            {hasEmail && (
              <Pressable
                style={styles.contactButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onContact('email')
                }}
              >
                <Ionicons name="mail" size={18} color="#0a84ff" />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Expanded Debug Info */}
      {isExpanded && (
        <View style={styles.debugSection}>
          <Text style={styles.debugSectionTitle}>Debug Information</Text>

          {/* Time & IDs */}
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Created:</Text>
            <Text style={styles.debugValue}>{formatTimestamp(order.created_at)}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Order ID:</Text>
            <Text style={styles.debugValueMono}>{order.id}</Text>
          </View>
          {order.customer_id && (
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Customer ID:</Text>
              <Text style={styles.debugValueMono}>{order.customer_id}</Text>
            </View>
          )}

          {/* Contact Info */}
          <Text style={[styles.debugSectionTitle, { marginTop: spacing.md }]}>Contact</Text>
          {order.customer_email && (
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Email:</Text>
              <Text style={styles.debugValue}>{order.customer_email}</Text>
            </View>
          )}
          {order.customer_phone && (
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Phone:</Text>
              <Text style={styles.debugValue}>{order.customer_phone}</Text>
            </View>
          )}

          {/* Payment Info */}
          <Text style={[styles.debugSectionTitle, { marginTop: spacing.md }]}>Payment</Text>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Method:</Text>
            <Text style={styles.debugValue}>{order.payment_method || 'Unknown'}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Status:</Text>
            <Text style={[styles.debugValue, { color: order.payment_status === 'failed' ? '#ff3b30' : '#fff' }]}>
              {order.payment_status}
            </Text>
          </View>
          {order.card_type && (
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Card:</Text>
              <Text style={styles.debugValue}>{order.card_type} ****{order.card_last_four}</Text>
            </View>
          )}
          {order.transaction_id && (
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Transaction ID:</Text>
              <Text style={styles.debugValueMono}>{order.transaction_id}</Text>
            </View>
          )}
          {order.processor_transaction_id && (
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>Processor TX:</Text>
              <Text style={styles.debugValueMono}>{order.processor_transaction_id}</Text>
            </View>
          )}

          {/* Metadata */}
          {Object.keys(metadata).length > 0 && (
            <>
              <Text style={[styles.debugSectionTitle, { marginTop: spacing.md }]}>Metadata</Text>
              {Object.entries(metadata).map(([key, value]) => (
                <View key={key} style={styles.debugRow}>
                  <Text style={styles.debugLabel}>{key}:</Text>
                  <Text style={styles.debugValueMono} numberOfLines={1}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value || 'null')}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* State Log */}
          {stateLog.length > 0 && (
            <>
              <Text style={[styles.debugSectionTitle, { marginTop: spacing.md }]}>State History</Text>
              {stateLog.map((entry: any, idx: number) => (
                <View key={idx} style={styles.stateLogEntry}>
                  <Text style={styles.stateLogTime}>
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
                    })}
                  </Text>
                  <View style={styles.stateLogDetails}>
                    <Text style={styles.stateLogText}>
                      {entry.from_status} → {entry.to_status}
                    </Text>
                    {entry.from_payment_status !== entry.to_payment_status && (
                      <Text style={styles.stateLogPayment}>
                        Payment: {entry.from_payment_status} → {entry.to_payment_status}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Order Details */}
          <Text style={[styles.debugSectionTitle, { marginTop: spacing.md }]}>Order Details</Text>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Type:</Text>
            <Text style={styles.debugValue}>{order.order_type}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Subtotal:</Text>
            <Text style={styles.debugValue}>${order.subtotal?.toFixed(2)}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Tax:</Text>
            <Text style={styles.debugValue}>${order.tax_amount?.toFixed(2)}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Total:</Text>
            <Text style={styles.debugValue}>${order.total_amount?.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {/* Expand/Collapse Indicator */}
      <View style={styles.expandIndicator}>
        <Text style={styles.timeAgo}>{timeAgo}</Text>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="rgba(255,255,255,0.4)"
        />
      </View>
    </Pressable>
  )
})

ErrorItem.displayName = 'ErrorItem'

export function ErrorFeedView() {
  const { vendor } = useAppAuth()
  const orders = useFilteredOrders() // Now uses date filter from store
  const loading = useOrdersLoading()
  const { refreshOrders } = useOrdersActions()
  const selectedOrderId = useSelectedOrderId()
  const { selectOrder } = useOrdersUIActions()
  const dateRange = useDateRange()

  // Track expanded items
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }, [])

  // Filter for error orders (payment failed, cancelled e-commerce)
  const errorOrders = useMemo(() => {
    const errors: ErrorOrder[] = []

    orders.forEach(order => {
      // Only e-commerce orders (not walk-in POS)
      if (order.order_type === 'walk_in') return

      const errorInfo = getErrorInfo(order)

      // Payment failed or cancelled
      if (order.payment_status === 'failed' || order.status === 'cancelled') {
        errors.push({
          order,
          errorType: errorInfo.type,
          errorReason: errorInfo.reason,
          timeAgo: getTimeAgo(order.created_at),
          canContact: !!(order.customer_phone || order.customer_email),
        })
      }
    })

    // Sort by most recent first
    return errors.sort((a, b) =>
      new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime()
    )
  }, [orders])

  // Stats
  const stats = useMemo(() => {
    const paymentFailed = errorOrders.filter(e => e.errorType === 'payment_failed').length
    const cancelled = errorOrders.filter(e => e.errorType === 'cancelled').length
    return { paymentFailed, cancelled, total: errorOrders.length }
  }, [errorOrders])

  // Handlers
  const handleContact = useCallback((order: Order, type: 'phone' | 'email') => {
    if (type === 'phone' && order.customer_phone) {
      const phone = order.customer_phone.replace(/\D/g, '')
      Linking.openURL(`tel:${phone}`)
    } else if (type === 'email' && order.customer_email) {
      const subject = encodeURIComponent(`Regarding your order #${order.order_number}`)
      const body = encodeURIComponent(
        `Hi ${order.customer_name || 'there'},\n\nI noticed there was an issue with your recent order #${order.order_number}. I wanted to reach out to help resolve this for you.\n\nPlease let me know how I can assist!\n\nBest regards`
      )
      Linking.openURL(`mailto:${order.customer_email}?subject=${subject}&body=${body}`)
    }
  }, [])

  // Render
  const renderItem = useCallback(({ item }: { item: ErrorOrder }) => (
    <ErrorItem
      item={item}
      isExpanded={expandedIds.has(item.order.id)}
      onPress={() => toggleExpanded(item.order.id)}
      onContact={(type) => handleContact(item.order, type)}
    />
  ), [expandedIds, toggleExpanded, handleContact])

  const keyExtractor = useCallback((item: ErrorOrder) => item.order.id, [])

  const subtitle = stats.total > 0
    ? `${stats.paymentFailed} payment failures • ${stats.cancelled} cancelled`
    : 'No issues detected'

  const ListHeader = useMemo(() => (
    <>
      <TitleSection
        title="Error Feed"
        logo={vendor?.logo_url}
        subtitle={subtitle}
        hideButton
      />
      <OrderFilterBar showLocationFilter={false} />
    </>
  ), [vendor?.logo_url, subtitle])

  // Empty state
  if (!loading && errorOrders.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeader}
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkmark-circle" size={48} color="#34c759" />
          </View>
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptyText}>
            No payment failures or issues{'\n'}
            {dateRange === 'today' ? 'today' : dateRange === 'week' ? 'this week' : dateRange === 'month' ? 'this month' : ''}.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <FlatList
      data={errorOrders}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeader}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={true}
      indicatorStyle="white"
      scrollIndicatorInsets={{ right: 2, top: 0, bottom: layout.dockHeight }}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refreshOrders}
          tintColor="rgba(255,255,255,0.5)"
        />
      }
      maxToRenderPerBatch={10}
      initialNumToRender={15}
      windowSize={5}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: layout.dockHeight,
  },

  // Error Item
  errorItem: {
    marginHorizontal: layout.containerMargin,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    borderLeftWidth: 3,
  },
  errorItemExpanded: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemInfo: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  errorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  errorReason: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontStyle: 'italic',
  },

  // Contact Buttons
  contactButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  contactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Expand Indicator
  expandIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  timeAgo: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },

  // Debug Section
  debugSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  debugSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    width: 100,
  },
  debugValue: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  debugValueMono: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },

  // State Log
  stateLogEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingLeft: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    marginLeft: 4,
    marginBottom: 4,
  },
  stateLogTime: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    width: 90,
  },
  stateLogDetails: {
    flex: 1,
  },
  stateLogText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  stateLogPayment: {
    fontSize: 11,
    color: '#ff9500',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(52,199,89,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
})
