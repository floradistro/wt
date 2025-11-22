/**
 * PurchaseOrdersViewWrapper Component
 * Apple Standard: Clean wrapper for purchase orders functionality
 *
 * Delegates to PurchaseOrdersList component
 */

import React, { useRef } from 'react'
import { Animated } from 'react-native'
import { PurchaseOrdersList } from '@/components/purchase-orders'
import type { PurchaseOrder } from '@/services/purchase-orders.service'

interface PurchaseOrdersViewWrapperProps {
  purchaseOrders: PurchaseOrder[]
  selectedPO: PurchaseOrder | null
  onSelect: (po: PurchaseOrder) => void
  isLoading: boolean
  onAddPress: () => void
  vendorLogo?: string | null
}

export function PurchaseOrdersViewWrapper({
  purchaseOrders,
  selectedPO,
  onSelect,
  isLoading,
  onAddPress,
  vendorLogo,
}: PurchaseOrdersViewWrapperProps) {
  const headerOpacity = useRef(new Animated.Value(0)).current

  return (
    <PurchaseOrdersList
      purchaseOrders={purchaseOrders}
      selectedPO={selectedPO}
      onSelect={onSelect}
      isLoading={isLoading}
      headerOpacity={headerOpacity}
      onAddPress={onAddPress}
      vendorLogo={vendorLogo}
    />
  )
}
