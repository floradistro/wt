/**
 * OrderInfoPanel - Comprehensive order information display
 * Shows ALL relevant data: source, staff attribution, timeline, tracking, etc.
 */

import React, { useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { useAppAuth } from '@/contexts/AppAuthContext'
import type { Order } from '@/services/orders.service'

// Extended order type for fields that exist in DB but not in TS type
type ExtendedOrder = Order & {
  metadata?: Record<string, any>
  customer_ip_address?: string
  customer_user_agent?: string
  created_by_user_id?: string
  employee_id?: string
  cancelled_date?: string
  card_type?: string
  card_last_four?: string
  transaction_id?: string
  processor_transaction_id?: string
  payment_authorization_code?: string
  split_payment_cash?: number
  split_payment_card?: number
  idempotency_key?: string
  state_log?: Array<{
    timestamp: string
    from_status?: string
    to_status: string
    from_payment_status?: string
    to_payment_status?: string
  }>
  customer_note?: string
  internal_notes?: string
}

interface OrderInfoPanelProps {
  order: Order
  defaultExpanded?: boolean
}

interface InfoSection {
  title: string
  icon: string
  items: Array<{ label: string; value: string | null; copyable?: boolean; highlight?: boolean; color?: string }>
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function formatShortDate(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export function OrderInfoPanel({ order: rawOrder, defaultExpanded = false }: OrderInfoPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const { locations } = useAppAuth()

  // Cast to extended order type for accessing fields that exist in DB
  const order = rawOrder as ExtendedOrder

  // Helper to get user name from ID
  // Note: For now returns created_by_user if available, otherwise truncated ID
  const getUserName = (userId: string | null | undefined): string | null => {
    if (!userId) return null
    // If this matches created_by_user, use that name
    if (order.created_by_user && order.created_by_user_id === userId) {
      const u = order.created_by_user as { first_name?: string; last_name?: string; email?: string }
      return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || userId.slice(0, 8) + '...'
    }
    return userId.slice(0, 8) + '...'
  }

  // Helper to get location name from ID
  const getLocationName = (locationId: string | null | undefined): string | null => {
    if (!locationId) return null
    const location = locations?.find(l => l.id === locationId)
    return location?.name || locationId.slice(0, 8) + '...'
  }

  // Determine order source
  const getOrderSource = (): { label: string; detail: string } => {
    const metadata = order.metadata || {}

    if (order.order_type === 'walk_in') {
      const registerId = metadata.register_id
      const location = getLocationName(order.pickup_location_id)
      return {
        label: 'POS / In-Store',
        detail: location ? `${location}${registerId ? ' • Register' : ''}` : 'Walk-in sale'
      }
    }

    if (order.order_type === 'pickup') {
      return {
        label: 'Online - Store Pickup',
        detail: getLocationName(order.pickup_location_id) || 'Customer pickup'
      }
    }

    if (order.order_type === 'shipping') {
      return {
        label: 'Online - Shipping',
        detail: order.shipping_service || 'E-commerce order'
      }
    }

    return { label: order.order_type || 'Unknown', detail: '' }
  }

  const orderSource = getOrderSource()

  // Build sections
  const sections = useMemo((): InfoSection[] => {
    const result: InfoSection[] = []
    const metadata = order.metadata || {}

    // SOURCE & ORIGIN
    result.push({
      title: 'Source',
      icon: 'globe-outline',
      items: [
        { label: 'Channel', value: orderSource.label, highlight: true },
        { label: 'Detail', value: orderSource.detail },
        order.pickup_location_id ? { label: 'Location', value: getLocationName(order.pickup_location_id) } : null,
        metadata.register_id ? { label: 'Register', value: metadata.register_id.slice(0, 8) + '...' } : null,
        metadata.session_id ? { label: 'Session', value: metadata.session_id.slice(0, 8) + '...', copyable: true } : null,
        order.customer_ip_address ? { label: 'IP Address', value: order.customer_ip_address } : null,
        order.customer_user_agent ? { label: 'Device', value: order.customer_user_agent.slice(0, 40) + '...' } : null,
      ].filter(Boolean) as InfoSection['items']
    })

    // STAFF ATTRIBUTION
    const staffItems: InfoSection['items'] = []

    // Created by
    const createdBy = getUserName(order.created_by_user_id) || getUserName(order.employee_id)
    if (createdBy) {
      staffItems.push({ label: 'Created by', value: createdBy, highlight: true })
    }

    // Prepared by
    if (order.prepared_by_user_id) {
      staffItems.push({
        label: 'Prepared by',
        value: `${getUserName(order.prepared_by_user_id)} • ${formatShortDate(order.prepared_at)}`,
        color: '#34c759'
      })
    }

    // Shipped by
    if (order.shipped_by_user_id) {
      staffItems.push({
        label: 'Shipped by',
        value: `${getUserName(order.shipped_by_user_id)} • ${formatShortDate(order.shipped_at)}`,
        color: '#0a84ff'
      })
    }

    // Delivered by
    if (order.delivered_by_user_id) {
      staffItems.push({
        label: 'Delivered by',
        value: `${getUserName(order.delivered_by_user_id)} • ${formatShortDate(order.delivered_at)}`,
        color: '#34c759'
      })
    }

    if (staffItems.length > 0) {
      result.push({
        title: 'Staff',
        icon: 'people-outline',
        items: staffItems
      })
    }

    // LOCATIONS - Show all fulfillment locations
    const locationItems: InfoSection['items'] = []

    // Primary pickup location
    if (order.pickup_location_id) {
      const locName = order.pickup_location_name || getLocationName(order.pickup_location_id)
      locationItems.push({
        label: 'Primary Location',
        value: locName || order.pickup_location_id.slice(0, 8) + '...',
        highlight: true
      })
    }

    // Multi-location fulfillment
    const fulfillmentLocations = order.fulfillment_locations
    if (fulfillmentLocations && fulfillmentLocations.length > 0) {
      // Show location count summary
      if (fulfillmentLocations.length > 1) {
        locationItems.push({
          label: 'Split Order',
          value: `${fulfillmentLocations.length} locations`,
          color: '#ff9500'
        })
      }

      // Show each fulfillment location
      fulfillmentLocations.forEach((loc, idx) => {
        const statusColor = loc.fulfillment_status === 'fulfilled' ? '#34c759'
          : loc.fulfillment_status === 'shipped' ? '#0a84ff'
          : loc.fulfillment_status === 'partial' ? '#ff9500'
          : 'rgba(255,255,255,0.6)'

        const statusLabel = loc.fulfillment_status === 'fulfilled' ? '✓ Fulfilled'
          : loc.fulfillment_status === 'shipped' ? '📦 Shipped'
          : loc.fulfillment_status === 'partial' ? 'Partial'
          : 'Pending'

        // Use item_count or total_quantity - check for actual positive values
        const itemCount = (loc.item_count && loc.item_count > 0)
          ? loc.item_count
          : (loc.total_quantity && loc.total_quantity > 0)
            ? loc.total_quantity
            : null

        locationItems.push({
          label: loc.location_name || `Location ${idx + 1}`,
          value: itemCount ? `${itemCount} item${itemCount !== 1 ? 's' : ''} • ${statusLabel}` : statusLabel,
          color: statusColor
        })

        // Per-location tracking if shipped
        if (loc.tracking_number) {
          locationItems.push({
            label: `  └ Tracking`,
            value: loc.tracking_number,
            copyable: true
          })
        }
        if (loc.shipped_at) {
          locationItems.push({
            label: `  └ Shipped`,
            value: formatShortDate(loc.shipped_at)
          })
        }
      })
    }

    // Always show locations section if we have any location data
    if (locationItems.length > 0) {
      result.push({
        title: 'Locations',
        icon: 'location-outline',
        items: locationItems
      })
    }

    // TIMELINE
    const timelineItems: InfoSection['items'] = [
      { label: 'Created', value: formatDate(order.created_at), highlight: true },
    ]

    if (order.prepared_at) timelineItems.push({ label: 'Prepared', value: formatDate(order.prepared_at) })
    if (order.ready_at) timelineItems.push({ label: 'Ready', value: formatDate(order.ready_at) })
    if (order.notified_at) timelineItems.push({ label: 'Customer Notified', value: formatDate(order.notified_at) })
    if (order.picked_up_at) timelineItems.push({ label: 'Picked Up', value: formatDate(order.picked_up_at), color: '#34c759' })
    if (order.shipped_at) timelineItems.push({ label: 'Shipped', value: formatDate(order.shipped_at), color: '#0a84ff' })
    if (order.delivered_at) timelineItems.push({ label: 'Delivered', value: formatDate(order.delivered_at), color: '#34c759' })
    if (order.completed_at) timelineItems.push({ label: 'Completed', value: formatDate(order.completed_at), color: '#34c759' })
    if (order.cancelled_date) timelineItems.push({ label: 'Cancelled', value: formatDate(order.cancelled_date), color: '#ff3b30' })

    result.push({
      title: 'Timeline',
      icon: 'time-outline',
      items: timelineItems
    })

    // PAYMENT
    result.push({
      title: 'Payment',
      icon: 'card-outline',
      items: [
        { label: 'Method', value: order.payment_method || 'Unknown', highlight: true },
        { label: 'Status', value: order.payment_status, color: order.payment_status === 'paid' ? '#34c759' : order.payment_status === 'failed' ? '#ff3b30' : '#ff9500' },
        order.card_type ? { label: 'Card', value: `${order.card_type} ****${order.card_last_four}` } : null,
        order.transaction_id ? { label: 'Transaction', value: order.transaction_id, copyable: true } : null,
        order.processor_transaction_id ? { label: 'Processor TX', value: order.processor_transaction_id, copyable: true } : null,
        order.payment_authorization_code ? { label: 'Auth Code', value: order.payment_authorization_code } : null,
        order.split_payment_cash ? { label: 'Split - Cash', value: `$${order.split_payment_cash.toFixed(2)}` } : null,
        order.split_payment_card ? { label: 'Split - Card', value: `$${order.split_payment_card.toFixed(2)}` } : null,
      ].filter(Boolean) as InfoSection['items']
    })

    // SHIPPING (if applicable)
    if (order.order_type === 'shipping' || order.tracking_number) {
      result.push({
        title: 'Shipping',
        icon: 'airplane-outline',
        items: [
          order.shipping_carrier ? { label: 'Carrier', value: order.shipping_carrier, highlight: true } : null,
          order.shipping_service ? { label: 'Service', value: order.shipping_service } : null,
          order.tracking_number ? { label: 'Tracking #', value: order.tracking_number, copyable: true } : null,
          order.estimated_delivery_date ? { label: 'Est. Delivery', value: formatDate(order.estimated_delivery_date) } : null,
          order.shipping_cost ? { label: 'Cost', value: `$${order.shipping_cost.toFixed(2)}` } : null,
          order.postage_paid ? { label: 'Postage', value: `$${order.postage_paid.toFixed(2)}` } : null,
          order.package_weight ? { label: 'Weight', value: `${order.package_weight} lbs` } : null,
        ].filter(Boolean) as InfoSection['items']
      })
    }

    // CUSTOMER
    result.push({
      title: 'Customer',
      icon: 'person-outline',
      items: [
        { label: 'Name', value: order.customer_name || 'Guest', highlight: true },
        order.customer_email ? { label: 'Email', value: order.customer_email, copyable: true } : null,
        order.customer_phone ? { label: 'Phone', value: order.customer_phone, copyable: true } : null,
        order.customer_id ? { label: 'Customer ID', value: order.customer_id.slice(0, 8) + '...', copyable: true } : null,
      ].filter(Boolean) as InfoSection['items']
    })

    // SHIPPING ADDRESS (if applicable)
    if (order.shipping_address_line1 || order.shipping_city) {
      const addressParts = [
        order.shipping_name,
        order.shipping_address_line1,
        order.shipping_address_line2,
        [order.shipping_city, order.shipping_state, order.shipping_zip].filter(Boolean).join(', '),
      ].filter(Boolean)

      result.push({
        title: 'Shipping Address',
        icon: 'location-outline',
        items: [
          { label: 'Address', value: addressParts.join('\n'), highlight: true },
          order.shipping_phone ? { label: 'Phone', value: order.shipping_phone } : null,
        ].filter(Boolean) as InfoSection['items']
      })
    }

    // IDs & TECHNICAL
    result.push({
      title: 'Technical',
      icon: 'code-outline',
      items: [
        { label: 'Order ID', value: order.id, copyable: true },
        { label: 'Order #', value: order.order_number, copyable: true },
        order.idempotency_key ? { label: 'Idempotency', value: order.idempotency_key.slice(0, 20) + '...', copyable: true } : null,
        { label: 'Vendor ID', value: order.vendor_id?.slice(0, 8) + '...' },
        { label: 'Updated', value: formatDate(order.updated_at) },
      ].filter(Boolean) as InfoSection['items']
    })

    // STATE LOG
    const stateLog = order.state_log
    if (stateLog && stateLog.length > 0) {
      result.push({
        title: 'State History',
        icon: 'git-branch-outline',
        items: stateLog.map((entry: any, idx: number) => ({
          label: formatShortDate(entry.timestamp),
          value: `${entry.from_status || '—'} → ${entry.to_status}${entry.from_payment_status !== entry.to_payment_status ? ` (payment: ${entry.to_payment_status})` : ''}`,
          highlight: idx === stateLog.length - 1
        }))
      })
    }

    // NOTES
    const notes = [order.customer_note, order.internal_notes, order.staff_notes].filter(Boolean)
    if (notes.length > 0) {
      result.push({
        title: 'Notes',
        icon: 'document-text-outline',
        items: [
          order.customer_note ? { label: 'Customer', value: order.customer_note } : null,
          order.internal_notes ? { label: 'Internal', value: order.internal_notes } : null,
          order.staff_notes ? { label: 'Staff', value: order.staff_notes } : null,
        ].filter(Boolean) as InfoSection['items']
      })
    }

    return result
  }, [order, locations])

  const handleCopy = async (value: string) => {
    // Simple feedback - in production you'd use expo-clipboard
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsExpanded(prev => !prev)
  }

  return (
    <View style={styles.container}>
      {/* Header - Always Visible */}
      <Pressable style={styles.header} onPress={toggleExpanded}>
        <View style={styles.headerLeft}>
          <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
          <Text style={styles.headerTitle}>Order Details</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{orderSource.label}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="rgba(255,255,255,0.4)"
          />
        </View>
      </Pressable>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.content}>
          {sections.map((section, sectionIdx) => (
            <View key={section.title} style={[styles.section, sectionIdx > 0 && styles.sectionBorder]}>
              <View style={styles.sectionHeader}>
                <Ionicons name={section.icon as any} size={16} color="rgba(255,255,255,0.5)" />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              {section.items.map((item, itemIdx) => (
                <View key={`${section.title}-${itemIdx}`} style={styles.row}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <View style={styles.rowValueContainer}>
                    <Text
                      style={[
                        styles.rowValue,
                        item.highlight && styles.rowValueHighlight,
                        item.color && { color: item.color }
                      ]}
                      numberOfLines={item.label === 'Address' ? 4 : 2}
                    >
                      {item.value || '—'}
                    </Text>
                    {item.copyable && item.value && (
                      <Pressable
                        style={styles.copyButton}
                        onPress={() => handleCopy(item.value!)}
                        hitSlop={8}
                      >
                        <Ionicons name="copy-outline" size={14} color="rgba(255,255,255,0.4)" />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceBadge: {
    backgroundColor: 'rgba(10,132,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a84ff',
  },
  content: {
    padding: spacing.md,
    paddingTop: 0,
  },
  section: {
    paddingVertical: spacing.sm,
  },
  sectionBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingLeft: 22,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    width: 100,
    flexShrink: 0,
  },
  rowValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    flex: 1,
  },
  rowValueHighlight: {
    color: '#fff',
    fontWeight: '600',
  },
  copyButton: {
    padding: 2,
  },
})
