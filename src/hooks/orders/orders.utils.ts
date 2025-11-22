/**
 * Orders Utility Functions
 * Helper functions for date filtering, grouping, and formatting
 */

import { type Order } from '@/services/orders.service'

export type DateRange = 'today' | 'week' | 'month' | 'all'

/**
 * Get the date filter cutoff for a given date range
 */
export function getDateRangeFilter(range: DateRange): Date | null {
  const now = new Date()
  switch (range) {
    case 'today':
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      return today
    case 'week':
      const week = new Date(now)
      week.setDate(now.getDate() - 7)
      return week
    case 'month':
      const month = new Date(now)
      month.setDate(now.getDate() - 30)
      return month
    case 'all':
      return null
  }
}

/**
 * Group orders by date categories (Today, Yesterday, This Week, Older)
 */
export function groupOrdersByDate(orders: Order[]) {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(today.getDate() - 7)

  const groups: { title: string; data: Order[] }[] = []
  const todayOrders: Order[] = []
  const yesterdayOrders: Order[] = []
  const thisWeekOrders: Order[] = []
  const olderOrders: Order[] = []

  orders.forEach(order => {
    const orderDate = new Date(order.created_at)
    if (orderDate >= today) {
      todayOrders.push(order)
    } else if (orderDate >= yesterday) {
      yesterdayOrders.push(order)
    } else if (orderDate >= thisWeekStart) {
      thisWeekOrders.push(order)
    } else {
      olderOrders.push(order)
    }
  })

  if (todayOrders.length > 0) {
    groups.push({ title: 'Today', data: todayOrders })
  }
  if (yesterdayOrders.length > 0) {
    groups.push({ title: 'Yesterday', data: yesterdayOrders })
  }
  if (thisWeekOrders.length > 0) {
    groups.push({ title: 'This Week', data: thisWeekOrders })
  }
  if (olderOrders.length > 0) {
    groups.push({ title: 'Older', data: olderOrders })
  }

  return groups
}

/**
 * Get the status style color for an order
 */
export function getStatusStyle(status: Order['status']) {
  switch (status) {
    case 'completed':
      return { color: '#34c759' }
    case 'preparing':
      return { color: '#0a84ff' }
    case 'ready':
    case 'out_for_delivery':
      return { color: '#bf5af2' }
    case 'cancelled':
      return { color: '#ff3b30' }
    default:
      return { color: '#ff9500' }
  }
}

/**
 * Get the human-friendly order type label
 */
export function getOrderTypeLabel(order: Order): string {
  const type = order.delivery_type || order.order_type || 'instore'
  switch (type.toLowerCase()) {
    case 'pickup':
      return 'Pickup'
    case 'delivery':
    case 'shipping':
      return 'Delivery'
    default:
      return 'In-Store'
  }
}
