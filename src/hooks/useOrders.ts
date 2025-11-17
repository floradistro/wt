/**
 * Orders Hook
 *
 * React hook for managing orders using Supabase directly.
 * Replaces API calls to /api/orders
 */

import { useState, useEffect, useCallback } from 'react'
import { ordersService, type Order, type CreateOrderParams } from '@/services'
import { logger } from '@/utils/logger'

export interface UseOrdersOptions {
  limit?: number
  status?: string
  customerId?: string
  autoLoad?: boolean // Auto-load on mount
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { limit = 20, status, customerId, autoLoad = true } = options

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Load orders with current filters
   */
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await ordersService.getOrders({ limit, status, customerId })
      setOrders(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load orders:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, status, customerId])

  /**
   * Load today's orders (for POS)
   */
  const loadTodaysOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await ordersService.getTodaysOrders()
      setOrders(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load today\'s orders:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get single order by ID
   */
  const getOrderById = useCallback(async (orderId: string) => {
    try {
      setLoading(true)
      setError(null)
      return await ordersService.getOrderById(orderId)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load order:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create new order
   */
  const createOrder = useCallback(async (params: CreateOrderParams) => {
    try {
      setLoading(true)
      setError(null)
      const newOrder = await ordersService.createOrder(params)

      // Add to local state
      setOrders((prev) => [newOrder, ...prev])

      return newOrder
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to create order:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update order status
   */
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: Order['status']) => {
      try {
        setLoading(true)
        setError(null)
        await ordersService.updateOrderStatus(orderId, newStatus)

        // Update local state
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        )
      } catch (err) {
        setError(err as Error)
        logger.error('Failed to update order status:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Update payment status
   */
  const updatePaymentStatus = useCallback(
    async (
      orderId: string,
      paymentStatus: Order['payment_status'],
      transactionData?: { transactionId: string; authorizationCode?: string }
    ) => {
      try {
        setLoading(true)
        setError(null)
        await ordersService.updatePaymentStatus(orderId, paymentStatus, transactionData)

        // Update local state
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, payment_status: paymentStatus } : order
          )
        )
      } catch (err) {
        setError(err as Error)
        logger.error('Failed to update payment status:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Search orders
   */
  const searchOrders = useCallback(async (searchTerm: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await ordersService.searchOrders(searchTerm)
      setOrders(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to search orders:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Refresh orders
   */
  const refresh = useCallback(() => {
    loadOrders()
  }, [loadOrders])

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadOrders()
    }
  }, [autoLoad, loadOrders])

  return {
    // State
    orders,
    loading,
    error,

    // Actions
    loadOrders,
    loadTodaysOrders,
    getOrderById,
    createOrder,
    updateOrderStatus,
    updatePaymentStatus,
    searchOrders,
    refresh,
  }
}

/**
 * Hook for managing a single order
 */
export function useOrder(orderId: string | null) {
  const [order, setOrder] = useState<(Order & { items: any[] }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setOrder(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await ordersService.getOrderById(orderId)
      setOrder(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load order:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  return {
    order,
    loading,
    error,
    reload: loadOrder,
  }
}
