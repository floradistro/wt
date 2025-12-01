/**
 * ECommerceDetail Component - ZERO PROPS ✅
 * Specialized detail view for e-commerce shipping orders
 *
 * Workflow: Pending → Confirmed → Packing → Packed → Shipped → In Transit → Delivered
 * Uses modals: ConfirmECommerceOrderModal, PackOrderModal, ShipOrderModal, MarkDeliveredModal
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native'
import { useState, useEffect, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { logger } from '@/utils/logger'
import type { Order } from '@/services/orders.service'
import { ordersService, type OrderItem } from '@/services/orders.service'
import { useOrders, useOrdersStore, useOrdersActions } from '@/stores/orders.store'
import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import {
  ConfirmECommerceOrderModal,
  PackOrderModal,
  ShipOrderModal,
  MarkDeliveredModal,
} from '../modals'

// Group items by location
interface LocationGroup {
  locationId: string | null
  locationName: string
  items: OrderItem[]
  allFulfilled: boolean
  // Fulfillment type: pickup or shipping (Apple/Best Buy style)
  fulfillmentType: 'pickup' | 'shipping' | 'unknown'
  // Shipping info for this location (only for shipping items)
  trackingNumber?: string
  trackingUrl?: string
  shippingCarrier?: string
  shippedAt?: string
}

export function ECommerceDetail() {
  const selectedOrderId = useSelectedOrderId()
  const orders = useOrders()
  const order = orders.find(o => o.id === selectedOrderId)
  const { selectOrder } = useOrdersUIActions()
  const { refreshOrders } = useOrdersActions()
  const { selectedLocationIds } = useLocationFilter()

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showPackModal, setShowPackModal] = useState(false)
  const [showShipModal, setShowShipModal] = useState(false)
  const [showDeliveredModal, setShowDeliveredModal] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isFulfilling, setIsFulfilling] = useState<string | null>(null) // locationId being fulfilled
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [shipFromLocationId, setShipFromLocationId] = useState<string | null>(null) // For per-location shipping

  // Shipment info per location (from order_locations table)
  const [locationShipments, setLocationShipments] = useState<Record<string, {
    trackingNumber?: string
    trackingUrl?: string
    shippingCarrier?: string
    shippedAt?: string
  }>>({})

  // Load order items (with location data) and shipment info
  useEffect(() => {
    if (!order) return

    const loadItems = async () => {
      try {
        setLoadingItems(true)
        const fullOrder = await ordersService.getOrderById(order.id)
        setOrderItems(fullOrder.items || [])

        // Load per-location shipment info
        const shipments = await ordersService.getOrderShipments(order.id)
        const shipmentMap: Record<string, { trackingNumber?: string; trackingUrl?: string; shippingCarrier?: string; shippedAt?: string }> = {}
        shipments.forEach((s) => {
          shipmentMap[s.location_id] = {
            trackingNumber: s.tracking_number,
            trackingUrl: s.tracking_url,
            shippingCarrier: s.shipping_carrier,
            shippedAt: s.shipped_at,
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
  }, [order?.id])

  // Group items by location for multi-location display
  const itemsByLocation = useMemo((): LocationGroup[] => {
    if (!orderItems.length) return []

    const groups = new Map<string, LocationGroup>()

    orderItems.forEach((item) => {
      const locationId = item.location_id || 'unknown'
      // Use pickup_location_name for pickup items, otherwise try location_name or fetch from somewhere
      const locationName = item.pickup_location_name || item.location_name || 'Unassigned'
      // Get fulfillment type from item's order_type (set by smart routing)
      const itemFulfillmentType = item.order_type

      if (!groups.has(locationId)) {
        const shipment = item.location_id ? locationShipments[item.location_id] : undefined
        groups.set(locationId, {
          locationId: item.location_id || null,
          locationName,
          items: [],
          allFulfilled: true,
          // Set fulfillment type from the first item (all items at a location have same type)
          fulfillmentType: itemFulfillmentType || 'unknown',
          // Include shipment info
          trackingNumber: shipment?.trackingNumber,
          trackingUrl: shipment?.trackingUrl,
          shippingCarrier: shipment?.shippingCarrier,
          shippedAt: shipment?.shippedAt,
        })
      }

      const group = groups.get(locationId)!
      group.items.push(item)
      if (item.fulfillment_status !== 'fulfilled') {
        group.allFulfilled = false
      }
    })

    // Sort: pickup locations first, then shipping
    return Array.from(groups.values()).sort((a, b) => {
      if (a.fulfillmentType === 'pickup' && b.fulfillmentType !== 'pickup') return -1
      if (a.fulfillmentType !== 'pickup' && b.fulfillmentType === 'pickup') return 1
      return 0
    })
  }, [orderItems, locationShipments])

  // Check if this is a multi-location order
  const isMultiLocation = itemsByLocation.length > 1

  // Check if user's selected location has items to fulfill
  const myLocationGroup = useMemo(() => {
    if (!selectedLocationIds.length) return null
    return itemsByLocation.find((g) => g.locationId && selectedLocationIds.includes(g.locationId))
  }, [itemsByLocation, selectedLocationIds])

  // Handle fulfilling items at a specific location
  const handleFulfillAtLocation = async (locationId: string, locationName: string) => {
    if (!order) return

    Alert.alert(
      'Fulfill Items',
      `Mark all items at ${locationName} as fulfilled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fulfill',
          style: 'default',
          onPress: async () => {
            try {
              setIsFulfilling(locationId)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

              const result = await ordersService.fulfillItemsAtLocation(order.id, locationId)

              if (result.orderFullyFulfilled) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                Alert.alert('Success', 'All items fulfilled! Order is ready to ship.')
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                Alert.alert(
                  'Items Fulfilled',
                  `${result.itemsFulfilled} item(s) marked as fulfilled. Waiting on ${result.remainingLocations.length} other location(s).`
                )
              }

              // Reload items to show updated status
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
      ]
    )
  }

  const handleBack = () => {
    selectOrder(null)
  }

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (!order) return

    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

      await useOrdersStore.getState().updateOrderStatus(order.id, newStatus)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to update e-commerce order status:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to update order status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCall = () => {
    if (order?.customer_phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`tel:${order.customer_phone}`)
    }
  }

  const handleText = () => {
    if (order?.customer_phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`sms:${order.customer_phone}`)
    }
  }

  const handleEmail = () => {
    if (order?.customer_email) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(`mailto:${order.customer_email}`)
    }
  }

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
      case 'ready_to_ship':
        return '#0a84ff' // Blue for in-progress
      default:
        return '#8e8e93' // Gray
    }
  }

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'confirmed': return 'Confirmed'
      case 'preparing': return 'Preparing'
      case 'packing': return 'Packing'
      case 'packed': return 'Packed'
      case 'ready_to_ship': return 'Ready to Ship'
      case 'shipped': return 'Shipped'
      case 'in_transit': return 'In Transit'
      case 'delivered': return 'Delivered'
      case 'completed': return 'Completed'
      case 'cancelled': return 'Cancelled'
      default: return status
    }
  }

  // Get button text and handler based on status
  // Apple-style: processing → shipped → delivered (3 states, 1 action)
  const getActionButton = () => {
    if (!order) {
      return { text: undefined, handler: undefined, disabled: true }
    }

    // Terminal states - no action
    if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'completed') {
      return { text: undefined, handler: undefined, disabled: true }
    }

    // Confirmed/Pending/etc - show Ship button (Apple-style: one action)
    if (['confirmed', 'pending', 'preparing', 'packing', 'packed', 'ready_to_ship'].includes(order.status)) {
      return { text: 'Ship', handler: () => setShowShipModal(true), disabled: isUpdating }
    }

    // Shipped/In Transit - show Delivered button
    if (order.status === 'shipped' || order.status === 'in_transit') {
      return { text: 'Mark Delivered', handler: () => setShowDeliveredModal(true), disabled: isUpdating }
    }

    return { text: undefined, handler: undefined, disabled: true }
  }

  const actionButton = getActionButton()

  if (!order) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>No order selected</Text>
        <Text style={styles.emptyText}>Select an e-commerce order to view details</Text>
      </View>
    )
  }

  return (
    <View style={styles.detail}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: layout.dockHeight }}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        {/* Title Card - Steve Jobs Minimal */}
        <View style={styles.headerCardContainer}>
          <View style={styles.headerCardGlass}>
            <View style={styles.headerCard}>
              {/* Back Button */}
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
              </Pressable>

              {/* Customer Avatar */}
              <View style={[styles.headerIconPlaceholder, styles.headerIcon]}>
                <Text style={styles.headerIconText}>
                  {(order.customer_name || 'G').charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Customer Info */}
              <View style={styles.headerInfo}>
                <Text style={styles.headerTitle}>{order.customer_name || 'Guest'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="cube-outline" size={13} color="rgba(235,235,245,0.6)" />
                  <Text style={styles.headerSubtitle}>Shipping Order</Text>
                </View>
              </View>

              {/* Right Actions */}
              <View style={styles.headerActions}>
                {/* Contact Icons */}
                {order.customer_phone && (
                  <Pressable style={styles.iconButton} onPress={handleCall}>
                    <Ionicons name="call" size={20} color={colors.text.primary} />
                  </Pressable>
                )}
                {order.customer_email && (
                  <Pressable style={styles.iconButton} onPress={handleEmail}>
                    <Ionicons name="mail" size={20} color={colors.text.primary} />
                  </Pressable>
                )}

                {/* Status Button - Always Visible */}
                <Pressable
                  style={[
                    styles.statusButton,
                    { backgroundColor: getStatusColor(order.status) }
                  ]}
                  onPress={() => {
                    if (actionButton.handler) {
                      actionButton.handler()
                    }
                  }}
                  disabled={isUpdating || !actionButton.text}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.statusButtonText}>
                      {actionButton.text || getStatusLabel(order.status)}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Shipping Information - Per-location for multi-location orders */}
        {isMultiLocation ? (
          // Multi-location: Show shipments section
          itemsByLocation.some((g) => g.trackingNumber) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipments ({itemsByLocation.filter(g => g.trackingNumber).length}/{itemsByLocation.length})</Text>
              {itemsByLocation.filter(g => g.trackingNumber).map((group, idx) => (
                <View key={group.locationId || idx} style={[styles.cardGlass, { marginBottom: 8 }]}>
                  <View style={styles.infoRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="cube-outline" size={16} color="#bf5af2" />
                      <Text style={styles.infoLabel}>{group.locationName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="checkmark-circle" size={14} color="#34c759" />
                      <Text style={{ color: '#34c759', fontSize: 12, fontWeight: '600' }}>Shipped</Text>
                    </View>
                  </View>
                  <View style={[styles.infoRow, styles.lastRow]}>
                    <Text style={styles.infoLabel}>Tracking</Text>
                    <Pressable
                      onPress={() => {
                        if (group.trackingUrl) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          Linking.openURL(group.trackingUrl)
                        }
                      }}
                    >
                      <Text style={[styles.infoValue, group.trackingUrl && { color: '#0a84ff' }]}>
                        {group.shippingCarrier && `${group.shippingCarrier}: `}{group.trackingNumber}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          // Single location: Show order-level tracking
          order.tracking_number && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shipping Information</Text>
              <View style={styles.cardGlass}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tracking</Text>
                  <Pressable
                    onPress={() => {
                      if (order.tracking_url) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        Linking.openURL(order.tracking_url)
                      }
                    }}
                  >
                    <Text style={[styles.infoValue, order.tracking_url && { color: '#0a84ff' }]}>
                      {order.tracking_number}
                    </Text>
                  </Pressable>
                </View>
                {order.shipping_cost && (
                  <View style={[styles.infoRow, styles.lastRow]}>
                    <Text style={styles.infoLabel}>Shipping Cost</Text>
                    <Text style={styles.infoValue}>${order.shipping_cost.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            </View>
          )
        )}

        {/* Customer Information - ALWAYS SHOWN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.cardGlass}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{order.customer_name || order.shipping_name || 'Guest'}</Text>
            </View>
            {order.customer_email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Pressable onPress={handleEmail}>
                  <Text style={[styles.infoValue, { color: '#0a84ff' }]}>
                    {order.customer_email}
                  </Text>
                </Pressable>
              </View>
            )}
            {(order.customer_phone || order.shipping_phone) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Pressable onPress={handleCall}>
                  <Text style={[styles.infoValue, { color: '#0a84ff' }]}>
                    {order.customer_phone || order.shipping_phone}
                  </Text>
                </Pressable>
              </View>
            )}
            {/* Shipping/Delivery Address */}
            {order.shipping_address_line1 && (
              <View style={[styles.infoRow, styles.lastRow]}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={[styles.infoValue, { textAlign: 'right', flex: 1, marginLeft: 16 }]}>
                  {order.shipping_address_line1}
                  {order.shipping_address_line2 && `\n${order.shipping_address_line2}`}
                  {'\n'}{order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                  {order.shipping_country && order.shipping_country !== 'US' && `\n${order.shipping_country}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Order Items - Grouped by Location for Multi-Location Orders */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Order Items</Text>
            {isMultiLocation && (
              <View style={styles.multiLocationBadge}>
                <Ionicons name="location" size={12} color="#bf5af2" />
                <Text style={styles.multiLocationText}>{itemsByLocation.length} Locations</Text>
              </View>
            )}
          </View>

          {loadingItems ? (
            <View style={[styles.cardGlass, { padding: 20, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={colors.text.secondary} />
            </View>
          ) : itemsByLocation.length > 0 ? (
            itemsByLocation.map((group, groupIndex) => (
              <View key={group.locationId || 'unassigned'} style={{ marginBottom: groupIndex < itemsByLocation.length - 1 ? 12 : 0 }}>
                {/* Location Header (shown for multi-location orders) */}
                {isMultiLocation && (
                  <View style={styles.locationHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      {/* Icon based on fulfillment type */}
                      <Ionicons
                        name={group.fulfillmentType === 'pickup' ? 'storefront-outline' : 'cube-outline'}
                        size={16}
                        color={group.fulfillmentType === 'pickup' ? '#30d158' : '#bf5af2'}
                      />
                      <View>
                        {/* Fulfillment type label */}
                        <Text style={[
                          styles.fulfillmentTypeLabel,
                          { color: group.fulfillmentType === 'pickup' ? '#30d158' : '#bf5af2' }
                        ]}>
                          {group.fulfillmentType === 'pickup' ? 'PICKUP' : 'SHIPPING'}
                        </Text>
                        <Text style={styles.locationName}>{group.locationName}</Text>
                      </View>
                      {group.shippedAt ? (
                        // Already shipped
                        <View style={[styles.fulfilledBadge, { backgroundColor: 'rgba(191,90,242,0.15)' }]}>
                          <Ionicons name="cube" size={14} color="#bf5af2" />
                          <Text style={[styles.fulfilledText, { color: '#bf5af2' }]}>Shipped</Text>
                        </View>
                      ) : group.allFulfilled ? (
                        <View style={styles.fulfilledBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#34c759" />
                          <Text style={styles.fulfilledText}>Fulfilled</Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Action buttons based on status */}
                    {group.locationId && !group.shippedAt && (
                      group.allFulfilled ? (
                        // Fulfilled but not shipped - show Ship button
                        <Pressable
                          style={[styles.fulfillButton, { backgroundColor: '#bf5af2' }]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                            setShipFromLocationId(group.locationId)
                            setShowShipModal(true)
                          }}
                        >
                          <Text style={styles.fulfillButtonText}>Ship</Text>
                        </Pressable>
                      ) : (
                        // Not fulfilled yet - show Fulfill button
                        <Pressable
                          style={styles.fulfillButton}
                          onPress={() => handleFulfillAtLocation(group.locationId!, group.locationName)}
                          disabled={isFulfilling === group.locationId}
                        >
                          {isFulfilling === group.locationId ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.fulfillButtonText}>Fulfill</Text>
                          )}
                        </Pressable>
                      )
                    )}
                  </View>
                )}

                {/* Items for this location */}
                <View style={styles.cardGlass}>
                  {group.items.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.infoRow,
                        index === group.items.length - 1 && styles.lastRow
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.infoValue}>{item.product_name}</Text>
                          {item.fulfillment_status === 'fulfilled' && (
                            <Ionicons name="checkmark-circle" size={14} color="#34c759" />
                          )}
                        </View>
                        <Text style={[styles.infoLabel, { marginTop: 4 }]}>
                          Qty: {item.quantity} × ${item.unit_price.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.infoValue}>
                        ${item.line_total.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.cardGlass, { padding: 20, alignItems: 'center' }]}>
              <Text style={styles.infoLabel}>No items found</Text>
            </View>
          )}
        </View>

        {/* My Location Quick Action (if user has items at their location) */}
        {myLocationGroup && !myLocationGroup.allFulfilled && (
          <View style={styles.section}>
            <Pressable
              style={styles.myLocationButton}
              onPress={() => handleFulfillAtLocation(myLocationGroup.locationId!, myLocationGroup.locationName)}
              disabled={isFulfilling !== null}
            >
              {isFulfilling === myLocationGroup.locationId ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#fff" />
                  <Text style={styles.myLocationButtonText}>
                    Fulfill My Items ({myLocationGroup.items.length})
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Order Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.cardGlass}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Number</Text>
              <Text style={styles.infoValue}>{order.order_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {new Date(order.created_at).toLocaleString()}
              </Text>
            </View>
            <View style={[styles.infoRow, styles.lastRow]}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoValue}>{order.payment_method || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.cardGlass}>
            <View style={[styles.infoRow, styles.totalRow, styles.lastRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${order.total_amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <ConfirmECommerceOrderModal
        visible={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <PackOrderModal
        visible={showPackModal}
        onClose={() => {
          setShowPackModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <ShipOrderModal
        visible={showShipModal}
        onClose={async () => {
          setShowShipModal(false)
          setShipFromLocationId(null)
          refreshOrders()
          // Reload items to get updated shipment data
          if (order) {
            const fullOrder = await ordersService.getOrderById(order.id)
            setOrderItems(fullOrder.items || [])
            const shipments = await ordersService.getOrderShipments(order.id)
            const shipmentMap: Record<string, { trackingNumber?: string; trackingUrl?: string; shippingCarrier?: string; shippedAt?: string }> = {}
            shipments.forEach((s) => {
              shipmentMap[s.location_id] = {
                trackingNumber: s.tracking_number,
                trackingUrl: s.tracking_url,
                shippingCarrier: s.shipping_carrier,
                shippedAt: s.shipped_at,
              }
            })
            setLocationShipments(shipmentMap)
          }
        }}
        orderId={order.id}
        locationId={shipFromLocationId}
      />

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

// Reuse same styles as StorePickupDetail
const styles = StyleSheet.create({
  detail: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  headerCardContainer: {
    marginHorizontal: layout.containerMargin,
    marginTop: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  headerCardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.containerMargin,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: layout.cardRadius,
  },
  headerIconPlaceholder: {
    backgroundColor: 'rgba(118,118,128,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 36,
    color: 'rgba(235,235,245,0.6)',
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(235,235,245,0.6)',
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 100,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: layout.containerMargin,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardGlass: {
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: layout.rowPaddingVertical,
    paddingHorizontal: layout.containerMargin,
    minHeight: layout.minTouchTarget,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  infoValue: {
    fontSize: 15,
    color: 'rgba(235,235,245,0.6)',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.border.regular,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  // Multi-location styles
  multiLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(191,90,242,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  multiLocationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#bf5af2',
    letterSpacing: 0.2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(235,235,245,0.8)',
    letterSpacing: -0.2,
  },
  fulfillmentTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fulfilledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  fulfilledText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34c759',
  },
  fulfillButton: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  fulfillButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  myLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#34c759',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.xl,
  },
  myLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
})
