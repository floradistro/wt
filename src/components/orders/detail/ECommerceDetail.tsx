/**
 * ECommerceDetail Component - CLEAN & STRUCTURED
 *
 * Design:
 * - Each location = its own card section
 * - Card header with location name + action button
 * - Items inside the card
 * - Two colors: Green = done, White = action
 * - Clear visual separation
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native'
import { useState, useEffect, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import { deleteOrder, type Order } from '@/services/orders.service'
import { ordersService, type OrderItem } from '@/services/orders.service'
import { useOrders, useOrdersStore, useOrdersActions } from '@/stores/orders.store'
import { useSelectedOrderId, useOrdersUIActions, useLastShipmentAt } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { MarkDeliveredModal } from '../modals'

interface LocationGroup {
  locationId: string | null
  locationName: string
  items: OrderItem[]
  allFulfilled: boolean
  fulfillmentType: 'pickup' | 'shipping' | 'unknown'
  shippedAt?: string
  trackingNumber?: string
}

export function ECommerceDetail() {
  const selectedOrderId = useSelectedOrderId()
  const orders = useOrders()
  const order = orders.find(o => o.id === selectedOrderId)
  const { selectOrder, openShipModal } = useOrdersUIActions()
  const { refreshOrders } = useOrdersActions()
  const { selectedLocationIds } = useLocationFilter()
  const lastShipmentAt = useLastShipmentAt()

  const [showDeliveredModal, setShowDeliveredModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isFulfilling, setIsFulfilling] = useState<string | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [locationShipments, setLocationShipments] = useState<Record<string, { shippedAt?: string; trackingNumber?: string }>>({})

  // Load order items and shipments
  // Reload when order changes (id, status, or updated_at) or lastShipmentAt changes
  useEffect(() => {
    if (!order) return
    const loadItems = async () => {
      try {
        setLoadingItems(true)
        const fullOrder = await ordersService.getOrderById(order.id)
        setOrderItems(fullOrder.items || [])
        const shipments = await ordersService.getOrderShipments(order.id)
        const shipmentMap: Record<string, { shippedAt?: string; trackingNumber?: string }> = {}
        shipments.forEach((s) => {
          shipmentMap[s.location_id] = {
            shippedAt: s.shipped_at,
            trackingNumber: s.tracking_number
          }
        })
        setLocationShipments(shipmentMap)
      } catch (error) {
        logger.error('Failed to load order items:', error)
      } finally {
        setLoadingItems(false)
      }
    }
    loadItems()
  }, [order?.id, order?.status, order?.updated_at, lastShipmentAt])

  // Group items by location
  const locationGroups = useMemo((): LocationGroup[] => {
    if (!orderItems.length) return []
    const groups = new Map<string, LocationGroup>()

    orderItems.forEach((item) => {
      const locationId = item.location_id || 'unknown'
      const locationName = item.pickup_location_name || item.location_name || 'Unassigned'

      if (!groups.has(locationId)) {
        const shipment = item.location_id ? locationShipments[item.location_id] : undefined
        groups.set(locationId, {
          locationId: item.location_id || null,
          locationName,
          items: [],
          allFulfilled: true,
          fulfillmentType: item.order_type || 'unknown',
          shippedAt: shipment?.shippedAt,
          trackingNumber: shipment?.trackingNumber,
        })
      }

      const group = groups.get(locationId)!
      group.items.push(item)
      if (item.fulfillment_status !== 'fulfilled') {
        group.allFulfilled = false
      }
    })

    return Array.from(groups.values())
  }, [orderItems, locationShipments])

  // When location filter is applied, ONLY show that location's items
  // This provides focused view for staff at a specific location
  const filteredGroups = useMemo(() => {
    if (!selectedLocationIds.length) return locationGroups // No filter = show all
    // Only show groups that match the filter
    return locationGroups.filter(g => g.locationId && selectedLocationIds.includes(g.locationId))
  }, [locationGroups, selectedLocationIds])

  // Check original data for multi-location status (not filtered)
  // A split order is ALWAYS a split order, even when viewing filtered subset
  const isMultiLocation = locationGroups.length > 1

  // Sort: my location first (only relevant when viewing multiple locations)
  const sortedGroups = useMemo(() => {
    if (!selectedLocationIds.length) return filteredGroups
    const myGroups = filteredGroups.filter(g => g.locationId && selectedLocationIds.includes(g.locationId))
    const otherGroups = filteredGroups.filter(g => !g.locationId || !selectedLocationIds.includes(g.locationId))
    return [...myGroups, ...otherGroups]
  }, [filteredGroups, selectedLocationIds])

  // Handle fulfilling items at a location
  const handleFulfill = async (locationId: string, locationName: string) => {
    if (!order) return
    Alert.alert('Fulfill Items', `Mark all items at ${locationName} as ready to ship?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Fulfill',
        onPress: async () => {
          try {
            setIsFulfilling(locationId)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            await ordersService.fulfillItemsAtLocation(order.id, locationId)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            const fullOrder = await ordersService.getOrderById(order.id)
            setOrderItems(fullOrder.items || [])
            refreshOrders()
          } catch (error) {
            logger.error('Failed to fulfill items:', error)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            Alert.alert('Error', 'Failed to fulfill items')
          } finally {
            setIsFulfilling(null)
          }
        },
      },
    ])
  }

  const handleBack = () => selectOrder(null)

  const handleCall = () => {
    if (order?.customer_phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`tel:${order.customer_phone}`)
    }
  }

  const handleEmail = () => {
    if (order?.customer_email) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`mailto:${order.customer_email}`)
    }
  }

  const handleDeleteOrder = () => {
    if (!order) return

    Alert.alert(
      'Delete Order',
      `Are you sure you want to permanently delete order ${order.order_number}?\n\nThis will remove the order and all related data. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrder(order.id)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              selectOrder(null)
              refreshOrders()
            } catch (error) {
              logger.error('Failed to delete order:', error)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              Alert.alert('Error', 'Failed to delete order')
            }
          },
        },
      ]
    )
  }

  // Get status for a location group - TWO states: Done or Action needed
  const getGroupStatus = (group: LocationGroup) => {
    // Check if done (shipped at order or location level)
    const isDone = order?.status === 'shipped' || order?.status === 'in_transit' || order?.status === 'delivered' || !!group.shippedAt
    const trackingNum = group.trackingNumber || order?.tracking_number

    if (isDone) return { isDone: true, trackingNumber: trackingNum }
    return { isDone: false, itemCount: group.items.length }
  }

  // Main action for shipped orders
  const showMarkDelivered = order?.status === 'shipped' || order?.status === 'in_transit'

  if (!order) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No order selected</Text>
        <Text style={styles.emptyText}>Select an e-commerce order to view details</Text>
      </View>
    )
  }

  const isDone = order.status === 'delivered' || order.status === 'completed'

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: layout.dockHeight }}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(order.customer_name || 'G').charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.customerName}>{order.customer_name || 'Guest'}</Text>
            <Text style={styles.orderType}>E-Commerce Shipping</Text>
          </View>

          {/* Overall Status */}
          {isDone ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark" size={16} color="#34c759" />
              <Text style={styles.doneBadgeText}>Delivered</Text>
            </View>
          ) : showMarkDelivered ? (
            <Pressable
              style={styles.actionButton}
              onPress={() => setShowDeliveredModal(true)}
              disabled={isUpdating}
            >
              <Text style={styles.actionButtonText}>Mark Delivered</Text>
            </Pressable>
          ) : (
            <View style={styles.contactButtons}>
              {order.customer_phone && (
                <Pressable style={styles.iconButton} onPress={handleCall}>
                  <Ionicons name="call" size={18} color="#fff" />
                </Pressable>
              )}
              {order.customer_email && (
                <Pressable style={styles.iconButton} onPress={handleEmail}>
                  <Ionicons name="mail" size={18} color="#fff" />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Progress Summary (for multi-location) */}
        {isMultiLocation && (
          <View style={styles.progressSummary}>
            <Text style={styles.progressLabel}>
              {sortedGroups.filter(g => g.shippedAt).length}/{sortedGroups.length} locations shipped
            </Text>
          </View>
        )}

        {/* Location Cards - Each location is its own section */}
        {loadingItems ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
          </View>
        ) : (
          sortedGroups.map((group, idx) => {
            const status = getGroupStatus(group)
            const isMyLocation = group.locationId && selectedLocationIds.includes(group.locationId)

            return (
              <View key={group.locationId || idx} style={styles.locationSection}>
                {/* Section Title */}
                <View style={styles.sectionTitleRow}>
                  {isMyLocation && (
                    <Ionicons name="star" size={12} color="#34c759" style={{ marginRight: 4 }} />
                  )}
                  <Text style={[styles.sectionTitle, isMyLocation && styles.myLocationTitle]}>
                    {group.locationName}
                  </Text>
                </View>

                {/* Location Card */}
                <View style={[
                  styles.locationCard,
                  isMyLocation && styles.myLocationCard
                ]}>
                  {/* Card Header - Status + Action */}
                  <View style={styles.cardHeader}>
                    <View style={styles.statusSection}>
                      {status.isDone ? (
                        <View style={styles.statusDone}>
                          <Ionicons name="checkmark-circle" size={18} color="#34c759" />
                          <Text style={styles.statusDoneText}>Done</Text>
                        </View>
                      ) : (
                        <Text style={styles.statusPending}>
                          {status.itemCount} item{status.itemCount !== 1 ? 's' : ''}
                        </Text>
                      )}
                      {status.trackingNumber && (
                        <Text style={styles.trackingText}>#{status.trackingNumber}</Text>
                      )}
                    </View>

                    {/* Action Button - only when not done */}
                    {!status.isDone && group.locationId && (
                      group.allFulfilled ? (
                        <Pressable
                          style={styles.shipButton}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            openShipModal(order.id, group.locationId)
                          }}
                        >
                          <Text style={styles.shipButtonText}>Ship</Text>
                          <Ionicons name="arrow-forward" size={14} color="#000" />
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.fulfillButton}
                          onPress={() => handleFulfill(group.locationId!, group.locationName)}
                          disabled={isFulfilling === group.locationId}
                        >
                          {isFulfilling === group.locationId ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Text style={styles.fulfillButtonText}>Fulfill</Text>
                              <Ionicons name="arrow-forward" size={14} color="#fff" />
                            </>
                          )}
                        </Pressable>
                      )
                    )}
                  </View>

                  {/* Items List */}
                  <View style={styles.itemsList}>
                    {group.items.map((item, itemIdx) => (
                      <View
                        key={item.id}
                        style={[
                          styles.itemRow,
                          itemIdx === group.items.length - 1 && styles.lastItemRow
                        ]}
                      >
                        <View style={styles.itemInfo}>
                          <View style={styles.itemNameRow}>
                            <Text style={styles.itemName}>{item.product_name}</Text>
                            {item.fulfillment_status === 'fulfilled' && (
                              <Ionicons name="checkmark" size={14} color="#34c759" />
                            )}
                          </View>
                          <Text style={styles.itemMeta}>Qty: {item.quantity} × ${item.unit_price.toFixed(2)}</Text>
                        </View>
                        <Text style={styles.itemPrice}>${item.line_total.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )
          })
        )}

        {/* Shipping Address */}
        {order.shipping_address_line1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SHIP TO</Text>
            <View style={styles.card}>
              <Text style={styles.addressName}>{order.shipping_name || order.customer_name}</Text>
              <Text style={styles.addressLine}>{order.shipping_address_line1}</Text>
              {order.shipping_address_line2 && (
                <Text style={styles.addressLine}>{order.shipping_address_line2}</Text>
              )}
              <Text style={styles.addressLine}>
                {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
              </Text>
            </View>
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ORDER #{order.order_number}</Text>
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Danger Zone - Delete Order */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#ff3b30' }]}>DANGER ZONE</Text>
          <View style={styles.card}>
            <Pressable
              style={styles.deleteRow}
              onPress={handleDeleteOrder}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                <Text style={styles.deleteText}>Delete Order</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#ff3b30" />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Modals - ShipOrderModal is rendered at OrdersScreen level */}
      <MarkDeliveredModal
        visible={showDeliveredModal}
        onClose={() => {
          setShowDeliveredModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: layout.containerMargin,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  headerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  orderType: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(52,199,89,0.15)',
    borderRadius: 16,
  },
  doneBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34c759',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress Summary
  progressSummary: {
    marginHorizontal: layout.containerMargin,
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },

  // Loading
  loadingCard: {
    margin: layout.containerMargin,
    padding: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    alignItems: 'center',
  },

  // Location Sections
  locationSection: {
    marginHorizontal: layout.containerMargin,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  myLocationTitle: {
    color: '#34c759',
  },

  // Location Card
  locationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  myLocationCard: {
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.3)',
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusSection: {
    flex: 1,
  },
  statusDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34c759',
  },
  statusPending: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  trackingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  // Action Buttons
  shipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  shipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  fulfillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
  },
  fulfillButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Items List
  itemsList: {
    padding: 16,
    paddingTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lastItemRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  itemInfo: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  itemMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },

  // Section (address, summary)
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    padding: 16,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ff3b30',
  },
})
