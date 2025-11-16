import { useState, useEffect } from 'react'
import type { LoyaltyProgram, Customer } from '@/types/pos'

export function useLoyalty(vendorId: string | null, selectedCustomer: Customer | null) {
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null)
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)

  /**
   * Load loyalty program settings from API
   */
  useEffect(() => {
    const loadLoyaltyProgram = async () => {
      if (!vendorId) {
        return
      }

      try {
        const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

        const response = await fetch(`${BASE_URL}/api/vendor/loyalty/program`, {
          headers: {
            'x-vendor-id': vendorId,
          },
        })

        if (response.ok) {
          const data = await response.json()
          setLoyaltyProgram(data.program)
        }
      } catch (_error) {
        // Silently fail - loyalty is optional
      }
    }

    loadLoyaltyProgram()
  }, [vendorId])

  /**
   * Reset loyalty points when customer changes
   */
  useEffect(() => {
    setLoyaltyPointsToRedeem(0)
  }, [selectedCustomer?.id])

  /**
   * Calculate loyalty discount amount
   * Use default point value of $0.01 if loyalty program not loaded
   */
  const loyaltyDiscountAmount = loyaltyPointsToRedeem * (loyaltyProgram?.point_value || 0.01)

  /**
   * Calculate maximum redeemable points based on subtotal
   */
  const getMaxRedeemablePoints = (subtotal: number): number => {
    if (!selectedCustomer) return 0

    // Use loyalty program point value if available, otherwise default to $0.01 per point
    const pointValue = loyaltyProgram?.point_value || 0.01
    const maxPointsFromSubtotal = Math.floor(subtotal / pointValue)
    const maxRedeemable = Math.min(selectedCustomer.loyalty_points, maxPointsFromSubtotal)

    return maxRedeemable
  }

  /**
   * Reset loyalty state
   */
  const resetLoyalty = () => {
    setLoyaltyPointsToRedeem(0)
  }

  return {
    // State
    loyaltyProgram,
    loyaltyPointsToRedeem,

    // Actions
    setLoyaltyPointsToRedeem,
    resetLoyalty,
    getMaxRedeemablePoints,

    // Computed
    loyaltyDiscountAmount,
  }
}
