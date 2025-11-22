/**
 * Loyalty Store
 * Jobs Principle: Single source of truth for loyalty points and rewards
 *
 * ANTI-LOOP DESIGN:
 * - ✅ All selectors ONLY return values (no setState, no calculations)
 * - ✅ All mutations happen in actions
 * - ✅ No subscriptions that call setState in the store itself
 * - ✅ No useEffects (stores don't use React hooks)
 * - ✅ Actions exported as plain objects with getters
 * - ✅ Realtime monitoring handled by external utility function
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { loyaltyService } from '@/services'
import { logger } from '@/utils/logger'
import type { LoyaltyProgram, Customer } from '@/types/pos'

// ========================================
// TYPES
// ========================================
interface LoyaltyState {
  // State
  loyaltyProgram: LoyaltyProgram | null
  pointsToRedeem: number
  vendorId: string | null
  selectedCustomerId: string | null
  loading: boolean
  error: string | null

  // Actions
  loadLoyaltyProgram: (vendorId: string) => Promise<void>
  setPointsToRedeem: (points: number) => void
  setVendorId: (vendorId: string) => void
  setSelectedCustomerId: (customerId: string | null) => void
  resetLoyalty: () => void

  // Computed getters (pure functions, no setState)
  getDiscountAmount: () => number
  getMaxRedeemablePoints: (subtotal: number) => number
  getPointsEarned: (total: number) => number
}

// ========================================
// STORE
// ========================================
// ANTI-LOOP: No useEffects, no subscriptions, no setState in selectors
export const useLoyaltyStore = create<LoyaltyState>((set, get) => ({
  // State
  loyaltyProgram: null,
  pointsToRedeem: 0,
  vendorId: null,
  selectedCustomerId: null,
  loading: false,
  error: null,

  // Actions
  loadLoyaltyProgram: async (vendorId: string) => {
    // ANTI-LOOP: Only updates state once at the end, no circular dependencies
    set({ loading: true, error: null })

    try {
      const program = await loyaltyService.getLoyaltyProgram(vendorId)
      set({
        loyaltyProgram: program,
        loading: false,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load loyalty program'
      logger.error('[Loyalty Store] Failed to load loyalty program:', error)
      set({
        error: errorMessage,
        loading: false,
      })
    }
  },

  setPointsToRedeem: (points: number) => {
    // ANTI-LOOP: Simple setState - no side effects
    set({ pointsToRedeem: points })
  },

  setVendorId: (vendorId: string) => {
    // ANTI-LOOP: Only sets value - no side effects
    // Components are responsible for calling loadLoyaltyProgram when needed
    set({ vendorId })
  },

  setSelectedCustomerId: (customerId: string | null) => {
    // ANTI-LOOP: Simple setState - no side effects
    // Reset points when customer changes
    set({
      selectedCustomerId: customerId,
      pointsToRedeem: 0, // Reset points when customer changes
    })
  },

  resetLoyalty: () => {
    // ANTI-LOOP: Simple setState - no side effects
    set({ pointsToRedeem: 0 })
  },

  // ========================================
  // COMPUTED GETTERS (ANTI-LOOP: Pure functions, NO setState)
  // ========================================
  /**
   * Calculate loyalty discount amount
   * ANTI-LOOP: Pure function - reads state, returns value, NO setState
   */
  getDiscountAmount: () => {
    const { pointsToRedeem, loyaltyProgram } = get()
    const pointValue = loyaltyProgram?.point_value || 0.01
    return pointsToRedeem * pointValue
  },

  /**
   * Calculate maximum redeemable points based on subtotal
   * ANTI-LOOP: Pure function - takes subtotal param, returns value, NO setState
   */
  getMaxRedeemablePoints: (subtotal: number) => {
    const { selectedCustomerId, loyaltyProgram } = get()

    if (!selectedCustomerId) return 0

    // Note: We need customer's current loyalty points from customer store
    // This function only calculates max based on subtotal
    // Component must pass customer.loyalty_points to compare
    const pointValue = loyaltyProgram?.point_value || 0.01
    const maxPointsFromSubtotal = Math.floor(subtotal / pointValue)

    return maxPointsFromSubtotal
  },

  /**
   * Calculate loyalty points earned from a purchase
   * ANTI-LOOP: Pure function - takes total param, returns value, NO setState
   */
  getPointsEarned: (total: number) => {
    const { loyaltyProgram, selectedCustomerId } = get()

    if (!selectedCustomerId) return 0

    const pointsPerDollar = loyaltyProgram?.points_per_dollar || 1.0
    return Math.floor(total * pointsPerDollar)
  },
}))

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================
// ✅ Primitive values - direct selectors (no useShallow needed)
export const useLoyaltyProgram = () =>
  useLoyaltyStore((state) => state.loyaltyProgram)

export const usePointsToRedeem = () =>
  useLoyaltyStore((state) => state.pointsToRedeem)

// ✅ Object return - use useShallow to prevent infinite re-renders
export const useLoyaltyState = () =>
  useLoyaltyStore(
    useShallow((state) => ({
      loyaltyProgram: state.loyaltyProgram,
      pointsToRedeem: state.pointsToRedeem,
      loading: state.loading,
      error: state.error,
    }))
  )

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters, NOT hooks)
// ========================================
// ✅ CORRECT: Direct action imports (no subscription loop)
export const loyaltyActions = {
  get loadLoyaltyProgram() { return useLoyaltyStore.getState().loadLoyaltyProgram },
  get setPointsToRedeem() { return useLoyaltyStore.getState().setPointsToRedeem },
  get setVendorId() { return useLoyaltyStore.getState().setVendorId },
  get setSelectedCustomerId() { return useLoyaltyStore.getState().setSelectedCustomerId },
  get resetLoyalty() { return useLoyaltyStore.getState().resetLoyalty },
  get getDiscountAmount() { return useLoyaltyStore.getState().getDiscountAmount },
  get getMaxRedeemablePoints() { return useLoyaltyStore.getState().getMaxRedeemablePoints },
  get getPointsEarned() { return useLoyaltyStore.getState().getPointsEarned },
}

// ========================================
// REALTIME MONITORING (ANTI-LOOP: External utility, not in store)
// ========================================
let loyaltyRealtimeChannel: any = null

/**
 * Start realtime monitoring for loyalty program changes
 * ANTI-LOOP: This is an external utility that components can call
 * It sets up a subscription that calls the store's loadLoyaltyProgram action
 *
 * Components should call this in a useEffect with vendorId as dependency
 */
export function startLoyaltyRealtimeMonitoring(vendorId: string) {
  // Clean up existing subscription
  if (loyaltyRealtimeChannel) {
    supabase.removeChannel(loyaltyRealtimeChannel)
    loyaltyRealtimeChannel = null
  }

  if (!vendorId) return

  logger.debug('[Loyalty Store] Starting real-time monitoring for vendor:', vendorId)

  // Subscribe to loyalty_programs changes
  loyaltyRealtimeChannel = supabase
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
        logger.debug('[Loyalty Store] Real-time update:', payload)
        // ANTI-LOOP: Call the action directly, no circular dependencies
        loyaltyActions.loadLoyaltyProgram(vendorId)
      }
    )
    .subscribe()
}

/**
 * Stop realtime monitoring
 */
export function stopLoyaltyRealtimeMonitoring() {
  if (loyaltyRealtimeChannel) {
    logger.debug('[Loyalty Store] Stopping real-time monitoring')
    supabase.removeChannel(loyaltyRealtimeChannel)
    loyaltyRealtimeChannel = null
  }
}
