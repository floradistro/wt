/**
 * Payment Store - Apple Engineering Standard
 *
 * Principle: Payment state machine for atomic, debuggable transactions
 * Replaces: Inline payment logic in POSCheckout (335 lines)
 *
 * Benefits:
 * - State machine visible in Redux DevTools
 * - Payment flow fully debuggable with time-travel
 * - Clean separation: UI vs payment logic
 * - Atomic error handling
 * - AI can trigger payments outside React
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { validateRealPaymentData, normalizePaymentMethod, validatePaymentMethod } from '@/utils/payment-validation'
import { Sentry } from '@/utils/sentry'
import { logger } from '@/utils/logger'
import type { PaymentData, SaleCompletionData, PaymentStage } from '@/components/pos/payment'
import type { CartItem, SessionInfo, Vendor } from '@/types/pos'

interface PaymentState {
  // Current payment session
  stage: PaymentStage | null
  error: string | null
  completionData: SaleCompletionData | null

  // Actions
  processPayment: (params: ProcessPaymentParams) => Promise<SaleCompletionData>
  resetPayment: () => void
  setStage: (stage: PaymentStage) => void
  setError: (error: string) => void
}

interface ProcessPaymentParams {
  paymentData: PaymentData
  cart: CartItem[]
  subtotal: number
  taxAmount: number
  total: number
  itemCount: number
  sessionInfo: SessionInfo
  vendor: Vendor
  customUserId: string
  selectedCustomer: any | null
  loyaltyPointsToRedeem: number
  loyaltyDiscountAmount: number
  discountAmount: number
  selectedDiscountId: string | null
  currentProcessor: any
  onSuccess?: () => void
}

const initialState = {
  stage: null,
  error: null,
  completionData: null,
}

/**
 * State Machine: Valid Payment Stage Transitions
 * Prevents impossible states (e.g., 'success' → 'initializing')
 */
const VALID_TRANSITIONS: Record<PaymentStage | 'null', PaymentStage[]> = {
  // Starting a new payment
  null: ['initializing'],

  // Forward progress through payment stages
  initializing: ['sending', 'error'],
  sending: ['processing', 'error'],
  waiting: ['processing', 'error'],
  processing: ['approving', 'waiting', 'error'],
  approving: ['success', 'error'],
  success: ['saving', 'complete', 'error'],
  saving: ['complete', 'error'],

  // Terminal states (can only go to null via reset)
  complete: [],
  error: [],
}

/**
 * Check if state transition is valid
 */
const canTransition = (from: PaymentStage | null, to: PaymentStage): boolean => {
  const fromKey = from || 'null'
  const validNextStates = VALID_TRANSITIONS[fromKey as keyof typeof VALID_TRANSITIONS]

  if (!validNextStates) {
    logger.error(`[Payment Store] Unknown state: ${fromKey}`)
    return false
  }

  return validNextStates.includes(to)
}

export const usePaymentStore = create<PaymentState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Process payment through Edge Function
       * Implements two-phase commit with atomic database operations
       */
      processPayment: async (params: ProcessPaymentParams): Promise<SaleCompletionData> => {
        // ===== DOUBLE-WRITE PROTECTION =====
        // Check if payment is already being processed
        const { stage } = get()
        if (stage && ['initializing', 'sending', 'processing', 'approving'].includes(stage)) {
          const error = 'Payment already in progress. Please wait for the current payment to complete.'
          logger.warn('🚫 [Payment Store] Blocked duplicate payment call', { currentStage: stage })
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          throw new Error(error)
        }
        // ===== END DOUBLE-WRITE PROTECTION =====

        const {
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
          onSuccess,
        } = params

        set({ stage: 'initializing', error: null, completionData: null }, false, 'payment/start')

        // Set checkout context for Sentry
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
          data: { total, itemCount, paymentMethod: paymentData.paymentMethod },
        })

        try {
          // CRITICAL VALIDATION: Ensure payment data is real, not mocked
          set({ stage: 'sending' }, false, 'payment/validating')
          validateRealPaymentData(paymentData)

          // Prepare order items
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
          validatePaymentMethod(normalizedPaymentMethod)

          // Get FRESH session from Supabase
          set({ stage: 'processing' }, false, 'payment/getting_session')
          logger.debug('🔄 Refreshing session before payment...')
          const { data: { session: freshSession }, error: sessionError } = await supabase.auth.getSession()

          if (sessionError || !freshSession) {
            throw new Error('Authentication error. Please log out and log back in.')
          }

          if (!freshSession.access_token) {
            throw new Error('Invalid session. Please log out and log back in.')
          }

          logger.debug('✅ Fresh session obtained', {
            userId: freshSession.user?.id,
            tokenLength: freshSession.access_token.length,
            expiresAt: freshSession.expires_at,
          })

          // Call Edge Function with 90s timeout
          set({ stage: 'approving' }, false, 'payment/calling_edge_function')

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
            throw edgeFunctionError
          }

          if (!data?.success) {
            throw new Error(data?.error || 'Failed to create sale')
          }

          set({ stage: 'success' }, false, 'payment/success')

          Sentry.addBreadcrumb({
            category: 'checkout',
            message: 'Two-phase commit completed successfully',
            level: 'info',
            data: {
              orderNumber: data.data?.order?.order_number || data.data?.orderNumber,
              orderId: data.data?.order?.id || data.data?.orderId,
            },
          })

          // Extract transaction details
          const orderNumber = data.data?.order?.order_number || data.data?.orderNumber || 'Unknown'
          const transactionNumber = `TXN-${orderNumber}`

          // Use server-calculated loyalty points (prevents client manipulation)
          const serverLoyaltyEarned = data.data?.loyaltyPointsEarned || 0
          const serverLoyaltyRedeemed = data.data?.loyaltyPointsRedeemed || 0

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
            loyaltyPointsAdded: serverLoyaltyEarned,
            loyaltyPointsRedeemed: serverLoyaltyRedeemed > 0 ? serverLoyaltyRedeemed : undefined,
          }

          set({ stage: 'complete', completionData }, false, 'payment/complete')

          // Call success callback
          if (onSuccess) {
            onSuccess()
          }

          return completionData
        } catch (error) {
          logger.error('Payment error:', error)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

          const errorMessage = error instanceof Error ? error.message : 'Failed to process sale'
          const isTimeout = errorMessage.includes('timed out')

          set({
            stage: 'error',
            error: errorMessage,
          }, false, 'payment/error')

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
              },
            },
            tags: {
              'checkout.operation': 'create_sale',
              'payment.method': paymentData.paymentMethod,
            },
          })

          throw error
        }
      },

      /**
       * Reset payment state
       */
      resetPayment: () => {
        set(initialState, false, 'payment/reset')
      },

      /**
       * Set payment stage with state machine validation
       * Throws error on invalid transitions (e.g., 'success' → 'initializing')
       */
      setStage: (stage: PaymentStage) => {
        const { stage: currentStage } = get()

        // Validate transition
        if (!canTransition(currentStage, stage)) {
          const error = `Invalid payment state transition: ${currentStage || 'null'} → ${stage}`
          logger.error(`[Payment Store] ${error}`, {
            from: currentStage,
            to: stage,
            validTransitions: VALID_TRANSITIONS[currentStage || 'null'],
          })
          throw new Error(error)
        }

        set({ stage }, false, `payment/setStage/${stage}`)
      },

      /**
       * Set error manually
       */
      setError: (error: string) => {
        set({ stage: 'error', error }, false, 'payment/setError')
      },
    }),
    { name: 'PaymentStore' }
  )
)

/**
 * Selectors for optimal re-render performance
 */

// Get payment stage
export const usePaymentStage = () => usePaymentStore((state) => state.stage)

// Get payment error
export const usePaymentError = () => usePaymentStore((state) => state.error)

// Get completion data
export const usePaymentCompletionData = () => usePaymentStore((state) => state.completionData)

// Export payment actions as plain object (not a hook!)
export const paymentActions = {
  get processPayment() { return usePaymentStore.getState().processPayment },
  get resetPayment() { return usePaymentStore.getState().resetPayment },
  get setStage() { return usePaymentStore.getState().setStage },
  get setError() { return usePaymentStore.getState().setError },
}

// Legacy hook for backward compatibility
export const usePaymentActions = () => paymentActions

// Get all payment state (for debugging/display)
export const usePaymentState = () => usePaymentStore(
  useShallow((state) => ({
    stage: state.stage,
    error: state.error,
    completionData: state.completionData,
  }))
)
