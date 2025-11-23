/**
 * POSCheckoutModals Component - Apple Engineering Standard
 * Jobs Principle: Manage all modal interactions for checkout
 *
 * TRUE ZERO PROPS ✅✅✅
 * - Reads ALL state from stores - no props needed
 * - Registers ALL action handlers in store on mount
 * - Modals have ZERO props - read state and call actions from store
 *
 * Handles:
 * - Customer selector modal
 * - Customer match modal
 * - Add customer modal
 * - Payment modal
 * - Close cash drawer modal
 * - Error modal
 */

import { useCallback, useMemo, useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'

import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import type { Customer } from '@/types/pos'

// POS Components - ALL REFACTORED TO ZERO PROPS
import { POSUnifiedCustomerSelector } from '../POSUnifiedCustomerSelector'
import { POSAddCustomerModal } from '../POSAddCustomerModal'
import { POSCustomerMatchModal } from '../POSCustomerMatchModal'
import POSPaymentModal from '../POSPaymentModal'
import { CloseCashDrawerModal } from '../CloseCashDrawerModal'
import { POSStaffDiscountModal } from '../POSStaffDiscountModal'
import { ErrorModal } from '@/components/ErrorModal'

// Stores - All state from stores (ZERO PROP DRILLING)
import { usePOSSession, posSessionActions } from '@/stores/posSession.store'
import { useCartItems, useCartTotals, cartActions } from '@/stores/cart.store'
import { useErrorModal, checkoutUIActions, useCheckoutUIStore } from '@/stores/checkout-ui.store'
import { useSelectedDiscountId } from '@/stores/checkout-ui.store'
import { useCustomerState, customerActions } from '@/stores/customer.store'
import { useLoyaltyState, loyaltyActions } from '@/stores/loyalty.store'
import { taxActions } from '@/stores/tax.store'
import { paymentActions } from '@/stores/payment.store'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { useAuthStore } from '@/stores/auth.store'
import { useCampaigns } from '@/stores/loyalty-campaigns.store'

export function POSCheckoutModals() {
  // ========================================
  // STORES - Read ALL state (ZERO PROP DRILLING)
  // ========================================
  const errorModal = useErrorModal()

  const { vendor, sessionInfo, customUserId } = usePOSSession()
  const cart = useCartItems()
  const { subtotal, itemCount } = useCartTotals()
  const selectedDiscountId = useSelectedDiscountId()

  // Customer & Loyalty
  const { selectedCustomer } = useCustomerState()
  const { loyaltyProgram, pointsToRedeem: loyaltyPointsToRedeem } = useLoyaltyState()
  const loyaltyDiscountAmount = loyaltyActions.getDiscountAmount()

  // Payment processor
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const authSession = useAuthStore((state) => state.session)

  // Discounts
  const campaigns = useCampaigns()
  const activeDiscounts = useMemo(() =>
    campaigns.filter(d => d.is_active),
    [campaigns]
  )
  const selectedDiscount = useMemo(() =>
    activeDiscounts.find(d => d.id === selectedDiscountId) || null,
    [activeDiscounts, selectedDiscountId]
  )

  // Modal actions
  const openModal = checkoutUIActions.openModal
  const closeModal = checkoutUIActions.closeModal

  // ========================================
  // CALCULATIONS (same as POSCheckout)
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

  const locationId = sessionInfo?.locationId
  const sessionId = sessionInfo?.sessionId

  // Tax calculation from tax store
  const { taxAmount, taxRate, taxName } = useMemo(() => {
    if (!locationId) {
      return { taxAmount: 0, taxRate: 0.08, taxName: 'Sales Tax' }
    }
    return taxActions.calculateTax(subtotalAfterDiscount, locationId)
  }, [subtotalAfterDiscount, locationId])

  const total = subtotalAfterDiscount + taxAmount

  // ========================================
  // HANDLERS - Customer Selection
  // ========================================
  const handleNoMatchFoundWithData = useCallback(async (data: AAMVAData) => {
    customerActions.setScannedData(data)

    const { customer, matchType } = await customerActions.findMatchingCustomer(data)

    if (customer && matchType) {
      const match = customerActions.createCustomerMatch(customer, matchType)

      if (matchType === 'exact') {
        customerActions.setCustomerMatches([match])
        closeModal()
        openModal('customerMatch')
      } else {
        customerActions.setCustomerMatches([match])
        closeModal()
        openModal('customerMatch')
      }
    } else {
      closeModal()
      openModal('addCustomer')
    }
  }, [closeModal, openModal])

  // ========================================
  // HANDLERS - Payment
  // ========================================
  const handlePaymentComplete = useCallback(async (paymentData: PaymentData): Promise<SaleCompletionData> => {
    if (!sessionInfo || !vendor || !customUserId) {
      throw new Error('Missing session information')
    }

    logger.debug('💰 POSCheckoutModals: Processing payment via Payment Store')

    try {
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
          setTimeout(() => {
            cartActions.clearCart()
            customerActions.clearCustomer()
            loyaltyActions.resetLoyalty()
          }, 100)
        },
      })

      return completionData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process sale'
      const isTimeout = errorMessage.includes('timed out')

      closeModal()

      checkoutUIActions.setErrorModal(
        true,
        isTimeout ? 'Connection Timeout' : 'Checkout Error',
        errorMessage
      )

      throw error
    }
  }, [cart, subtotal, taxAmount, total, itemCount, sessionInfo, vendor, customUserId, selectedCustomer, loyaltyPointsToRedeem, loyaltyDiscountAmount, discountAmount, selectedDiscountId, currentProcessor, closeModal])

  // ========================================
  // HANDLERS - Session Close
  // ========================================
  const handleCloseDrawerSubmit = useCallback(async (closingCash: number, notes: string) => {
    try {
      await posSessionActions.closeCashDrawer(closingCash, notes)
      closeModal()
      cartActions.clearCart()
      loyaltyActions.resetLoyalty()
    } catch (error) {
      logger.error('Error closing session:', error)
    }
  }, [closeModal])

  const handleCloseDrawerCancel = useCallback(() => {
    closeModal()
  }, [closeModal])

  // ========================================
  // REGISTER HANDLERS - TRUE ZERO PROPS
  // ========================================
  // Register all modal handlers in store
  // IMPORTANT: Include ALL dependencies to prevent stale closures!
  useEffect(() => {
    checkoutUIActions.registerModalHandlers({
      // Customer selection handlers
      handleCustomerSelected: (customer: Customer) => {
        customerActions.selectCustomer(customer)
        closeModal()
      },
      handleNoMatchFoundWithData: handleNoMatchFoundWithData,
      handleCustomerCreated: (customer: Customer) => {
        customerActions.selectCustomer(customer)
        customerActions.clearScannedData()
        closeModal()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      },
      handleAddCustomer: () => {
        closeModal()
        openModal('addCustomer')
      },
      handleSelectMatch: (customer: Customer) => {
        customerActions.selectCustomer(customer)
        customerActions.clearCustomerMatches()
        customerActions.clearScannedData()
        closeModal()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      },
      handleCreateNewCustomer: () => {
        customerActions.clearCustomerMatches()
        closeModal()
        openModal('addCustomer')
      },
      handleSearchManually: () => {
        customerActions.clearCustomerMatches()
        customerActions.clearScannedData()
        closeModal()
        openModal('customerSelector')
      },

      // Payment handlers
      handlePaymentComplete: handlePaymentComplete,
      handlePaymentCancel: closeModal,

      // Close drawer handlers
      handleCloseDrawerSubmit: handleCloseDrawerSubmit,
      handleCloseDrawerCancel: handleCloseDrawerCancel,
    })
  }, [handlePaymentComplete, handleNoMatchFoundWithData, handleCloseDrawerSubmit, closeModal, openModal])

  // ========================================
  // RENDER
  // ========================================
  // Guard: Ensure session data exists
  if (!vendor || !sessionInfo) {
    return null
  }

  // SAFETY: Force close any stuck modals on mount
  // IMPORTANT: Only close modals that POSCheckoutModals is responsible for
  // DO NOT close session setup modals (registerSelector, cashDrawerOpen)
  useEffect(() => {
    logger.debug('🔍 [POSCheckoutModals] MOUNTING - Running safety check')
    const state = useCheckoutUIStore.getState()

    logger.debug('🔍 [POSCheckoutModals] Current modal state:', {
      activeModal: state.activeModal,
      errorModalVisible: state.errorModal.visible
    })

    // List of modals that POSCheckoutModals manages
    const checkoutModals = ['customerSelector', 'customerMatch', 'addCustomer', 'payment', 'cashDrawerClose']

    // Check for stuck activeModal (only checkout modals, NOT session modals)
    if (state.activeModal && checkoutModals.includes(state.activeModal)) {
      logger.error('❌ CHECKOUT MODAL STUCK OPEN ON MOUNT:', state.activeModal, '- Force closing')
      checkoutUIActions.closeModal()
    } else if (state.activeModal) {
      logger.debug('✅ [POSCheckoutModals] Ignoring non-checkout modal:', state.activeModal, '(belongs to session setup)')
    } else {
      logger.debug('✅ [POSCheckoutModals] No stuck modals detected')
    }

    // Check for stuck error modal
    if (state.errorModal.visible) {
      logger.error('❌ ERROR MODAL STUCK OPEN ON MOUNT - Force closing')
      checkoutUIActions.setErrorModal(false)
    }

    return () => {
      logger.debug('🔍 [POSCheckoutModals] UNMOUNTING')
    }
  }, [])

  return (
    <>
      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        onPrimaryPress={() => checkoutUIActions.setErrorModal(false)}
        variant="error"
      />

      {/* TRUE ZERO PROPS ✅✅✅ - All modals read from store and call store actions */}
      <POSUnifiedCustomerSelector />
      <POSCustomerMatchModal />
      <POSAddCustomerModal />
      <POSPaymentModal />
      <CloseCashDrawerModal />
      <POSStaffDiscountModal />
    </>
  )
}
