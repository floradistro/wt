/**
 * usePurchaseOrders Hook
 *
 * Fetches and manages purchase orders for the current vendor
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import {
  getPurchaseOrders,
  getPurchaseOrderStats,
  type PurchaseOrder,
  type PurchaseOrderType,
  type PurchaseOrderStatus,
} from '@/services/purchase-orders.service'

export interface UsePurchaseOrdersParams {
  type?: PurchaseOrderType
  status?: PurchaseOrderStatus
  locationIds?: string[]
  search?: string
}

export interface UsePurchaseOrdersResult {
  purchaseOrders: PurchaseOrder[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
  stats: {
    total: number
    draft: number
    pending: number
    received: number
    totalValue: number
  }
}

export function usePurchaseOrders(params: UsePurchaseOrdersParams = {}): UsePurchaseOrdersResult {
  const { user } = useAuth()
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    pending: 0,
    received: 0,
    totalValue: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPurchaseOrders = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get vendor ID from user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) {
        throw new Error(`Failed to fetch user data: ${userError.message}`)
      }

      if (!userData?.vendor_id) {
        throw new Error('User is not associated with a vendor')
      }

      // Fetch purchase orders with filters
      const pos = await getPurchaseOrders(params)

      // Filter by vendor_id (additional security layer)
      const vendorPos = pos.filter(po => po.vendor_id === userData.vendor_id)

      setPurchaseOrders(vendorPos)

      // Fetch stats
      const statsData = await getPurchaseOrderStats({
        locationIds: params.locationIds,
      })

      setStats(statsData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load purchase orders'
      logger.error('Failed to load purchase orders', { error: err })
      setError(errorMessage)
      setPurchaseOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.email, params.type, params.status, params.locationIds, params.search])

  useEffect(() => {
    loadPurchaseOrders()
  }, [loadPurchaseOrders])

  return {
    purchaseOrders,
    isLoading,
    error,
    reload: loadPurchaseOrders,
    stats,
  }
}
