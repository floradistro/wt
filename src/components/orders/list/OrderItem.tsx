/**
 * OrderItem Component - CLEAN but STRUCTURED
 *
 * Design:
 * - Two colors: Green = done, White = action needed
 * - Location list VISIBLE for split orders
 * - My location highlighted
 * - Clear at a glance
 */

import React, { useCallback, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { type Order } from '@/services/orders.service'
import { ordersStyles as styles } from '../orders.styles'

import { useSelectedOrderId, useOrdersUIActions } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'

interface OrderItemProps {
  order: Order
  showLocation?: boolean
  isLast: boolean
}

const OrderItem = React.memo<OrderItemProps>(({ order, isLast }) => {
  const selectedOrderId = useSelectedOrderId()
  const isSelected = selectedOrderId === order.id
  const { selectedLocationIds } = useLocationFilter()
  const { selectOrder } = useOrdersUIActions()

  // ========================================
  // LOCATION STATUS for split orders
  // When filter applied: ONLY show filtered location's info
  // ========================================
  const locationData = useMemo(() => {
    const fulfillmentLocs = order.fulfillment_locations || []
    const isMultiLocation = fulfillmentLocs.length > 1
    const pickupLocationId = order.pickup_location_id
    const hasLocationFilter = selectedLocationIds.length > 0

    if (!isMultiLocation) {
      // For single location orders, check if my location needs action
      const myLocationNeedsAction = hasLocationFilter &&
        order.status !== 'completed' &&
        order.status !== 'delivered' &&
        order.status !== 'cancelled'

      return {
        isMultiLocation: false,
        locations: [],
        myLocationNeedsAction,
      }
    }

    // Build location list with status
    const allLocations = fulfillmentLocs.map(loc => {
      const isPickup = loc.location_id === pickupLocationId
      const isMyLocation = hasLocationFilter && selectedLocationIds.includes(loc.location_id)
      const itemCount = loc.item_count || loc.total_quantity || 0
      const status = loc.fulfillment_status

      // Simple: Done or item count
      const isDone = status === 'shipped' || status === 'fulfilled'
      const actionLabel = isDone ? 'Done' : `${itemCount}`

      return {
        locationId: loc.location_id,
        locationName: loc.location_name || 'Unknown',
        isPickup,
        isMyLocation,
        isDone,
        actionLabel,
      }
    })

    // FILTER: When location filter is applied, only show MY location(s)
    // This provides a focused view - user only sees what's relevant to them
    const locations = hasLocationFilter
      ? allLocations.filter(l => l.isMyLocation)
      : allLocations

    // Sort: My location first, then by done status (action needed first)
    const sorted = [...locations].sort((a, b) => {
      if (a.isMyLocation && !b.isMyLocation) return -1
      if (!a.isMyLocation && b.isMyLocation) return 1
      if (!a.isDone && b.isDone) return -1
      if (a.isDone && !b.isDone) return 1
      return 0
    })

    const doneCount = locations.filter(l => l.isDone).length

    // Check if MY location needs action (for split orders)
    const myLocation = allLocations.find(l => l.isMyLocation)
    const myLocationNeedsAction = hasLocationFilter && myLocation && !myLocation.isDone

    return {
      isMultiLocation: true,
      // When filtered, show as single location if only 1 remains
      showLocationList: !hasLocationFilter || sorted.length > 1,
      locations: sorted,
      doneCount,
      totalCount: locations.length,
      allDone: doneCount === locations.length,
      myLocationNeedsAction,
      // For filtered view, show the filtered location's status
      filteredStatus: hasLocationFilter && sorted.length === 1 ? sorted[0] : null,
    }
  }, [order.fulfillment_locations, order.pickup_location_id, selectedLocationIds, order.status])

  // ========================================
  // EVENT HANDLERS
  // ========================================
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    selectOrder(order.id)
  }, [order.id, selectOrder])

  // Format time
  const timeStr = new Date(order.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Customer initials
  const customerInitials = order.customer_name
    ? order.customer_name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'G'

  // Get item count for display
  const itemCount = order.item_count || order.items?.length || 0

  // Simple status - TWO states only: Done (green) or Action needed (white)
  const getSimpleStatus = (status: Order['status'], orderType: string) => {
    // DONE states - green checkmark
    if (status === 'delivered' || status === 'completed' || status === 'shipped' || status === 'in_transit') {
      return { label: 'Done', isDone: true }
    }
    if (status === 'cancelled') return { label: 'Cancelled', isDone: false }

    // ACTION needed - show item count
    return { label: `${itemCount} item${itemCount !== 1 ? 's' : ''}`, isDone: false }
  }

  // ========================================
  // RENDER
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
          <Text style={styles.orderIconText}>{customerInitials}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.orderInfo}>
        {/* Line 1: Name + Status */}
        <View style={styles.orderLine}>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.customer_name || 'Guest'}
          </Text>
          {locationData.isMultiLocation ? (
            locationData.filteredStatus ? (
              <Text style={[
                styles.orderStatus,
                { color: locationData.filteredStatus.isDone ? '#34c759' : '#fff' }
              ]}>
                {locationData.filteredStatus.actionLabel}
              </Text>
            ) : (
              <View style={[
                localStyles.progressBadge,
                locationData.allDone && localStyles.progressBadgeDone
              ]}>
                {locationData.allDone ? (
                  <Ionicons name="checkmark" size={12} color="#34c759" />
                ) : null}
                <Text style={[
                  localStyles.progressText,
                  locationData.allDone && localStyles.progressTextDone
                ]}>
                  {locationData.allDone ? 'Done' : `${locationData.doneCount}/${locationData.totalCount}`}
                </Text>
              </View>
            )
          ) : (
            <Text style={[
              styles.orderStatus,
              { color: getSimpleStatus(order.status, order.order_type).isDone ? '#34c759' : '#fff' }
            ]}>
              {getSimpleStatus(order.status, order.order_type).label}
            </Text>
          )}
        </View>

        {/* Line 2: Time only */}
        <View style={styles.orderLine}>
          <Text style={styles.orderMeta} numberOfLines={1}>
            {timeStr}
          </Text>
        </View>

        {/* Location List (for split orders - hidden when filtered to single location) */}
        {locationData.isMultiLocation && locationData.showLocationList && (
          <View style={localStyles.locationList}>
            {locationData.locations.map((loc) => (
              <View
                key={loc.locationId}
                style={[
                  localStyles.locationRow,
                  loc.isMyLocation && localStyles.myLocationRow,
                ]}
              >
                {/* Location name */}
                <View style={localStyles.locationNameSection}>
                  {loc.isMyLocation && (
                    <Ionicons name="star" size={10} color="#34c759" />
                  )}
                  <Text
                    style={[
                      localStyles.locationName,
                      loc.isMyLocation && localStyles.myLocationName
                    ]}
                    numberOfLines={1}
                  >
                    {loc.locationName}
                  </Text>
                </View>

                {/* Status */}
                <View style={[
                  localStyles.statusBadge,
                  loc.isDone ? localStyles.statusDone : localStyles.statusAction
                ]}>
                  {loc.isDone && (
                    <Ionicons name="checkmark" size={10} color="#34c759" />
                  )}
                  <Text style={[
                    localStyles.statusText,
                    loc.isDone ? localStyles.statusTextDone : localStyles.statusTextAction
                  ]}>
                    {loc.actionLabel}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  )
})

OrderItem.displayName = 'OrderItem'

const localStyles = StyleSheet.create({
  // Progress badge
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBadgeDone: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  progressTextDone: {
    color: '#34c759',
  },

  // Location list
  locationList: {
    marginTop: 10,
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  myLocationRow: {
    backgroundColor: 'rgba(52,199,89,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#34c759',
  },
  locationNameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  locationName: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  myLocationName: {
    color: '#fff',
    fontWeight: '600',
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusAction: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusDone: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextAction: {
    color: '#fff',
  },
  statusTextDone: {
    color: '#34c759',
  },
})

export { OrderItem }
