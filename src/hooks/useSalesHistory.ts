/**
 * useSalesHistory Hook
 * Fetch sales history and stats for products
 */

import { useState, useEffect } from 'react'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { fetchSalesHistory, getSalesStats, type SalesRecord, type SalesStats } from '@/services/sales-history.service'
import { logger } from '@/utils/logger'

export interface UseSalesHistoryOptions {
  startDate?: string
  endDate?: string
  locationId?: string
  orderType?: string
}

export function useSalesHistory(
  productId?: string,
  options: UseSalesHistoryOptions = {}
) {
  const { vendor } = useAppAuth()
  const [sales, setSales] = useState<SalesRecord[]>([])
  const [stats, setStats] = useState<SalesStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!vendor?.id) return

    const loadSalesData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch sales records
        const { data: records, error: fetchError } = await fetchSalesHistory(vendor.id, {
          product_id: productId,
          start_date: options.startDate,
          end_date: options.endDate,
          location_id: options.locationId,
          order_type: options.orderType,
        })

        if (fetchError) {
          throw fetchError
        }

        setSales(records || [])

        // Fetch stats
        const statsData = await getSalesStats(
          vendor.id,
          productId,
          options.startDate,
          options.endDate
        )

        setStats(statsData)
      } catch (err) {
        logger.error('[useSalesHistory] Error loading sales data:', err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSalesData()
  }, [vendor?.id, productId, options.startDate, options.endDate, options.locationId, options.orderType])

  return {
    sales,
    stats,
    isLoading,
    error,
  }
}
