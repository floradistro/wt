/**
 * FulfillmentBoard - Apple Engineering Excellence
 *
 * ONE unified load board for all fulfillment:
 * - Pickup + Shipping merged
 * - ACTION NEEDED at top (sorted by urgency)
 * - DONE at bottom (collapsed)
 * - ONE action button per order
 * - A dumbass can use this like a pro
 */

import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { layout } from '@/theme/layout'
import { useFilteredOrders } from '@/stores/order-filter.store'
import { useOrdersLoading, useOrdersActions, useOrdersStore, useConnectionState } from '@/stores/orders.store'
import { useOrdersUIActions, useSelectedOrderId } from '@/stores/orders-ui.store'
import { useLocationFilter } from '@/stores/location-filter.store'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { TitleSection } from '@/components/shared'
import { OrderFilterBar } from '@/components/orders/shared'
import type { Order } from '@/services/orders.service'

// ============================================
// TYPES
// ============================================

interface BoardOrder {
  order: Order
  action: OrderAction | null
  isDone: boolean
  timeAgo: string
  typeIcon: 'storefront' | 'cube'  // Pickup vs Ship
  typeLabel: string
}

interface OrderAction {
  label: string
  handler: () => void
  style: 'primary' | 'secondary'
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatTimestamp(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  // Format time as 12-hour with AM/PM
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  if (isToday) {
    return timeStr // Just show time for today's orders
  }

  // Show date + time for older orders
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
  return `${dateStr}, ${timeStr}`
}

// ============================================
// BOARD ITEM COMPONENT
// ============================================

interface BoardItemProps {
  item: BoardOrder
  onPress: () => void
  isSelected: boolean
  onAction: () => void
}

const BoardItem = React.memo<BoardItemProps>(({ item, onPress, isSelected, onAction }) => {
  const { order, action, isDone, timeAgo, typeIcon, typeLabel } = item

  const customerInitials = order.customer_name
    ? order.customer_name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'G'

  const handleActionPress = useCallback((e: any) => {
    e.stopPropagation()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onAction()
  }, [onAction])

  return (
    <Pressable
      style={[
        styles.boardItem,
        isSelected && styles.boardItemSelected,
        isDone && styles.boardItemDone,
      ]}
      onPress={onPress}
    >
      {/* Left: Avatar + Info */}
      <View style={styles.itemLeft}>
        <View style={[styles.avatar, isDone && styles.avatarDone]}>
          <Text style={[styles.avatarText, isDone && styles.avatarTextDone]}>
            {customerInitials}
          </Text>
        </View>

        <View style={styles.itemInfo}>
          <View style={styles.itemTopRow}>
            <Text style={[styles.customerName, isDone && styles.textDone]} numberOfLines={1}>
              {order.customer_name || 'Guest'}
            </Text>
            <Text style={[styles.itemCount, isDone && styles.textDone]}>
              {order.item_count || order.items?.length || 0} item{(order.item_count || order.items?.length || 0) !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.itemBottomRow}>
            <View style={styles.typeBadge}>
              <Ionicons
                name={typeIcon}
                size={12}
                color={isDone ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={[styles.typeLabel, isDone && styles.textDone]}>
                {typeLabel}
              </Text>
            </View>
            <Text style={[styles.timeAgo, isDone && styles.textDone]}>
              {timeAgo}
            </Text>
          </View>
        </View>
      </View>

      {/* Right: Action or Done */}
      <View style={styles.itemRight}>
        {isDone ? (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark" size={16} color="#34c759" />
          </View>
        ) : action ? (
          <Pressable
            style={[
              styles.actionButton,
              action.style === 'primary' && styles.actionButtonPrimary,
            ]}
            onPress={handleActionPress}
          >
            <Text style={[
              styles.actionButtonText,
              action.style === 'primary' && styles.actionButtonTextPrimary,
            ]}>
              {action.label}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={action.style === 'primary' ? '#000' : '#fff'}
            />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  )
})

BoardItem.displayName = 'BoardItem'

// ============================================
// MAIN COMPONENT
// ============================================

export function FulfillmentBoard() {
  const { vendor, locations } = useAppAuth()
  const orders = useFilteredOrders()
  const loading = useOrdersLoading()
  const connectionState = useConnectionState()
  const { refreshOrders } = useOrdersActions()
  const selectedOrderId = useSelectedOrderId()
  const { selectOrder, openShipModal } = useOrdersUIActions()
  const { selectedLocationIds } = useLocationFilter()

  const [showDone, setShowDone] = useState(false)

  // Connection status for subtitle
  const connectionLabel = connectionState === 'connected' ? 'Live' :
    connectionState === 'connecting' ? 'Connecting...' :
    connectionState === 'reconnecting' ? 'Reconnecting...' : ''

  // Location button label
  const locationButtonLabel = selectedLocationIds.length === 0
    ? 'All Locations'
    : selectedLocationIds.length === 1
      ? locations.find(l => l.id === selectedLocationIds[0])?.name || '1 Location'
      : `${selectedLocationIds.length} Locations`

  // ============================================
  // TRANSFORM ORDERS INTO BOARD ITEMS
  // ============================================

  const { activeItems, doneItems, activeCount, doneCount } = useMemo(() => {
    // Filter to only pickup + shipping orders (not walk_in)
    // EXCLUDE cancelled orders - they're not actionable and shouldn't clutter the board
    const fulfillmentOrders = orders.filter(o =>
      (o.order_type === 'pickup' || o.order_type === 'shipping') &&
      o.status !== 'cancelled'
    )

    const items: BoardOrder[] = fulfillmentOrders.map(order => {
      const isPickup = order.order_type === 'pickup'
      const isShipping = order.order_type === 'shipping'

      // Determine if done (cancelled excluded above, so not needed here)
      const isDone =
        order.status === 'completed' ||
        order.status === 'delivered' ||
        order.status === 'shipped' ||
        order.status === 'in_transit'

      // Determine the ONE action for this order
      let action: OrderAction | null = null

      if (!isDone) {
        if (order.status === 'pending') {
          action = {
            label: 'Start',
            handler: () => {
              useOrdersStore.getState().updateOrderStatus(order.id, 'confirmed')
            },
            style: 'secondary',
          }
        } else if (order.status === 'confirmed' || order.status === 'preparing') {
          action = {
            label: 'Ready',
            handler: () => {
              useOrdersStore.getState().updateOrderStatus(order.id, 'ready')
            },
            style: 'secondary',
          }
        } else if (order.status === 'ready' || order.status === 'packed' || order.status === 'ready_to_ship') {
          if (isPickup) {
            action = {
              label: 'Picked Up',
              handler: () => {
                useOrdersStore.getState().updateOrderStatus(order.id, 'completed')
              },
              style: 'primary',
            }
          } else {
            action = {
              label: 'Ship',
              handler: () => {
                openShipModal(order.id, null)
              },
              style: 'primary',
            }
          }
        }
      }

      return {
        order,
        action,
        isDone,
        timeAgo: formatTimestamp(order.created_at),
        typeIcon: isPickup ? 'storefront' : 'cube',
        typeLabel: isPickup ? 'Pickup' : 'Ship',
      }
    })

    // Split and sort
    const active = items
      .filter(i => !i.isDone)
      .sort((a, b) => new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime())

    const done = items
      .filter(i => i.isDone)
      .sort((a, b) => new Date(b.order.updated_at || b.order.created_at).getTime() -
                      new Date(a.order.updated_at || a.order.created_at).getTime())
      .slice(0, 50) // Limit done items for performance

    return {
      activeItems: active,
      doneItems: done,
      activeCount: active.length,
      doneCount: done.length,
    }
  }, [orders, openShipModal])

  // ============================================
  // HANDLERS
  // ============================================

  const handleItemPress = useCallback((orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    selectOrder(orderId)
  }, [selectOrder])

  const toggleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowDone(prev => !prev)
  }, [])

  const { openLocationSelector } = useOrdersUIActions()

  // ============================================
  // RENDER
  // ============================================

  const renderItem = useCallback(({ item }: { item: BoardOrder }) => (
    <BoardItem
      item={item}
      onPress={() => handleItemPress(item.order.id)}
      isSelected={selectedOrderId === item.order.id}
      onAction={item.action?.handler || (() => {})}
    />
  ), [handleItemPress, selectedOrderId])

  const keyExtractor = useCallback((item: BoardOrder) => item.order.id, [])

  // Build the list data
  const listData = useMemo(() => {
    const data: (BoardOrder | { type: 'header', title: string } | { type: 'done-toggle' })[] = []

    // Active section header
    if (activeCount > 0) {
      data.push({ type: 'header', title: `ACTION NEEDED (${activeCount})` })
      data.push(...activeItems)
    }

    // Done toggle
    if (doneCount > 0) {
      data.push({ type: 'done-toggle' })
      if (showDone) {
        data.push(...doneItems)
      }
    }

    return data
  }, [activeItems, doneItems, activeCount, doneCount, showDone])

  const renderListItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      )
    }

    if (item.type === 'done-toggle') {
      return (
        <Pressable style={styles.doneToggle} onPress={toggleDone}>
          <View style={styles.doneToggleLeft}>
            <Ionicons name="checkmark-circle" size={18} color="#34c759" />
            <Text style={styles.doneToggleText}>Done Today ({doneCount})</Text>
          </View>
          <Ionicons
            name={showDone ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="rgba(255,255,255,0.4)"
          />
        </Pressable>
      )
    }

    return renderItem({ item })
  }, [renderItem, toggleDone, doneCount, showDone])

  const listKeyExtractor = useCallback((item: any, index: number) => {
    if (item.type === 'header') return `header-${item.title}`
    if (item.type === 'done-toggle') return 'done-toggle'
    return item.order.id
  }, [])

  // Header component with live indicator
  const subtitle = connectionLabel
    ? `${activeCount} active • ${doneCount} done • ${connectionLabel}`
    : `${activeCount} active • ${doneCount} done`

  const ListHeader = useMemo(() => (
    <>
      <TitleSection
        title="Fulfillment"
        logo={vendor?.logo_url}
        subtitle={subtitle}
        hideButton
      />
      <OrderFilterBar showLocationFilter={true} />
    </>
  ), [vendor?.logo_url, subtitle])

  // Empty state
  if (!loading && activeCount === 0 && doneCount === 0) {
    return (
      <View style={styles.container}>
        {ListHeader}
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>No Orders</Text>
          <Text style={styles.emptyText}>
            Pickup and shipping orders will appear here
          </Text>
        </View>
      </View>
    )
  }

  return (
    <FlatList
      data={listData}
      renderItem={renderListItem}
      keyExtractor={listKeyExtractor}
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
      updateCellsBatchingPeriod={50}
      initialNumToRender={15}
      windowSize={5}
      removeClippedSubviews={true}
    />
  )
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: layout.dockHeight,
  },

  // Section Headers
  sectionHeader: {
    paddingHorizontal: layout.containerMargin + 4,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },

  // Board Item
  boardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: layout.containerMargin,
    marginBottom: spacing.xs,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
  },
  boardItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  boardItemDone: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  // Item Left (Avatar + Info)
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDone: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  avatarTextDone: {
    color: 'rgba(255,255,255,0.3)',
  },
  itemInfo: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  itemCount: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  timeAgo: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  textDone: {
    color: 'rgba(255,255,255,0.3)',
  },

  // Item Right (Action)
  itemRight: {
    marginLeft: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
  },
  actionButtonPrimary: {
    backgroundColor: '#fff',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextPrimary: {
    color: '#000',
  },
  doneBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(52,199,89,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Done Toggle
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: layout.containerMargin,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderRadius: radius.md,
  },
  doneToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  doneToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34c759',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
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
  },
})
