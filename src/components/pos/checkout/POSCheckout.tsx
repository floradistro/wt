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

// POS Components
import { POSCart } from '../cart/POSCart'
import { POSCheckoutModals } from './POSCheckoutModals'

// Hooks
import { useLoyalty } from '@/hooks/pos'
import { useCustomerSelection } from '@/hooks/pos/useCustomerSelection'
import { useCampaigns } from '@/hooks/useCampaigns'
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
  const { subtotal, itemCount } = useCartTotals()
  const selectedDiscountId = useSelectedDiscountId()

  const {
    loyaltyProgram,
    loyaltyPointsToRedeem,
    setLoyaltyPointsToRedeem,
    resetLoyalty,
    getMaxRedeemablePoints,
    loyaltyDiscountAmount,
  } = useLoyalty()

  // Get active discounts
  const { campaigns: discounts } = useCampaigns()
  const activeDiscounts = useMemo(() =>
    discounts.filter(d => d.is_active),
    [discounts]
  )

  // Get selected discount
  const selectedDiscount = useMemo(() =>
    activeDiscounts.find(d => d.id === selectedDiscountId) || null,
    [activeDiscounts, selectedDiscountId]
  )

  // ========================================
  // CALCULATIONS
  // ========================================
  const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscountAmount)

  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0

    if (selectedDiscount.discount_type === 'percentage') {
      return subtotalAfterLoyalty * (selectedDiscount.discount_value / 100)
    } else {
      return Math.min(selectedDiscount.discount_value, subtotalAfterLoyalty)
    }
  }, [selectedDiscount, subtotalAfterLoyalty])

  const subtotalAfterDiscount = Math.max(0, subtotalAfterLoyalty - discountAmount)

  // Extract session properties for stable dependencies
  const locationId = session?.locationId
  const sessionId = session?.sessionId

  // Tax calculation - use apiConfig from Context
  const taxAmount = useMemo(() => {
    const rate = apiConfig?.taxRate || 0.08
    return subtotalAfterDiscount * rate
  }, [subtotalAfterDiscount, apiConfig?.taxRate])

  const taxRate = apiConfig?.taxRate || 0.08
  const taxName = apiConfig?.taxName || 'Sales Tax'

  const total = subtotalAfterDiscount + taxAmount

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
      const { data: sessionRecord, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, opening_cash')
        .eq('id', sessionId)
        .single()

      if (error || !sessionRecord) {
        logger.error('[END SESSION] Error loading session data:', error)
        return
      }

      logger.debug('[END SESSION] Session data loaded:', sessionRecord)

      setSessionData({
        sessionNumber: sessionRecord.session_number,
        totalSales: sessionRecord.total_sales || 0,
        totalCash: sessionRecord.total_cash || 0,
        openingCash: sessionRecord.opening_cash || 0,
      })

      logger.debug('[END SESSION] Opening close drawer modal')
      openModal('cashDrawerClose')
    } catch (error) {
      logger.error('[END SESSION] Error in handleEndSession:', error)
    }
  }, [sessionId, openModal])

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
      // Call payment store to process payment
      const completionData = await paymentActions.processPayment({
        paymentData,
        cart,
        subtotal,
        taxAmount,
        total,
        itemCount,
        sessionInfo,
        vendor,
        customUserId,
        selectedCustomer,
        loyaltyPointsToRedeem,
        loyaltyDiscountAmount,
        discountAmount,
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
    } catch (error) {
      // Error modal handling
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
        loyaltyDiscountAmount={loyaltyDiscountAmount}
        loyaltyPointsEarned={loyaltyPointsEarned}
        itemCount={itemCount}
        loyaltyProgram={loyaltyProgram}
        getMaxRedeemablePoints={getMaxRedeemablePoints}
        onPaymentComplete={handlePaymentComplete}
        onApplyLoyaltyPoints={setLoyaltyPointsToRedeem}
        sessionData={sessionData}
        onCloseDrawerSubmit={handleCloseDrawerSubmit}
        onCloseDrawerCancel={handleCloseDrawerCancel}
        errorModal={errorModal}
        onCloseErrorModal={() => setErrorModal({ visible: false, title: '', message: '' })}
      />

      {/* Cart Display - Minimal Props (from 30+ to 11) - Zero prop drilling for products! */}
      <POSCart
        selectedCustomer={selectedCustomer}
        loyaltyPointsToRedeem={loyaltyPointsToRedeem}
        loyaltyProgram={loyaltyProgram}
        loyaltyDiscountAmount={loyaltyDiscountAmount}
        maxRedeemablePoints={getMaxRedeemablePoints(subtotal)}
        onSelectCustomer={handleSelectCustomer}
        onClearCustomer={handleClearCustomerWithLoyalty}
        onSetLoyaltyPoints={setLoyaltyPointsToRedeem}
        onCheckout={handleCheckout}
        onEndSession={handleEndSessionClick}
        taxRate={taxRate}
      />
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
