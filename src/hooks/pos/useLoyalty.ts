/**
 * useLoyaltyTransaction - POS Loyalty Transaction Hook - ZERO PROPS ✅
 *
 * ZERO PROP DRILLING:
 * - No vendorId prop - reads from customer.store
 * - No selectedCustomer prop - reads from customer.store
 * - Manages loyalty point redemption during checkout
 */

import { useState, useEffect, useCallback } from 'react'
import type { LoyaltyProgram, Customer } from '@/types/pos'
import { loyaltyService } from '@/services'
import { logger } from '@/utils/logger'
import { supabase } from '@/lib/supabase/client'
import { useCustomerStore } from '@/stores/customer.store'

export function useLoyaltyTransaction() {
  // ========================================
  // STORE - TRUE ZERO PROPS (read from environment)
  // ========================================
  const vendorId = useCustomerStore((state) => state.vendorId)
  const selectedCustomer = useCustomerStore((state) => state.selectedCustomer)
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null)
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0)

  /**
   * Load loyalty program settings from Supabase
   */
  const loadLoyaltyProgram = useCallback(async () => {
    if (!vendorId) {
      return
    }

    try {
      const program = await loyaltyService.getLoyaltyProgram(vendorId)
      setLoyaltyProgram(program)
    } catch (error) {
      // Silently fail - loyalty is optional
      logger.error('Failed to load loyalty program:', error)
    }
  }, [vendorId])

  useEffect(() => {
    loadLoyaltyProgram()
  }, [loadLoyaltyProgram])

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!vendorId) return

    logger.debug('[useLoyaltyTransaction] Setting up real-time subscription')

    // Subscribe to loyalty_programs changes
    const channel = supabase
      .channel('loyalty-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'loyalty_programs',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          logger.debug('[useLoyaltyTransaction] Real-time update:', payload)
          // Reload loyalty program when any change occurs
          loadLoyaltyProgram()
        }
      )
      .subscribe()

    return () => {
      logger.debug('[useLoyaltyTransaction] Cleaning up real-time subscription')
      supabase.removeChannel(channel)
    }
  }, [vendorId, loadLoyaltyProgram])

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
    const maxRedeemable = Math.min(selectedCustomer.loyalty_points ?? 0, maxPointsFromSubtotal)

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

// Export both names for backwards compatibility
export const useLoyalty = useLoyaltyTransaction
