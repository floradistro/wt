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
import POSSaleSuccessModal from '../POSSaleSuccessModal'
import { POSCart } from '../cart/POSCart'
import { CloseCashDrawerModal } from '../CloseCashDrawerModal'

// Hooks
import { useLoyalty, useModalState } from '@/hooks/pos'
import { usePaymentProcessor } from '@/stores/payment-processor.store'

// Types
import type { Vendor, Customer, Product, SessionInfo } from '@/types/pos'
import type { PaymentData } from '@/components/pos/payment'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import type { UseCartReturn } from '@/types/hooks'

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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [scannedDataForNewCustomer, setScannedDataForNewCustomer] = useState<AAMVAData | null>(null)
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([])
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [errorModal, setErrorModal] = useState<{
    visible: boolean
    title: string
    message: string
  }>({
    visible: false,
    title: '',
    message: '',
  })
  const [successData, setSuccessData] = useState<{
    orderNumber: string
    transactionNumber?: string
    total: number
    paymentMethod: string
    authorizationCode?: string
    cardType?: string
    cardLast4?: string
    itemCount: number
    processorName?: string
    inventoryDeducted?: boolean
    loyaltyPointsAdded?: number
    loyaltyPointsRedeemed?: number
  } | null>(null)

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

  const handlePaymentComplete = async (paymentData: PaymentData) => {
    if (!sessionInfo || !vendor || !customUserId) return

    logger.debug('💰 POSCheckout: Processing payment', paymentData)
    setProcessingCheckout(true)

    // Start Sentry transaction for checkout/transaction saving
    // Note: startTransaction not available in current SDK version
    // const transaction = Sentry.startTransaction({
    //   name: 'pos_checkout',
    //   op: 'checkout.process',
    // })

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
    })

    Sentry.addBreadcrumb({
      category: 'checkout',
      message: 'Starting checkout process',
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
      }))

      // Normalize payment method for database constraint
      // Database expects: 'credit', 'debit', 'ebt_food', 'ebt_cash', 'gift', 'cash', 'check'
      const normalizedPaymentMethod = normalizePaymentMethod(paymentData.paymentMethod)

      // CRITICAL VALIDATION: Ensure normalized payment method is valid
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

      // Call Supabase RPC function directly
      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Calling create_pos_sale RPC',
        level: 'info',
        data: {
          itemCount: items.length,
          total,
          paymentMethod: normalizedPaymentMethod,
        },
      })

      // const rpcSpan = transaction.startChild({
      //   op: 'db.query',
      //   description: 'RPC: create_pos_sale',
      // })

      const { data: result, error: rpcError } = await supabase.rpc('create_pos_sale', {
        p_location_id: sessionInfo.locationId,
        p_vendor_id: vendor.id,
        p_session_id: sessionInfo.sessionId,
        p_user_id: customUserId,
        p_items: items,
        p_subtotal: subtotal,
        p_tax_amount: taxAmount,
        p_total: total,
        p_payment_method: normalizedPaymentMethod,
        p_payment_processor_id: null,
        p_cash_tendered: paymentData.cashTendered || null,
        p_change_given: paymentData.changeGiven || null,
        p_customer_id: selectedCustomer?.id || null,
        p_customer_name: selectedCustomer
          ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          : 'Walk-In',
        p_authorization_code: paymentData.authorizationCode || null,
        p_payment_transaction_id: paymentData.transactionId || null,
        p_card_type: paymentData.cardType || null,
        p_card_last4: paymentData.cardLast4 || null,
        p_loyalty_points_redeemed: loyaltyPointsToRedeem || 0,
        p_loyalty_discount_amount: loyaltyDiscountAmount || 0,
      })

      // rpcSpan.finish()

      if (rpcError) {
        Sentry.addBreadcrumb({
          category: 'checkout',
          message: 'RPC error creating sale',
          level: 'error',
          data: {
            error: rpcError.message,
          },
        })
        throw new Error(rpcError.message || 'Failed to create sale')
      }

      if (!result?.success) {
        Sentry.addBreadcrumb({
          category: 'checkout',
          message: 'RPC returned failure',
          level: 'error',
        })
        throw new Error('Failed to create sale')
      }

      Sentry.addBreadcrumb({
        category: 'checkout',
        message: 'Sale created successfully',
        level: 'info',
        data: {
          orderNumber: result.order?.order_number,
          transactionNumber: result.transaction?.transaction_number,
        },
      })

      // Extract transaction details from RPC response
      const orderNumber = result.order?.order_number || 'Unknown'
      const transactionNumber = result.transaction?.transaction_number

      // Calculate loyalty points earned from the sale
      const loyaltyPointsAdded = result.loyalty?.points_earned || 0

      // Prepare success modal data
      setSuccessData({
        orderNumber,
        transactionNumber,
        total,
        paymentMethod: paymentData.paymentMethod,
        authorizationCode: paymentData.authorizationCode,
        cardType: paymentData.cardType,
        cardLast4: paymentData.cardLast4,
        itemCount,
        processorName: currentProcessor?.processor_name,
        inventoryDeducted: true, // RPC function handles this automatically
        loyaltyPointsAdded,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem || undefined,
      })

      // Clear cart and close payment modal
      clearCart()
      setSelectedCustomer(null)
      resetLoyalty()
      closeModal()

      // Show success modal (haptic is triggered by modal)
      setShowSuccessModal(true)

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

      setErrorModal({
        visible: true,
        title: 'Checkout Error',
        message: error instanceof Error ? error.message : 'Failed to process sale. Please try again or contact support.',
      })
    } finally {
      setProcessingCheckout(false)
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

      {/* Success Modal - Always rendered */}
      <POSSaleSuccessModal
        visible={showSuccessModal}
        saleData={successData}
        onClose={() => setShowSuccessModal(false)}
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
