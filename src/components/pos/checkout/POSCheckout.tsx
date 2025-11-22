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

import { useState, useCallback, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase/client'
import { validateRealPaymentData, normalizePaymentMethod, validatePaymentMethod } from '@/utils/payment-validation'
import { Sentry } from '@/utils/sentry'
import { logger } from '@/utils/logger'

// POS Components
import { POSCart } from '../cart/POSCart'
import { POSCheckoutModals } from './POSCheckoutModals'

// Hooks
import { useLoyalty, useModalState } from '@/hooks/pos'
import { useCustomerSelection } from '@/hooks/pos/useCustomerSelection'
import { useCampaigns } from '@/hooks/useCampaigns'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { useAuthStore } from '@/stores/auth.store'
import type { UseCartReturn } from '@/hooks/pos/useCart'

// Types
import type { Vendor, Product, SessionInfo, CartItem } from '@/types/pos'
import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

interface POSCheckoutProps {
  sessionInfo: SessionInfo
  vendor: Vendor
  products: Product[]
  customUserId: string
  cartHook: UseCartReturn
  onEndSession: () => void
  onCheckoutComplete?: () => void
}

export function POSCheckout({
  sessionInfo,
  vendor,
  products,
  customUserId,
  cartHook,
  onEndSession,
  onCheckoutComplete,
}: POSCheckoutProps) {
  // ========================================
  // STATE
  // ========================================
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null)
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
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const authSession = useAuthStore((state) => state.session)

  // ========================================
  // HOOKS - Customer Selection (REFACTORED)
  // ========================================
  const {
    selectedCustomer,
    scannedDataForNewCustomer,
    customerMatches,
    setSelectedCustomer,
    handleClearCustomer,
    handleCustomerSelected,
    handleScannedDataReceived,
    clearScannedData,
    handleCustomerMatchesFound,
    clearCustomerMatches,
    findMatchingCustomer,
    createCustomerMatch,
  } = useCustomerSelection(vendor.id)

  // ========================================
  // MODALS
  // ========================================
  const { openModal, closeModal, isModalOpen } = useModalState()

  // ========================================
  // CART, LOYALTY & DISCOUNTS
  // ========================================
  const {
    cart,
    discountingItemId,
    addToCart,
    updateQuantity,
    changeTier,
    applyManualDiscount,
    removeManualDiscount,
    clearCart,
    setDiscountingItemId,
    subtotal,
    itemCount,
  } = cartHook

  const {
    loyaltyProgram,
    loyaltyPointsToRedeem,
    setLoyaltyPointsToRedeem,
    resetLoyalty,
    getMaxRedeemablePoints,
    loyaltyDiscountAmount,
  } = useLoyalty(vendor?.id || null, selectedCustomer)

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
  const taxRate = sessionInfo?.taxRate || 0.08
  const taxAmount = subtotalAfterDiscount * taxRate
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
    handleScannedDataReceived(data)

    const { customer, matchType } = await findMatchingCustomer(data)

    if (customer && matchType) {
      const match = createCustomerMatch(customer, matchType)

      if (matchType === 'exact') {
        // Exact match - show confirmation
        handleCustomerMatchesFound([match])
        closeModal()
        openModal('customerMatch')
      } else {
        // High confidence - show confirmation
        handleCustomerMatchesFound([match])
        closeModal()
        openModal('customerMatch')
      }
    } else {
      // No match found - go to add customer
      closeModal()
      openModal('addCustomer')
    }
  }, [
    handleScannedDataReceived,
    findMatchingCustomer,
    createCustomerMatch,
    handleCustomerMatchesFound,
    closeModal,
    openModal,
  ])

  // ========================================
  // HANDLERS - Checkout Flow
  // ========================================
  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return
    logger.debug('🛒 POSCheckout: Opening payment modal')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    openModal('payment')
  }, [cart.length, openModal])

  /**
   * Two-Phase Commit Checkout Flow
   *
   * Processes payment and creates order using atomic database operations to ensure
   * data consistency. Implements enterprise-grade error handling with Sentry tracking.
   *
   * **Architecture:** Serverless Edge Function with atomic inventory management
   *
   * **Process:**
   * 1. Validate payment data (prevent mock payments in production)
   * 2. Prepare order items with pricing, discounts, and inventory IDs
   * 3. Call Edge Function (`process-checkout`) which atomically:
   *    - Creates order record
   *    - Deducts inventory
   *    - Updates loyalty points
   *    - Updates session totals
   * 4. Show success animation + print receipt
   *
   * **Error Handling:**
   * - All errors captured in Sentry with full context
   * - Atomic rollback on any failure
   * - User-friendly error messages
   *
   * @param paymentData - Validated payment information (card/cash)
   * @returns Sale completion data with order ID, receipt, and loyalty info
   * @throws {Error} If session info missing or Edge Function fails
   *
   * @see supabase/functions/process-checkout - Atomic checkout implementation
   */
  const handlePaymentComplete = async (paymentData: PaymentData): Promise<SaleCompletionData> => {
    if (!sessionInfo || !vendor || !customUserId) {
      throw new Error('Missing session information')
    }

    logger.debug('💰 POSCheckout: Processing payment with TWO-PHASE COMMIT', paymentData)

    // Set checkout context
    Sentry.setContext('checkout', {
      total,
      subtotal,
      taxAmount,
      itemCount,
      paymentMethod: paymentData.paymentMethod,
      hasCustomer: !!selectedCustomer,
      customerId: selectedCustomer?.id,
      vendorId: vendor.id,
      locationId: sessionInfo.locationId,
      sessionId: sessionInfo.sessionId,
      hasLoyaltyPoints: loyaltyPointsToRedeem > 0,
      loyaltyPointsToRedeem,
      loyaltyDiscountAmount,
      architecture: 'two_phase_commit_edge_function',
    })

    Sentry.addBreadcrumb({
      category: 'checkout',
      message: 'Starting two-phase commit checkout',
      level: 'info',
      data: {
        total,
        itemCount,
        paymentMethod: paymentData.paymentMethod,
        hasCustomer: !!selectedCustomer,
      },
    })

    try {
      // CRITICAL VALIDATION: Ensure payment data is real, not mocked
      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Validating payment data',
        level: 'info',
      })
      validateRealPaymentData(paymentData)

      const items = cart.map((item: CartItem) => ({
        productId: item.productId,
        productName: item.productName || item.name,
        productSku: item.sku || item.productSku || '',
        unitPrice: item.adjustedPrice !== undefined ? item.adjustedPrice : item.price,
        quantity: item.quantity,
        tierName: item.tierName || item.tier || '1 Unit',
        discountAmount: item.manualDiscountValue || 0,
        lineTotal: (item.adjustedPrice !== undefined ? item.adjustedPrice : item.price) * item.quantity,
        inventoryId: item.inventoryId,
      }))

      // Normalize payment method for database constraint
      const normalizedPaymentMethod = normalizePaymentMethod(paymentData.paymentMethod)

      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Validating payment method',
        level: 'info',
        data: {
          originalMethod: paymentData.paymentMethod,
          normalizedMethod: normalizedPaymentMethod,
        },
      })
      validatePaymentMethod(normalizedPaymentMethod)

      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Calling Edge Function: process-payment',
        level: 'info',
        data: {
          itemCount: items.length,
          total,
          paymentMethod: normalizedPaymentMethod,
        },
      })

      // Get FRESH session from Supabase
      logger.debug('🔄 Refreshing session before payment...')
      const { data: { session: freshSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !freshSession) {
        logger.error('Failed to get fresh session:', sessionError)
        throw new Error('Authentication error. Please log out and log back in.')
      }

      if (!freshSession.access_token) {
        logger.error('Fresh session missing access_token')
        throw new Error('Invalid session. Please log out and log back in.')
      }

      logger.debug('✅ Fresh session obtained', {
        userId: freshSession.user?.id,
        tokenLength: freshSession.access_token.length,
        expiresAt: freshSession.expires_at,
      })

      // Call Edge Function with 90s timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        logger.warn('⏱️ Edge Function timeout (90s) - aborting request')
        controller.abort()
      }, 90000)

      const edgeFunctionPayload = {
        vendorId: vendor.id,
        locationId: sessionInfo.locationId,
        sessionId: sessionInfo.sessionId,
        registerId: sessionInfo.registerId,
        items,
        subtotal,
        taxAmount,
        total,
        paymentMethod: normalizedPaymentMethod,
        tipAmount: 0,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer
          ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          : 'Walk-In',
        loyaltyPointsRedeemed: loyaltyPointsToRedeem || 0,
        loyaltyDiscountAmount: loyaltyDiscountAmount || 0,
        campaignDiscountAmount: discountAmount || 0,
        campaignId: selectedDiscountId || null,
      }

      logger.debug('📤 Sending to Edge Function:', edgeFunctionPayload)

      const authHeader = `Bearer ${freshSession.access_token}`
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/process-checkout`

      logger.debug('🌐 Calling Edge Function (enterprise-grade):', {
        url: edgeFunctionUrl,
        hasAuthHeader: !!authHeader,
        hasAnonKey: !!supabaseAnonKey,
      })

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'apikey': supabaseAnonKey!,
        },
        body: JSON.stringify(edgeFunctionPayload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const responseText = await response.text()
      logger.debug('📨 Edge Function response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      })

      let data: any = null
      let edgeFunctionError: Error | null = null

      if (!response.ok) {
        logger.error('❌ Edge Function HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        })

        try {
          const errorData = JSON.parse(responseText)
          edgeFunctionError = new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`)
        } catch {
          edgeFunctionError = new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`)
        }
      } else {
        try {
          data = JSON.parse(responseText)
        } catch (e) {
          edgeFunctionError = new Error('Failed to parse response JSON')
        }
      }

      if (edgeFunctionError) {
        Sentry.addBreadcrumb({
          category: 'checkout',
          message: 'Edge Function error',
          level: 'error',
          data: {
            error: edgeFunctionError.message,
            errorDetails: JSON.stringify(edgeFunctionError),
            responseData: data,
          },
        })
        logger.error('Edge Function error details:', {
          message: edgeFunctionError.message,
          error: edgeFunctionError,
          data: data,
        })

        const errorMessage = data?.error || edgeFunctionError.message || 'Payment processing failed'
        throw new Error(errorMessage)
      }

      if (!data?.success) {
        Sentry.addBreadcrumb({
          category: 'checkout',
          message: 'Edge Function returned failure',
          level: 'error',
        })
        throw new Error(data?.error || 'Failed to create sale')
      }

      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Two-phase commit completed successfully',
        level: 'info',
        data: {
          orderNumber: data.data?.order?.order_number || data.data?.orderNumber,
          orderId: data.data?.order?.id || data.data?.orderId,
          status: data.data?.order?.status || data.data?.orderStatus,
        },
      })

      // Extract transaction details
      const orderNumber = data.data?.order?.order_number || data.data?.orderNumber || 'Unknown'
      const transactionNumber = `TXN-${orderNumber}`
      const loyaltyPointsAdded = loyaltyPointsEarned

      // Prepare completion data
      const completionData: SaleCompletionData = {
        orderNumber,
        transactionNumber,
        total,
        paymentMethod: paymentData.paymentMethod,
        authorizationCode: paymentData.authorizationCode,
        cardType: paymentData.cardType,
        cardLast4: paymentData.cardLast4,
        itemCount,
        processorName: currentProcessor?.processor_name,
        changeGiven: paymentData.changeGiven,
        loyaltyPointsAdded,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem || undefined,
      }

      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Sale completion data prepared',
        level: 'info',
        data: {
          orderNumber: completionData.orderNumber,
          loyaltyPointsAdded: completionData.loyaltyPointsAdded,
          loyaltyPointsRedeemed: completionData.loyaltyPointsRedeemed,
        },
      })

      // Clear cart and customer state
      clearCart()
      setSelectedCustomer(null)
      resetLoyalty()

      // Notify parent
      if (onCheckoutComplete) {
        onCheckoutComplete()
      }

      return completionData
    } catch (error) {
      logger.error('Checkout error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Checkout failed',
        level: 'error',
        data: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })

      Sentry.captureException(error, {
        level: 'error',
        contexts: {
          checkout: {
            total,
            subtotal,
            taxAmount,
            itemCount,
            paymentMethod: paymentData.paymentMethod,
            hasCustomer: !!selectedCustomer,
            customerId: selectedCustomer?.id,
            vendorId: vendor?.id,
            locationId: sessionInfo?.locationId,
            sessionId: sessionInfo?.sessionId,
            hasLoyaltyPoints: loyaltyPointsToRedeem > 0,
            loyaltyPointsToRedeem,
            loyaltyDiscountAmount,
          },
        },
        tags: {
          'checkout.operation': 'create_sale',
          'payment.method': paymentData.paymentMethod,
        },
      })

      // Close modal to reset state
      closeModal()

      const errorMessage = error instanceof Error ? error.message : 'Failed to process sale. Please try again or contact support.'
      const isTimeout = errorMessage.includes('timed out')

      logger.error('💥 Checkout failed:', {
        error: errorMessage,
        isTimeout,
        paymentMethod: paymentData.paymentMethod,
        total,
        hasCustomer: !!selectedCustomer,
      })

      setErrorModal({
        visible: true,
        title: isTimeout ? 'Connection Timeout' : 'Checkout Error',
        message: errorMessage,
      })

      throw error
    }
  }

  const handleClearCart = useCallback(() => {
    clearCart()
    setSelectedCustomer(null)
    resetLoyalty()
  }, [clearCart, resetLoyalty, setSelectedCustomer])

  const handleEndSessionClick = async () => {
    logger.debug('[END SESSION] Button clicked in POSCheckout')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    if (!sessionInfo?.sessionId) {
      logger.error('[END SESSION] No session ID found!')
      return
    }

    try {
      logger.debug('[END SESSION] Loading session data for ID:', sessionInfo.sessionId)
      const { data: session, error } = await supabase
        .from('pos_sessions')
        .select('session_number, total_sales, total_cash, opening_cash')
        .eq('id', sessionInfo.sessionId)
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
  }

  const handleCloseDrawerSubmit = async (closingCash: number, notes: string) => {
    if (!sessionInfo?.sessionId) return

    try {
      const { data, error } = await supabase.rpc('close_pos_session', {
        p_session_id: sessionInfo.sessionId,
        p_closing_cash: closingCash,
        p_closing_notes: notes || null,
      })

      if (error) throw error
      if (!data.success) {
        throw new Error(data.error || 'Failed to close session')
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      closeModal()
      clearCart()
      resetLoyalty()
      onEndSession()
    } catch (error) {
      logger.error('Error closing session:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCloseDrawerCancel = () => {
    closeModal()
  }

  // ========================================
  // RENDER
  // ========================================
  return (
    <View style={styles.container}>
      {/* All Modals - Extracted to POSCheckoutModals (REFACTORED) */}
      <POSCheckoutModals
        vendor={vendor}
        sessionInfo={sessionInfo}
        isModalOpen={isModalOpen}
        closeModal={closeModal}
        scannedDataForNewCustomer={scannedDataForNewCustomer}
        customerMatches={customerMatches}
        selectedCustomer={selectedCustomer}
        onCustomerSelected={handleCustomerSelected}
        onNoMatchFoundWithData={handleNoMatchFoundWithData}
        onOpenAddCustomer={() => openModal('addCustomer')}
        onOpenCustomerMatch={() => openModal('customerMatch')}
        onOpenCustomerSelector={() => openModal('customerSelector')}
        onClearScannedData={clearScannedData}
        onClearCustomerMatches={clearCustomerMatches}
        onSetCustomerMatches={handleCustomerMatchesFound}
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

      {/* Cart Display */}
      <POSCart
        cart={cart}
        subtotal={subtotal}
        taxAmount={taxAmount}
        total={total}
        itemCount={itemCount}
        taxRate={taxRate}
        selectedCustomer={selectedCustomer}
        loyaltyPointsToRedeem={loyaltyPointsToRedeem}
        loyaltyProgram={loyaltyProgram}
        loyaltyDiscountAmount={loyaltyDiscountAmount}
        discountingItemId={discountingItemId}
        activeDiscounts={activeDiscounts}
        selectedDiscountId={selectedDiscountId}
        onSelectDiscount={setSelectedDiscountId}
        discountAmount={discountAmount}
        onAddItem={(id) => updateQuantity(id, 1)}
        onRemoveItem={(id) => updateQuantity(id, -1)}
        onChangeTier={changeTier}
        onApplyDiscount={applyManualDiscount}
        onRemoveDiscount={removeManualDiscount}
        onSelectCustomer={() => openModal('customerSelector')}
        onClearCustomer={handleClearCustomer}
        onSetLoyaltyPoints={setLoyaltyPointsToRedeem}
        onCheckout={handleCheckout}
        onClearCart={handleClearCart}
        onStartDiscounting={setDiscountingItemId}
        onCancelDiscounting={() => setDiscountingItemId(null)}
        onEndSession={handleEndSessionClick}
        maxRedeemablePoints={getMaxRedeemablePoints(subtotal)}
        products={products}
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
