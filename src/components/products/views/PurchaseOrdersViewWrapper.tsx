/**
 * PurchaseOrdersViewWrapper Component - Simplified
 * Clean wrapper for purchase orders functionality
 *
 * ZERO PROP DRILLING ✅
 * - PurchaseOrdersList fetches its own data using usePurchaseOrders hook
 */

import React from 'react'
import { PurchaseOrdersList } from '@/components/purchase-orders'

/**
 * PurchaseOrdersViewWrapper - ZERO PROPS ✅
 */
export function PurchaseOrdersViewWrapper() {
  return <PurchaseOrdersList />
}
