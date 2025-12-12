/**
 * useInventoryAdjustments Hook
 *
 * Fetches and manages inventory adjustments (audits) for the current vendor
 * Zero Prop Drilling: Components fetch their own data
 */

import { useState, useEffect, useCallback } from 'react'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { logger } from '@/utils/logger'
import {
  fetchInventoryAdjustments,
  createInventoryAdjustment,
  type InventoryAdjustment,
  type AdjustmentFilters,
  type CreateAdjustmentInput,
} from '@/services/inventory-adjustments.service'
import { useAuditRefreshTrigger } from '@/stores/products-list.store'

export interface UseInventoryAdjustmentsResult {
  adjustments: InventoryAdjustment[]
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
  createAdjustment: (input: Omit<CreateAdjustmentInput, 'product_id' | 'location_id'> & { product_id?: string; location_id?: string }) => Promise<{
    data: InventoryAdjustment | null;
    error: any;
    metadata?: {
      quantity_before: number;
      quantity_after: number;
      product_total_stock: number;
    }
  }>
  vendorId: string | undefined
  stats: {
    totalAdjustments: number
    totalValue: number
  }
}

export function useInventoryAdjustments(
  productId?: string,
  locationId?: string,
  additionalFilters: AdjustmentFilters = {}
): UseInventoryAdjustmentsResult {
  const { vendor } = useAppAuth()
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([])
  const [stats, setStats] = useState({
    totalAdjustments: 0,
    totalValue: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Watch for refresh trigger from store (for live updates after audit creation)
  const refreshTrigger = useAuditRefreshTrigger()

  // Merge productId and locationId with additional filters
  const filters = {
    ...additionalFilters,
    ...(productId && { product_id: productId }),
    ...(locationId && { location_id: locationId }),
  }

  const loadAdjustments = useCallback(async () => {
    if (!vendor?.id) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await fetchInventoryAdjustments(vendor.id, filters)

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch adjustments')
      }

      const adjustmentsData = data || []
      setAdjustments(adjustmentsData)

      // Calculate stats
      setStats({
        totalAdjustments: adjustmentsData.length,
        totalValue: adjustmentsData.reduce((sum, adj) => sum + Math.abs(adj.quantity_change), 0),
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load adjustments'
      logger.error('Failed to load inventory adjustments', {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      })
      setError(errorMessage)
      setAdjustments([])
    } finally {
      setIsLoading(false)
    }
  }, [vendor?.id, filters.product_id, filters.location_id, filters.adjustment_type, filters.start_date, filters.end_date])

  // Load adjustments on mount, filter changes, and refresh trigger
  useEffect(() => {
    loadAdjustments()
  }, [loadAdjustments, refreshTrigger])

  const createAdjustment = useCallback(async (
    input: Omit<CreateAdjustmentInput, 'product_id' | 'location_id'> & { product_id?: string; location_id?: string }
  ) => {
    if (!vendor?.id) {
      const error = new Error('No vendor ID available')
      logger.error('Cannot create adjustment - no vendor ID', { error })
      return { data: null, error }
    }

    // Use provided product_id/location_id or fall back to hook params
    const fullInput: CreateAdjustmentInput = {
      ...input,
      product_id: input.product_id || productId!,
      location_id: input.location_id || locationId!,
    }

    const result = await createInventoryAdjustment(vendor.id, fullInput)

    // Reload adjustments after creating
    if (result.data) {
      await loadAdjustments()
    }

    return result
  }, [vendor?.id, productId, locationId, loadAdjustments])

  return {
    adjustments,
    isLoading,
    error,
    reload: loadAdjustments,
    createAdjustment,
    vendorId: vendor?.id,
    stats,
  }
}
