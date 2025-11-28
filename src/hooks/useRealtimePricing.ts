/**
 * useRealtimePricing Hook
 *
 * APPLE PRINCIPLE: Instant feedback without page refresh
 *
 * This hook automatically subscribes to real-time pricing template updates
 * for a vendor. When any pricing template is updated, ALL products refresh
 * instantly across all channels with zero manual refresh.
 *
 * Usage:
 * ```tsx
 * function POSScreen() {
 *   const { vendor } = useAppAuth()
 *
 *   // ✅ Automatic subscription management
 *   useRealtimePricing(vendor?.id)
 *
 *   // Products will update automatically when pricing changes
 *   const products = useProducts()
 * }
 * ```
 */

import { useEffect } from 'react'
import { productsActions } from '@/stores/products.store'
import { logger } from '@/utils/logger'

export function useRealtimePricing(vendorId: string | null | undefined) {
  useEffect(() => {
    if (!vendorId) {
      logger.debug('[useRealtimePricing] No vendor ID, skipping subscription')
      return
    }

    logger.info('[useRealtimePricing] 🔔 Setting up real-time pricing updates for vendor:', vendorId)

    // Subscribe to pricing updates
    productsActions.subscribeToPricingUpdates(vendorId)

    // Cleanup: Unsubscribe when component unmounts or vendor changes
    return () => {
      logger.info('[useRealtimePricing] Cleaning up real-time pricing subscription')
      productsActions.unsubscribeFromPricingUpdates()
    }
  }, [vendorId])
}
