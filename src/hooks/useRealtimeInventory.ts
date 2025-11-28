/**
 * useRealtimeInventory Hook
 *
 * APPLE PRINCIPLE: Instant feedback without page refresh
 *
 * This hook automatically subscribes to real-time inventory updates
 * for a specific location and unsubscribes on unmount.
 *
 * Usage:
 * ```tsx
 * function ProductsScreen() {
 *   const sessionInfo = useSessionInfo()
 *
 *   // ✅ Automatic subscription management
 *   useRealtimeInventory(sessionInfo.locationId)
 *
 *   // Products will update automatically when inventory changes
 *   const products = useProducts()
 * }
 * ```
 */

import { useEffect } from 'react'
import { productsActions } from '@/stores/products.store'
import { logger } from '@/utils/logger'

export function useRealtimeInventory(locationId: string | null | undefined) {
  useEffect(() => {
    if (!locationId) {
      logger.debug('[useRealtimeInventory] No location ID, skipping subscription')
      return
    }

    logger.info('[useRealtimeInventory] Setting up real-time inventory for location:', locationId)

    // Subscribe to inventory updates
    productsActions.subscribeToInventoryUpdates(locationId)

    // Cleanup: Unsubscribe when component unmounts or location changes
    return () => {
      logger.info('[useRealtimeInventory] Cleaning up real-time inventory subscription')
      productsActions.unsubscribeFromInventoryUpdates()
    }
  }, [locationId])
}
