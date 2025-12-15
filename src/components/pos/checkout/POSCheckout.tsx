/* eslint-disable react-hooks/preserve-manual-memoization */
/**
 * POSCheckout Component (REFACTORED)
 * Jobs Principle: One focused responsibility - Checkout orchestration
 *
 * REFACTORED: Extracted customer selection and modal logic to improve maintainability
 * Now handles:
 * - Cart display and management
 * - Payment processing coordination
 * - Checkout flow orchestration
 *
 * Extracted to:
 * - useCustomerSelection hook (customer logic)
 * - POSCheckoutModals component (modal UI)
 */

import React, { useState, useCallback, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { recordCashDrop, getDrawerBalance, getSafeBalance } from '@/services/cash-management.service'

// POS Components
import { POSCart } from '../cart/POSCart'
import { POSCheckoutModals } from './POSCheckoutModals'

// Hooks
import { useCustomerSelection } from '@/hooks/pos/useCustomerSelection'
import { useCampaigns, useLoyaltyState, loyaltyActions } from '@/stores/loyalty-campaigns.store'
import { useCheckoutTotals } from '@/hooks/useCheckoutTotals'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { useAuthStore } from '@/stores/auth.store'
import { useCartItems, useCartTotals, cartActions } from '@/stores/cart.store'
import { useSelectedDiscountId, checkoutUIActions, useActiveModal } from '@/stores/checkout-ui.store'
import { useSelectedCustomer, useScannedDataForNewCustomer, useCustomerMatches, customerActions } from '@/stores/customer.store'
import { paymentActions } from '@/stores/payment.store'
import { taxActions } from '@/stores/tax.store'

// Context - Zero prop drilling!
import { useAppAuth } from '@/contexts/AppAuthContext'
import { usePOSSession } from '@/contexts/POSSessionContext'

// Types
import type { Vendor, Product, SessionInfo, CartItem } from '@/types/pos'
import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

interface POSCheckoutProps {
  onCheckoutComplete?: () => void
}

export function POSCheckout({
  onCheckoutComplete,
}: POSCheckoutProps) {
  // ========================================
  // STATE
  // ========================================
  const [errorModal, setErrorModal] = useState<{
    visible: boolean
    title: string
    message: string
  }>({
    visible: false,
    title: '',
    message: '',
  })

  // Session end state
  const [sessionData, setSessionData] = useState<{
    sessionNumber: string
    totalSales: number
    totalCash: number
    openingCash: number
    totalCashDrops: number
    // Shift performance metrics
    shiftStart: Date | null
    transactionCount: number
    averageTransaction: number
    cardSales: number
    auditsCompleted: number
  } | null>(null)

  // Cash drop state
  const [cashDropData, setCashDropData] = useState<{
    drawerBalance: number
    safeBalance: number
  } | null>(null)

  // ========================================
  // CONTEXT - Zero prop drilling!
  // ========================================
  const { vendor } = useAppAuth()
  const { session, apiConfig, customUserId, closeCashDrawer } = usePOSSession()

  // ========================================
  // STORES
  // ========================================
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const authSession = useAuthStore((state) => state.session)

  // ========================================
  // CUSTOMER STATE - Read from store (ZERO PROP DRILLING)
  // ========================================
  const selectedCustomer = useSelectedCustomer()
  const scannedDataForNewCustomer = useScannedDataForNewCustomer()
  const customerMatches = useCustomerMatches()

  // ========================================
  // HOOKS - Customer Selection Logic
  // ========================================
  const {
    findMatchingCustomer,
    createCustomerMatch,
  } = useCustomerSelection()

  // ========================================
  // MODALS - Use checkout-ui store (same as POSUnifiedCustomerSelector)
  // ========================================
  const activeModal = useActiveModal()
  const openModal = checkoutUIActions.openModal
  const closeModal = checkoutUIActions.closeModal
  const isModalOpen = (id: string) => activeModal === id

  // ========================================
  // CART STATE (for payment processing)
  // ========================================
  const cart = useCartItems()
  const { itemCount } = useCartTotals() // Only need itemCount, rest comes from useCheckoutTotals
  const selectedDiscountId = useSelectedDiscountId()

  // ========================================
  // SINGLE SOURCE OF TRUTH - Use centralized hook ✅
  // ========================================
  const {
    total,
    subtotal,
    taxAmount,
    taxRate,
    taxName,
    loyaltyDiscount: loyaltyDiscountAmount,
    campaignDiscount: discountAmount,
    subtotalAfterDiscounts,
  } = useCheckoutTotals()

  // Loyalty state from store (same as slider)
  const { loyaltyProgram, pointsToRedeem } = useLoyaltyState()
  const loyaltyPointsToRedeem = pointsToRedeem

  // Loyalty actions
  const setLoyaltyPointsToRedeem = loyaltyActions.setPointsToRedeem
  const resetLoyalty = loyaltyActions.resetLoyalty

  // Calculate max redeemable points
  const getMaxRedeemablePoints = (subtotal: number): number => {
    if (!selectedCustomer) return 0
    const pointValue = loyaltyProgram?.point_value || 0.01
    const maxPointsFromSubtotal = Math.floor(subtotal / pointValue)
    return Math.min(selectedCustomer.loyalty_points ?? 0, maxPointsFromSubtotal)
  }

  // Get active discounts from store
  const discounts = useCampaigns()
  const activeDiscounts = useMemo(() =>
    discounts.filter(d => d.is_active),
    [discounts]
  )

  // Get selected discount
  const selectedDiscount = useMemo(() =>
    activeDiscounts.find(d => d.id === selectedDiscountId) || null,
    [activeDiscounts, selectedDiscountId]
  )

  // Extract session properties for stable dependencies
  const locationId = session?.locationId
  const sessionId = session?.sessionId

  const loyaltyPointsEarned = useMemo(() => {
    if (!selectedCustomer) return 0
    const pointValue = loyaltyProgram?.point_value || 1.0
    return Math.floor(total / pointValue)
  }, [total, loyaltyProgram, selectedCustomer])

  // ========================================
  // HANDLERS - Customer Selection (REFACTORED)
  // ========================================
  const handleNoMatchFoundWithData = useCallback(async (data: AAMVAData) => {
    customerActions.setScannedData(data)

    const { customer, matchType} = await findMatchingCustomer(data)

    if (customer && matchType) {
      const match = createCustomerMatch(customer, matchType)

      if (matchType === 'exact') {
        // Exact match - show confirmation
        customerActions.setCustomerMatches([match])
        closeModal()
        openModal('customerMatch')
      } else {
        // High confidence - show confirmation
        customerActions.setCustomerMatches([match])
        closeModal()
        openModal('customerMatch')
      }
    } else {
      // No match found - go to add customer
      closeModal()
      openModal('addCustomer')
    }
  }, [
    findMatchingCustomer,
    createCustomerMatch,
    closeModal,
    openModal,
  ])

  // ========================================
  // HANDLERS - Checkout Flow (MEMOIZED to prevent POSCart re-renders)
  // ========================================
  const handleSelectCustomer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    openModal('customerSelector')
  }, [openModal])

  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    openModal('payment')
  }, [cart.length, openModal])

  const handleEndSessionClick = useCallback(async () => {
    logger.debug('[END SESSION] Button clicked in POSCheckout')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (!sessionId) {
      logger.error('[END SESSION] No session ID found!')
      return
    }

    try {
      logger.debug('[END SESSION] Loading session data for ID:', sessionId)

      // Fetch session data with card sales
      const { data: sessionRecord, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, total_card, opening_cash, total_cash_drops, opened_at')
        .eq('id', sessionId)
        .single()

      if (error || !sessionRecord) {
        logger.error('[END SESSION] Error loading session data:', error)
        return
      }

      // Count transactions for this session
      const { count: transactionCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('pos_session_id', sessionId)

      // Count audits completed during this shift
      const { count: auditsCount } = await supabase
        .from('inventory_adjustments')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .gte('created_at', sessionRecord.opened_at)

      const totalSales = sessionRecord.total_sales || 0
      const txCount = transactionCount || 0
      const avgTransaction = txCount > 0 ? totalSales / txCount : 0

      logger.debug('[END SESSION] Session data loaded:', sessionRecord)

      setSessionData({
        sessionNumber: sessionRecord.session_number,
        totalSales,
        totalCash: sessionRecord.total_cash || 0,
        openingCash: sessionRecord.opening_cash || 0,
        totalCashDrops: sessionRecord.total_cash_drops || 0,
        shiftStart: sessionRecord.opened_at ? new Date(sessionRecord.opened_at) : null,
        transactionCount: txCount,
        averageTransaction: avgTransaction,
        cardSales: sessionRecord.total_card || 0,
        auditsCompleted: auditsCount || 0,
      })

      logger.debug('[END SESSION] Opening close drawer modal')
      openModal('cashDrawerClose')
    } catch (error) {
      logger.error('[END SESSION] Error in handleEndSession:', error)
    }
  }, [sessionId, openModal])

  // ========================================
  // HANDLERS - Cash Drop
  // ========================================
  const handleCashDropClick = useCallback(async () => {
    logger.debug('[CASH DROP] Button clicked')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (!sessionId || !session?.locationId) {
      logger.error('[CASH DROP] No session or location ID found!')
      return
    }

    try {
      // Get current drawer and safe balances
      const [drawerBalance, safeBalance] = await Promise.all([
        getDrawerBalance(sessionId),
        getSafeBalance(session.locationId),
      ])

      logger.debug('[CASH DROP] Balances loaded:', { drawerBalance, safeBalance })

      setCashDropData({
        drawerBalance,
        safeBalance,
      })

      openModal('cashDrop')
    } catch (error) {
      logger.error('[CASH DROP] Error loading balances:', error)
    }
  }, [sessionId, session?.locationId, openModal])

  const handleCashDropSubmit = useCallback(async (amount: number, notes: string) => {
    logger.debug('[CASH DROP] Submitting drop:', { amount, notes })

    if (!vendor?.id || !session?.locationId || !session?.registerId || !sessionId) {
      logger.error('[CASH DROP] Missing session data')
      return
    }

    try {
      const result = await recordCashDrop({
        vendorId: vendor.id,
        locationId: session.locationId,
        registerId: session.registerId,
        sessionId,
        amount,
        notes,
        userId: customUserId || undefined,
      })

      if (result.success) {
        logger.info('[CASH DROP] Successfully recorded:', result)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Update session data to reflect new cash drop total
        if (sessionData) {
          setSessionData({
            ...sessionData,
            totalCashDrops: sessionData.totalCashDrops + amount,
          })
        }
      } else {
        logger.error('[CASH DROP] Failed:', result.error)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (error) {
      logger.error('[CASH DROP] Error recording drop:', error)
    }

    setCashDropData(null)
    closeModal()

    // Re-open close drawer modal if we came from there
    if (sessionData) {
      openModal('cashDrawerClose')
    }
  }, [vendor?.id, session?.locationId, session?.registerId, sessionId, customUserId, closeModal, sessionData, openModal])

  const handleCashDropCancel = useCallback(() => {
    setCashDropData(null)
    closeModal()

    // Re-open close drawer modal if we came from there
    if (sessionData) {
      openModal('cashDrawerClose')
    }
  }, [closeModal, sessionData, openModal])

  /**
   * Payment processing using Payment Store
   * All payment logic now centralized in payment.store.ts for:
   * - State machine visibility in Redux DevTools
   * - Clean separation of concerns
   * - Testable payment logic
   * - AI-accessible payment processing
   */
  const handlePaymentComplete = async (paymentData: PaymentData): Promise<SaleCompletionData> => {
    if (!session || !vendor || !customUserId) {
      throw new Error('Missing session information')
    }

    // Validate session fields are present
    logger.debug('💰 POSCheckout: Session validation', {
      hasSession: !!session,
      locationId: session.locationId,
      registerId: session.registerId,
      sessionId: session.sessionId,
      vendorId: vendor?.id,
      hasCustomUserId: !!customUserId,
    })

    if (!session.locationId || !session.registerId || !session.sessionId) {
      logger.error('❌ Incomplete session data', {
        locationId: session.locationId,
        registerId: session.registerId,
        sessionId: session.sessionId,
      })
      throw new Error('Session incomplete. Please restart your POS session by selecting location and register again.')
    }

    if (!vendor.id) {
      logger.error('❌ Missing vendor ID')
      throw new Error('Vendor information missing. Please log out and log back in.')
    }

    logger.debug('💰 POSCheckout: Processing payment via Payment Store')

    // Convert POSSession to SessionInfo for payment store
    const sessionInfo: SessionInfo = {
      locationId: session.locationId,
      locationName: session.locationName,
      registerId: session.registerId,
      registerName: session.registerName,
      sessionId: session.sessionId,
      taxRate: apiConfig?.taxRate || 0.08,
      taxName: apiConfig?.taxName,
    }

    try {
      // DEBUG: Log all payment calculations
      logger.debug('💰 PAYMENT CALCULATIONS (from useCheckoutTotals hook):', {
        rawSubtotal: subtotal,
        loyaltyDiscountAmount,
        campaignDiscountAmount: discountAmount,
        subtotalAfterDiscounts,
        taxAmount,
        total,
        calculation: `${subtotal} - ${loyaltyDiscountAmount} - ${discountAmount} = ${subtotalAfterDiscounts} + ${taxAmount} tax = ${total}`,
      })

      // Call payment store to process payment
      const completionData = await paymentActions.processPayment({
        paymentData,
        cart,
        subtotal, // ✅ Raw cart subtotal (Edge Function validates this matches sum of line items)
        taxAmount,
        total,
        itemCount,
        sessionInfo,
        vendor,
        customUserId,
        selectedCustomer,
        loyaltyPointsToRedeem,
        loyaltyDiscountAmount,
        discountAmount, // Edge Function subtracts discounts to get final total
        selectedDiscountId,
        currentProcessor,
        onSuccess: () => {
          // Defer clearing state until after success modal animation starts
          // This prevents re-render lag during the animation
          setTimeout(() => {
            cartActions.clearCart()
            customerActions.clearCustomer()
            resetLoyalty()

            // Notify parent
            if (onCheckoutComplete) {
              onCheckoutComplete()
            }
          }, 100)
        },
      })

      return completionData
    } catch (error: any) {
      // Check if this is a partial success (Card 1 succeeded, Card 2 failed in multi-card)
      // Don't close modal or show error - let SplitCardPaymentView handle it
      if (error?.partialSuccess) {
        logger.info('[POSCheckout] Partial payment success - letting SplitCardPaymentView handle retry UI')
        throw error  // Re-throw so SplitCardPaymentView catches it
      }

      // Error modal handling for non-partial errors
      const errorMessage = error instanceof Error ? error.message : 'Failed to process sale'
      const isTimeout = errorMessage.includes('timed out')

      closeModal()

      setErrorModal({
        visible: true,
        title: isTimeout ? 'Connection Timeout' : 'Checkout Error',
        message: errorMessage,
      })

      throw error
    }
  }

  // Clear customer and reset loyalty
  const handleClearCustomerWithLoyalty = useCallback(() => {
    customerActions.clearCustomer()
    resetLoyalty()
  }, [resetLoyalty])

  const handleCloseDrawerSubmit = async (closingCash: number, notes: string) => {
    try {
      // Use Context action to close cash drawer
      await closeCashDrawer(closingCash, notes)

      closeModal()
      cartActions.clearCart()
      resetLoyalty()
    } catch (error) {
      logger.error('Error closing session:', error)
      // Error handling already done in Context (haptics, etc.)
    }
  }

  const handleCloseDrawerCancel = () => {
    closeModal()
  }

  // ========================================
  // RENDER
  // ========================================
  // Apple Principle: Fail fast with clear contract
  if (!session || !vendor || !customUserId) {
    logger.warn('POSCheckout: Missing session data from context')
    return null
  }

  return (
    <View style={styles.container}>
      {/* All Modals - TRUE ZERO PROPS (read from stores) */}
      <POSCheckoutModals
        onNoMatchFoundWithData={handleNoMatchFoundWithData}
        total={total}
        subtotal={subtotal}
        taxAmount={taxAmount}
        taxRate={taxRate}
        itemCount={itemCount}
        onPaymentComplete={handlePaymentComplete}
        sessionData={sessionData}
        onCloseDrawerSubmit={handleCloseDrawerSubmit}
        onCloseDrawerCancel={handleCloseDrawerCancel}
        onDropToSafe={handleCashDropClick}
        cashDropData={cashDropData}
        onCashDropSubmit={handleCashDropSubmit}
        onCashDropCancel={handleCashDropCancel}
        errorModal={errorModal}
        onCloseErrorModal={() => setErrorModal({ visible: false, title: '', message: '' })}
      />

      {/* Cart Display - Nearly zero props (just coordination callback) */}
      <POSCart onEndSession={handleEndSessionClick} />
    </View>
  )
}

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
