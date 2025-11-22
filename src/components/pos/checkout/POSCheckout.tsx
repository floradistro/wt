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
import { useModalState } from '@/hooks/pos'
import { useCampaigns } from '@/hooks/useCampaigns'

// Stores (ZERO PROP DRILLING)
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { useAuthStore } from '@/stores/auth.store'
import { useCartItems, useCartTotals, cartActions } from '@/stores/cart.store'
import { useSelectedDiscountId, checkoutUIActions } from '@/stores/checkout-ui.store'
import { paymentActions } from '@/stores/payment.store'
import { taxActions } from '@/stores/tax.store'
import { usePOSSession, posSessionActions } from '@/stores/posSession.store'
import { useCustomerState, customerActions } from '@/stores/customer.store'
import { useLoyaltyState, loyaltyActions } from '@/stores/loyalty.store'
import { useProducts } from '@/stores/products.store'

// Types
import type { Vendor, Product, SessionInfo, CartItem } from '@/types/pos'
import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

// ========================================
// ZERO PROP DRILLING COMPONENT ✅
// ========================================
export function POSCheckout() {
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
  // STORES
  // ========================================
  // POS Session (eliminates prop drilling)
  const { sessionInfo, vendor, customUserId } = usePOSSession()

  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const authSession = useAuthStore((state) => state.session)

  // ========================================
  // STORES - Customer & Loyalty (ZERO PROP DRILLING)
  // ========================================
  const { selectedCustomer, scannedData: scannedDataForNewCustomer, matches: customerMatches } = useCustomerState()
  const { loyaltyProgram, pointsToRedeem: loyaltyPointsToRedeem } = useLoyaltyState()
  const loyaltyDiscountAmount = loyaltyActions.getDiscountAmount()

  // Products
  const products = useProducts()

  // ========================================
  // MODALS
  // ========================================
  const { openModal, closeModal, isModalOpen } = useModalState()

  // ========================================
  // CART STATE (for payment processing)
  // ========================================
  const cart = useCartItems()
  const { subtotal, itemCount } = useCartTotals()
  const selectedDiscountId = useSelectedDiscountId()

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

  // Extract sessionInfo properties for stable dependencies
  const locationId = sessionInfo?.locationId
  const sessionId = sessionInfo?.sessionId

  // Tax calculation from tax store (location-aware)
  const { taxAmount, taxRate, taxName } = useMemo(() => {
    if (!locationId) {
      return { taxAmount: 0, taxRate: 0.08, taxName: 'Sales Tax' }
    }
    return taxActions.calculateTax(subtotalAfterDiscount, locationId)
  }, [subtotalAfterDiscount, locationId])

  const total = subtotalAfterDiscount + taxAmount

  // Load tax config when location changes
  React.useEffect(() => {
    if (locationId) {
      taxActions.loadTaxConfig(locationId)
    }
  }, [locationId])

  const loyaltyPointsEarned = useMemo(() => {
    if (!selectedCustomer) return 0
    const pointValue = loyaltyProgram?.point_value || 1.0
    return Math.floor(total / pointValue)
  }, [total, loyaltyProgram, selectedCustomer])

  // ========================================
  // HANDLERS - Customer Selection (ZERO PROP DRILLING)
  // ========================================
  const handleNoMatchFoundWithData = useCallback(async (data: AAMVAData) => {
    customerActions.setScannedData(data)

    const { customer, matchType } = await customerActions.findMatchingCustomer(data)

    if (customer && matchType) {
      const match = customerActions.createCustomerMatch(customer, matchType)

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
    logger.debug('🛒 POSCheckout: Opening payment modal')
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
      const { data: session, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, opening_cash')
        .eq('id', sessionId)
        .single()

      if (error || !session) {
        logger.error('[END SESSION] Error loading session data:', error)
        return
      }

      logger.debug('[END SESSION] Session data loaded:', session)

      setSessionData({
        sessionNumber: session.session_number,
        totalSales: session.total_sales || 0,
        totalCash: session.total_cash || 0,
        openingCash: session.opening_cash || 0,
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
    if (!sessionInfo || !vendor || !customUserId) {
      throw new Error('Missing session information')
    }

    logger.debug('💰 POSCheckout: Processing payment via Payment Store')

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
            loyaltyActions.resetLoyalty()
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

  // Override handleClearCustomer to also reset loyalty
  const handleClearCustomerWithLoyalty = useCallback(() => {
    customerActions.clearCustomer()
    loyaltyActions.resetLoyalty()
  }, [])

  const handleCloseDrawerSubmit = async (closingCash: number, notes: string) => {
    try {
      // Use posSession store action instead of inline RPC
      await posSessionActions.closeCashDrawer(closingCash, notes)

      closeModal()
      cartActions.clearCart()
      loyaltyActions.resetLoyalty()
    } catch (error) {
      logger.error('Error closing session:', error)
      // Error handling already done in store (haptics, etc.)
    }
  }

  const handleCloseDrawerCancel = () => {
    closeModal()
  }

  // ========================================
  // RENDER
  // ========================================
  // Apple Principle: Fail fast with clear contract
  if (!sessionInfo || !vendor || !customUserId) {
    logger.warn('POSCheckout: Missing session data from store')
    return null
  }

  return (
    <View style={styles.container}>
      {/* All Modals - Extracted to POSCheckoutModals (REFACTORED) */}
      <POSCheckoutModals
        isModalOpen={isModalOpen}
        closeModal={closeModal}
        scannedDataForNewCustomer={scannedDataForNewCustomer}
        customerMatches={customerMatches}
        selectedCustomer={selectedCustomer}
        onCustomerSelected={customerActions.selectCustomer}
        onNoMatchFoundWithData={handleNoMatchFoundWithData}
        onOpenAddCustomer={() => openModal('addCustomer')}
        onOpenCustomerMatch={() => openModal('customerMatch')}
        onOpenCustomerSelector={() => openModal('customerSelector')}
        onClearScannedData={customerActions.clearScannedData}
        onClearCustomerMatches={customerActions.clearCustomerMatches}
        onSetCustomerMatches={customerActions.setCustomerMatches}
        total={total}
        subtotal={subtotal}
        taxAmount={taxAmount}
        taxRate={taxRate}
        loyaltyDiscountAmount={loyaltyDiscountAmount}
        loyaltyPointsEarned={loyaltyPointsEarned}
        itemCount={itemCount}
        loyaltyProgram={loyaltyProgram}
        getMaxRedeemablePoints={(subtotal: number) => {
          if (!selectedCustomer) return 0
          const maxFromSubtotal = loyaltyActions.getMaxRedeemablePoints(subtotal)
          return Math.min(selectedCustomer.loyalty_points, maxFromSubtotal)
        }}
        onPaymentComplete={handlePaymentComplete}
        onApplyLoyaltyPoints={loyaltyActions.setPointsToRedeem}
        sessionData={sessionData}
        onCloseDrawerSubmit={handleCloseDrawerSubmit}
        onCloseDrawerCancel={handleCloseDrawerCancel}
        errorModal={errorModal}
        onCloseErrorModal={() => setErrorModal({ visible: false, title: '', message: '' })}
      />

      {/* Cart Display - ZERO PROPS ✅ */}
      <POSCart />
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
