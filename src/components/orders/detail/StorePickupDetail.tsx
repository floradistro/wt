/**
 * StorePickupDetail Component - CLEAN & STRUCTURED
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
import { useOrders, useOrdersStore, useOrdersActions } from '@/stores/orders.store'
import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import {
  useOrderItems,
  useItemsByLocation,
  useOrderDetailLoading,
  useOrderDetailActions,
} from '@/stores/order-detail.store'
import { ConfirmPickupOrderModal, MarkReadyModal, ShipOrderModal } from '../modals'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { EmailService } from '@/services/email.service'

export function StorePickupDetail() {
  const selectedOrderId = useSelectedOrderId()
  const orders = useOrders()
  const order = orders.find(o => o.id === selectedOrderId)
  const { selectOrder } = useOrdersUIActions()
  const { refreshOrders } = useOrdersActions()

  const orderItems = useOrderItems()
  const itemsByLocation = useItemsByLocation()
  const { loading, isUpdating: isDetailUpdating } = useOrderDetailLoading()
  const { loadOrderDetails, fulfillItemsAtLocation, reset: resetDetail } = useOrderDetailActions()

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showReadyModal, setShowReadyModal] = useState(false)
  const [showShipModal, setShowShipModal] = useState(false)
  const [selectedShipLocationId, setSelectedShipLocationId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const { vendor } = useAppAuth()
  const vendorId = vendor?.id
  const { selectedLocationIds } = useLocationFilter()

  // When location filter is applied, ONLY show that location's items
  // This provides focused view for staff at a specific location
  const filteredGroups = useMemo(() => {
    if (!selectedLocationIds.length) return itemsByLocation // No filter = show all
    // Only show groups that match the filter
    return itemsByLocation.filter(g => g.locationId && selectedLocationIds.includes(g.locationId))
  }, [itemsByLocation, selectedLocationIds])

  // Check original data for multi-location status (not filtered)
  // A split order is ALWAYS a split order, even when viewing filtered subset
  const isMultiLocation = itemsByLocation.length > 1

  // Sort: my location first (only relevant when viewing multiple locations)
  const sortedGroups = useMemo(() => {
    if (!selectedLocationIds.length) return filteredGroups
    const myGroups = filteredGroups.filter(g => g.locationId && selectedLocationIds.includes(g.locationId))
    const otherGroups = filteredGroups.filter(g => !g.locationId || !selectedLocationIds.includes(g.locationId))
    return [...myGroups, ...otherGroups]
  }, [filteredGroups, selectedLocationIds])

  useEffect(() => {
    if (order?.id) {
      loadOrderDetails(order.id)
    }
    return () => resetDetail()
  }, [order?.id])

  const handleBack = () => selectOrder(null)

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (!order) return
    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      await useOrdersStore.getState().updateOrderStatus(order.id, newStatus)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to update pickup order status:', error)
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

  // Mark items ready at a location with email notification
  const handleMarkReady = async (locationId: string, locationName: string) => {
    if (!order || !vendorId) return
    try {
      setIsUpdating(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      await fulfillItemsAtLocation(order.id, locationId)

      // Send notification email
      if (order.customer_email) {
        try {
          await EmailService.sendOrderReady({
            vendorId,
            orderId: order.id,
            customerEmail: order.customer_email,
            customerName: order.customer_name || undefined,
            orderNumber: order.order_number,
            pickupLocation: locationName,
            customerId: order.customer_id,
          })
        } catch (emailError) {
          logger.error('Error sending pickup ready notification:', emailError)
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      refreshOrders()
    } catch (error) {
      logger.error('Failed to mark location ready:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to mark items as ready')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleShipFromLocation = (locationId: string) => {
    setSelectedShipLocationId(locationId)
    setShowShipModal(true)
  }

  // Get main action for single-location orders
  // For multi-location: header shows nothing, each card handles its own actions
  // For single-location: header shows workflow actions UNTIL items are ready
  const getMainAction = () => {
    if (!order || isMultiLocation) return null
    if (order.status === 'completed' || order.status === 'cancelled') return null

    // Check if items are already fulfilled - if so, card handles "Picked Up"
    const singleGroup = sortedGroups[0]
    const itemsFulfilled = singleGroup?.allFulfilled

    if (order.status === 'pending') {
      return { label: 'Confirm Order', handler: () => setShowConfirmModal(true) }
    }
    if (order.status === 'confirmed') {
      return { label: 'Start Preparing', handler: () => handleStatusUpdate('preparing') }
    }
    if (order.status === 'preparing') {
      // If items already fulfilled, card shows "Picked Up" - no header action
      if (itemsFulfilled) return null
      return { label: 'Mark Ready', handler: () => setShowReadyModal(true) }
    }
    if (order.status === 'ready') {
      // Card shows "Picked Up" - no header action
      return null
    }
    return null
  }

  const mainAction = getMainAction()

  // Get status for a location group - TWO states: Done or Action needed
  const getGroupStatus = (group: any) => {
    const isPickup = group.fulfillmentType === 'pickup'
    const orderCompleted = order?.status === 'completed'

    // Done = order completed
    if (orderCompleted) {
      return { isDone: true, showAction: false }
    }

    // Items ready but waiting for pickup/ship
    if (group.allFulfilled) {
      return {
        isDone: false,
        showAction: true,
        actionLabel: isPickup ? 'Picked Up' : 'Ship',
        itemCount: group.totalCount
      }
    }

    // Items need preparation
    return {
      isDone: false,
      showAction: true,
      actionLabel: 'Mark Ready',
      itemCount: group.totalCount
    }
  }

  if (!order) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No order selected</Text>
        <Text style={styles.emptyText}>Select a pickup order to view details</Text>
      </View>
    )
  }

  const isDone = order.status === 'completed'

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
            <Text style={styles.orderType}>
              {order.pickup_location_name || 'Store Pickup'}
            </Text>
          </View>

          {/* Overall Status / Action */}
          {isDone ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark" size={16} color="#34c759" />
              <Text style={styles.doneBadgeText}>Completed</Text>
            </View>
          ) : mainAction ? (
            <Pressable
              style={styles.actionButton}
              onPress={mainAction.handler}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.actionButtonText}>{mainAction.label}</Text>
              )}
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
              {sortedGroups.filter(g => g.allFulfilled).length}/{sortedGroups.length} locations ready
            </Text>
          </View>
        )}

        {/* Location Cards - Each location is its own section */}
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
          </View>
        ) : (
          sortedGroups.map((group, idx) => {
            const status = getGroupStatus(group)
            const isMyLocation = group.locationId && selectedLocationIds.includes(group.locationId)
            const isPickup = group.fulfillmentType === 'pickup'

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
                  <Text style={styles.fulfillmentType}>
                    {isPickup ? '(Pickup)' : '(Ship)'}
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
                    </View>

                    {/* Action Button - Based on actionLabel */}
                    {status.showAction && group.locationId && (
                      status.actionLabel === 'Picked Up' ? (
                        <Pressable
                          style={styles.pickedUpButton}
                          onPress={() => handleStatusUpdate('completed')}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <ActivityIndicator size="small" color="#000" />
                          ) : (
                            <>
                              <Text style={styles.pickedUpButtonText}>Picked Up</Text>
                              <Ionicons name="checkmark" size={16} color="#000" />
                            </>
                          )}
                        </Pressable>
                      ) : status.actionLabel === 'Ship' ? (
                        <Pressable
                          style={styles.shipButton}
                          onPress={() => handleShipFromLocation(group.locationId!)}
                        >
                          <Text style={styles.shipButtonText}>Ship Now</Text>
                          <Ionicons name="arrow-forward" size={14} color="#000" />
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.fulfillButton}
                          onPress={() => handleMarkReady(group.locationId!, group.locationName)}
                          disabled={isUpdating || isDetailUpdating}
                        >
                          {isUpdating || isDetailUpdating ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Text style={styles.fulfillButtonText}>Mark Ready</Text>
                              <Ionicons name="arrow-forward" size={14} color="#fff" />
                            </>
                          )}
                        </Pressable>
                      )
                    )}
                  </View>

                  {/* Items List */}
                  <View style={styles.itemsList}>
                    {group.items.map((item: any, itemIdx: number) => (
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

        {/* Customer Contact */}
        {(order.customer_email || order.customer_phone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CUSTOMER</Text>
            <View style={styles.card}>
              {order.customer_email && (
                <Pressable style={styles.contactRow} onPress={handleEmail}>
                  <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.contactText}>{order.customer_email}</Text>
                </Pressable>
              )}
              {order.customer_phone && (
                <Pressable style={[styles.contactRow, !order.customer_email && styles.lastContactRow]} onPress={handleCall}>
                  <Ionicons name="call-outline" size={18} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.contactText}>{order.customer_phone}</Text>
                </Pressable>
              )}
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

      {/* Modals */}
      <ConfirmPickupOrderModal
        visible={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <MarkReadyModal
        visible={showReadyModal}
        onClose={() => {
          setShowReadyModal(false)
          refreshOrders()
        }}
        orderId={order.id}
      />

      <ShipOrderModal
        visible={showShipModal}
        onClose={() => {
          setShowShipModal(false)
          setSelectedShipLocationId(null)
          refreshOrders()
        }}
        orderId={order.id}
        locationId={selectedShipLocationId}
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
  fulfillmentType: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 6,
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
  statusReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusReadyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  statusPending: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },

  // Action Buttons
  pickedUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  pickedUpButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
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

  // Section (customer, summary)
  section: {
    marginHorizontal: layout.containerMargin,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    padding: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lastContactRow: {
    borderBottomWidth: 0,
  },
  contactText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
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
