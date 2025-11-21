/**
 * POSCheckout Component
 * Jobs Principle: One focused responsibility - Checkout process
 *
 * Handles:
 * - Cart display and management
 * - Customer selection
 * - Payment processing
 * - Success modal
 * - Loyalty points
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase/client'
import { validateRealPaymentData, normalizePaymentMethod, validatePaymentMethod } from '@/utils/payment-validation'
import { Sentry } from '@/utils/sentry'
import { logger } from '@/utils/logger'
import { ErrorModal } from '@/components/ErrorModal'

// POS Components
import { POSUnifiedCustomerSelector } from '../POSUnifiedCustomerSelector'
import { POSAddCustomerModal } from '../POSAddCustomerModal'
import { POSCustomerMatchModal, type CustomerMatch } from '../POSCustomerMatchModal'
import POSPaymentModal from '../POSPaymentModal'
import { POSCart } from '../cart/POSCart'
import { CloseCashDrawerModal } from '../CloseCashDrawerModal'

// Hooks
import { useLoyalty, useModalState } from '@/hooks/pos'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { useAuthStore } from '@/stores/auth.store'

// Types
import type { Vendor, Customer, Product, SessionInfo } from '@/types/pos'
import type { PaymentData, SaleCompletionData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

interface POSCheckoutProps {
  sessionInfo: SessionInfo
  vendor: Vendor
  products: Product[]
  customUserId: string
  cartHook: any  // TODO: Fix type - actual useCart return doesn't match UseCartReturn
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [scannedDataForNewCustomer, setScannedDataForNewCustomer] = useState<AAMVAData | null>(null)
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([])
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
  // MODALS
  // ========================================
  const { openModal, closeModal, isModalOpen } = useModalState()

  // ========================================
  // CART & LOYALTY
  // ========================================
  // Use cart hook passed from parent (single source of truth)
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

  // ========================================
  // CALCULATIONS
  // ========================================
  const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscountAmount)
  const taxRate = sessionInfo?.taxRate || 0.08
  const taxAmount = subtotalAfterLoyalty * taxRate
  const total = subtotalAfterLoyalty + taxAmount

  const loyaltyPointsEarned = useMemo(() => {
    if (!selectedCustomer) return 0
    const pointValue = loyaltyProgram?.point_value || 1.0
    return Math.floor(total / pointValue)
  }, [total, loyaltyProgram, selectedCustomer])

  // ========================================
  // HANDLERS
  // ========================================
  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return
    logger.debug('🛒 POSCheckout: Opening payment modal')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    openModal('payment')
  }, [cart.length, openModal])

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

      const items = cart.map((item: any) => ({
        productId: item.productId,
        productName: item.productName || item.name,
        productSku: item.sku || item.productSku || '',
        unitPrice: item.adjustedPrice !== undefined ? item.adjustedPrice : item.price,
        quantity: item.quantity,
        tierName: item.tierName || item.tier || '1 Unit',
        discountAmount: item.manualDiscountValue || 0,
        lineTotal: (item.adjustedPrice !== undefined ? item.adjustedPrice : item.price) * item.quantity,
        inventoryId: item.inventoryId, // CRITICAL for inventory deduction
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

      // ========================================================================
      // NEW ARCHITECTURE: Call Edge Function (Atomic Two-Phase Commit)
      // ========================================================================
      // This replaces the old pattern of:
      // 1. Call payment processor
      // 2. Then call create_pos_sale RPC
      //
      // New pattern:
      // 1. Edge Function creates pending order
      // 2. Edge Function processes payment
      // 3. Edge Function completes order
      // All atomic - if any step fails, everything rolls back
      // ========================================================================

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

      // Get FRESH session from Supabase (don't use cached session from store)
      // This ensures we have a valid, non-expired token
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

      // Extract split payment amounts if present
      const splitCash = paymentData.splitPayments?.find(p => p.method === 'cash')?.amount || null
      const splitCard = paymentData.splitPayments?.find(p => p.method === 'card')?.amount || null

      // Call Edge Function with 90s timeout (gives plenty of time for payment processor)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        logger.warn('⏱️ Edge Function timeout (90s) - aborting request')
        controller.abort()
      }, 90000)

      // Log what we're sending to the Edge Function
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
        tipAmount: 0, // TODO: Add tip support in UI
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer
          ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          : 'Walk-In',
        loyaltyPointsRedeemed: loyaltyPointsToRedeem || 0,
        loyaltyDiscountAmount: loyaltyDiscountAmount || 0,
      }

      logger.debug('📤 Sending to Edge Function:', edgeFunctionPayload)

      const authHeader = `Bearer ${freshSession.access_token}`
      logger.debug('🔑 Auth header:', {
        hasToken: !!freshSession.access_token,
        tokenLength: freshSession.access_token.length,
        headerPreview: authHeader.substring(0, 30) + '...',
      })

      // Call Edge Function directly with fetch() to ensure headers are sent correctly
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/process-checkout`

      logger.debug('🌐 Calling NEW Edge Function (enterprise-grade):', {
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
        body: responseText, // Log full response body
      })

      let data: any = null
      let edgeFunctionError: any = null

      if (!response.ok) {
        // Try to parse error response
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
        // Parse success response
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

        // Try to extract more detailed error message
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

      // Extract transaction details from Edge Function response
      // Edge Function wraps response in { success: true, data: { ... } }
      const orderNumber = data.data?.order?.order_number || data.data?.orderNumber || 'Unknown'
      const transactionNumber = `TXN-${orderNumber}`

      // Loyalty points are calculated by the Edge Function
      const loyaltyPointsAdded = loyaltyPointsEarned // Use the calculated value from above

      // Prepare completion data to return to payment modal
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

      // Note: Payment modal will auto-close via SaleSuccessModal's onDismiss after 2.5s

      // Mark transaction as successful
      // transaction.setStatus('ok')
      // transaction.setTag('checkout.result', 'success')
      // transaction.setTag('payment.method', normalizedPaymentMethod)
      // transaction.setMeasurement('checkout.total', total, 'usd')
      // transaction.setMeasurement('checkout.item_count', itemCount, 'none')
      // if (loyaltyPointsAdded > 0) {
      //   transaction.setMeasurement('loyalty.points_earned', loyaltyPointsAdded, 'none')
      // }
      // if (loyaltyPointsToRedeem > 0) {
      //   transaction.setMeasurement('loyalty.points_redeemed', loyaltyPointsToRedeem, 'none')
      // }
      // transaction.finish()

      // Notify parent if callback provided
      if (onCheckoutComplete) {
        onCheckoutComplete()
      }

      // Return completion data to payment modal
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

      // Capture exception in Sentry
      // transaction.setStatus('internal_error')
      // transaction.setTag('checkout.result', 'failure')
      // transaction.setTag('payment.method', paymentData.paymentMethod)

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

      // transaction.finish()

      // CRITICAL FIX: Close the payment modal to reset its state
      // This prevents the UI from freezing when checkout fails
      // The payment modal's processingCard state needs to be reset
      closeModal()

      // Log error details for debugging intermittent issues
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

      // Re-throw error so payment views can handle it
      throw error
    }
  }

  const handleClearCart = useCallback(() => {
    clearCart()
    setSelectedCustomer(null)
    resetLoyalty()
  }, [clearCart, resetLoyalty])

  const handleClearCustomer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedCustomer(null)
  }, [])

  const handleEndSessionClick = async () => {
    logger.debug('[END SESSION] Button clicked in POSCheckout')
    logger.debug('[END SESSION] sessionInfo:', sessionInfo)

    // Immediate haptic feedback
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
      onEndSession() // Clear parent session state
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
  /**
   * MODAL RENDERING PATTERN - Prevent Unmounting Issues
   *
   * CRITICAL: Modals must ALWAYS be rendered, never conditionally mounted.
   * Use visible={} prop to control visibility, not conditional rendering.
   *
   * WHY: Conditionally mounting modals can cause them to unmount mid-interaction
   * if the condition changes, breaking the user experience.
   */
  return (
    <View style={styles.container}>
      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        onPrimaryPress={() => setErrorModal({ visible: false, title: '', message: '' })}
        variant="error"
      />

      {/* Unified Customer Selector */}
      {vendor && (
        <POSUnifiedCustomerSelector
          visible={isModalOpen('customerSelector')}
          vendorId={vendor.id}
          onCustomerSelected={(customer) => {
            setSelectedCustomer(customer)
            closeModal()
          }}
          onNoMatchFoundWithData={async (data: AAMVAData) => {
            // Intelligent matching: Query Supabase directly and do fuzzy matching client-side
            setScannedDataForNewCustomer(data)

            try {
              // Step 1: Try to find by license number (exact match)
              let customer = null
              let matchType: 'exact' | 'high' | null = null

              if (data.licenseNumber) {
                const { data: licenseMatch } = await supabase
                  .from('customers')
                  .select('*')
                  .eq('drivers_license_number', data.licenseNumber)
                  .single()

                if (licenseMatch) {
                  customer = licenseMatch
                  matchType = 'exact'
                }
              }

              // Step 2: Try exact name + DOB match
              if (!customer && data.firstName && data.lastName && data.dateOfBirth) {
                const { data: nameMatches } = await supabase
                  .from('customers')
                  .select('*')
                  .eq('first_name', data.firstName)
                  .eq('last_name', data.lastName)
                  .eq('date_of_birth', data.dateOfBirth)

                if (nameMatches && nameMatches.length > 0) {
                  customer = nameMatches[0]
                  matchType = 'high'
                }
              }

              // Step 3: Fuzzy matching on name with same DOB
              if (!customer && data.firstName && data.lastName && data.dateOfBirth) {
                const { data: allCustomers } = await supabase
                  .from('customers')
                  .select('*')
                  .eq('date_of_birth', data.dateOfBirth)

                if (allCustomers && allCustomers.length > 0) {
                  const firstName = data.firstName.toLowerCase().trim()
                  const lastName = data.lastName.toLowerCase().trim()

                  // Calculate similarity scores
                  const scoredMatches = allCustomers.map((c) => {
                    const cFirst = (c.first_name || '').toLowerCase().trim()
                    const cLast = (c.last_name || '').toLowerCase().trim()
                    let score = 0

                    // Last name matching (most important)
                    if (cLast === lastName) score += 50
                    else if (cLast.startsWith(lastName) || lastName.startsWith(cLast)) score += 30
                    else if (cLast.includes(lastName) || lastName.includes(cLast)) score += 20

                    // First name matching
                    if (cFirst === firstName) score += 30
                    else if (cFirst.startsWith(firstName) || firstName.startsWith(cFirst)) score += 20
                    else if (cFirst.includes(firstName) || firstName.includes(cFirst)) score += 10

                    return { customer: c, score }
                  })
                  .filter(m => m.score >= 50) // Only strong matches
                  .sort((a, b) => b.score - a.score)

                  if (scoredMatches.length > 0) {
                    customer = scoredMatches[0].customer
                    matchType = 'high'
                  }
                }
              }

              // Step 4: Handle the result
              if (customer && matchType) {
                const match: CustomerMatch = {
                  customer,
                  confidence: matchType,
                  confidenceScore: matchType === 'exact' ? 100 : 90,
                  matchedFields: matchType === 'exact' ? ['license', 'name', 'dob'] : ['name', 'dob'],
                  reason: matchType === 'exact'
                    ? 'License number matched'
                    : 'Name and date of birth matched',
                }

                if (matchType === 'exact') {
                  // Exact match - auto-select with brief confirmation
                  setCustomerMatches([match])
                  closeModal()
                  openModal('customerMatch')
                } else {
                  // High confidence - show confirmation
                  setCustomerMatches([match])
                  closeModal()
                  openModal('customerMatch')
                }
              } else {
                // No match found - go to add customer
                closeModal()
                openModal('addCustomer')
              }
            } catch (error) {
              logger.error('Error matching customer:', error)
              // On error, default to add customer modal
              closeModal()
              openModal('addCustomer')
            }
          }}
          onAddCustomer={() => {
            // Manual add: User clicked "Add New Customer" button
            setScannedDataForNewCustomer(null) // No pre-filled data
            closeModal() // Close customer selector
            openModal('addCustomer') // Open add customer modal
          }}
          onClose={closeModal}
        />
      )}

      {/* Customer Match Modal */}
      <POSCustomerMatchModal
        visible={isModalOpen('customerMatch')}
        scannedData={scannedDataForNewCustomer}
        matches={customerMatches}
        onSelectCustomer={(customer) => {
          setSelectedCustomer(customer)
          setCustomerMatches([])
          setScannedDataForNewCustomer(null)
          closeModal()
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }}
        onCreateNew={() => {
          // User wants to create new customer despite matches
          setCustomerMatches([])
          closeModal()
          openModal('addCustomer')
        }}
        onSearchManually={() => {
          // User wants to manually search
          setCustomerMatches([])
          setScannedDataForNewCustomer(null)
          closeModal()
          openModal('customerSelector')
        }}
        onClose={() => {
          setCustomerMatches([])
          setScannedDataForNewCustomer(null)
          closeModal()
        }}
      />

      {/* Add Customer Modal */}
      {vendor && (
        <POSAddCustomerModal
          visible={isModalOpen('addCustomer')}
          vendorId={vendor.id}
          prefilledData={scannedDataForNewCustomer}
          onCustomerCreated={(customer) => {
            setSelectedCustomer(customer)
            setScannedDataForNewCustomer(null)
            closeModal()
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }}
          onClose={() => {
            setScannedDataForNewCustomer(null)
            closeModal()
          }}
        />
      )}

      {/* Payment Modal - Always rendered */}
      <POSPaymentModal
        visible={isModalOpen('payment')}
        total={total}
        subtotal={subtotal}
        taxAmount={taxAmount}
        taxRate={taxRate}
        taxName={sessionInfo?.taxName}
        loyaltyDiscountAmount={loyaltyDiscountAmount}
        loyaltyPointsEarned={loyaltyPointsEarned}
        currentLoyaltyPoints={selectedCustomer?.loyalty_points || 0}
        pointValue={loyaltyProgram?.point_value || 0.01}
        maxRedeemablePoints={getMaxRedeemablePoints(subtotal)}
        itemCount={itemCount}
        customerName={
          selectedCustomer
            ? selectedCustomer.display_name ||
              `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim() ||
              selectedCustomer.email
            : undefined
        }
        onApplyLoyaltyPoints={setLoyaltyPointsToRedeem}
        onPaymentComplete={handlePaymentComplete}
        onCancel={closeModal}
        hasPaymentProcessor={true}
        locationId={sessionInfo?.locationId}
        registerId={sessionInfo?.registerId}
      />

      {/* Close Cash Drawer Modal - Always rendered, visibility controlled by isModalOpen */}
      <CloseCashDrawerModal
        visible={isModalOpen('cashDrawerClose') && !!sessionData}
        sessionNumber={sessionData?.sessionNumber || ''}
        totalSales={sessionData?.totalSales || 0}
        totalCash={sessionData?.totalCash || 0}
        openingCash={sessionData?.openingCash || 0}
        onSubmit={handleCloseDrawerSubmit}
        onCancel={handleCloseDrawerCancel}
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
