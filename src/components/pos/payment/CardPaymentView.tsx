/**
 * Card Payment View
 * Single Responsibility: Handle card payment processing with terminal
 * Apple Standard: Component < 300 lines
 */

import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { validateProcessor, validatePaymentResponse } from '@/utils/payment-validation'
import { Sentry } from '@/utils/sentry'
import { ErrorModal } from '@/components/ErrorModal'
import type { ProcessorInfo } from '@/stores/payment-processor.store'
import type { BasePaymentViewProps, PaymentData, PaymentStage } from './PaymentTypes'
import { logger } from '@/utils/logger'

interface CardPaymentViewProps extends BasePaymentViewProps {
  currentProcessor: ProcessorInfo | null
  processorStatus: string
  locationId?: string
  registerId?: string
  onComplete: (paymentData: PaymentData) => void
}

export function CardPaymentView({
  total,
  itemCount,
  currentProcessor,
  processorStatus,
  locationId,
  registerId,
  onComplete,
}: CardPaymentViewProps) {
  const [processingCard, setProcessingCard] = useState(false)
  const [paymentStage, setPaymentStage] = useState<PaymentStage>('initializing')
  const [errorModal, setErrorModal] = useState<{
    visible: boolean
    title: string
    message: string
    canRetry: boolean
  }>({
    visible: false,
    title: '',
    message: '',
    canRetry: false,
  })

  const hasActiveProcessor = !!currentProcessor

  const handleCardPayment = async () => {
    // TODO: Re-enable Sentry span for performance monitoring with Sentry v7 compatible API
    // const span = logger.startSpan('card_payment', 'payment.process')

    // Set payment context for this transaction
    Sentry.setContext('payment', {
      type: 'card',
      amount: total,
      itemCount,
      hasProcessor: !!currentProcessor,
      processorName: currentProcessor?.processor_name,
      locationId,
      registerId,
    })

    // Breadcrumb: Payment initiated
    Sentry.addBreadcrumb({
      category: 'payment',
      message: 'Card payment initiated',
      level: 'info',
      data: {
        amount: total,
        itemCount,
        processorStatus,
      },
    })

    if (!currentProcessor) {
      Sentry.captureMessage('Card payment attempted without processor', {
        level: 'warning',
        contexts: {
          payment: {
            amount: total,
            processorStatus,
          },
        },
      })
      setErrorModal({
        visible: true,
        title: 'No Payment Processor',
        message: 'No payment processor is configured. Please set up a payment terminal in settings.',
        canRetry: false,
      })
      return
    }

    // Validate processor is configured correctly
    try {
      validateProcessor(currentProcessor)
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Processor validation passed',
        level: 'info',
      })
    } catch (error) {
      logger.error('Processor validation failed:', error)
      Sentry.captureException(error, {
        contexts: {
          processor: {
            id: currentProcessor.processor_id,
            name: currentProcessor.processor_name,
            isLive: currentProcessor.is_live,
          },
        },
      })
      setErrorModal({
        visible: true,
        title: 'Configuration Error',
        message: error instanceof Error ? error.message : 'Invalid processor configuration. Please check your payment terminal settings.',
        canRetry: false,
      })
      return
    }

    try {
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

      // Get auth session before showing processing UI
      const { supabase } = await import('@/lib/supabase/client')
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Authentication required')
      }

      const PAYMENT_ENDPOINT = `${BASE_URL}/api/pos/payment/process`

      logger.debug('Processing card payment:', {
        amount: total,
        locationId,
        registerId,
        processorId: currentProcessor.processor_id,
      })

      // Show processing UI
      setProcessingCard(true)
      setPaymentStage('initializing')

      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment stage: initializing',
        level: 'info',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      setPaymentStage('sending')
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment stage: sending to terminal',
        level: 'info',
      })

      await new Promise(resolve => setTimeout(resolve, 300))

      const controller = new AbortController()
      // 3 minutes timeout - gives customer time to insert card, enter PIN, approve
      const timeoutId = setTimeout(() => controller.abort(), 180000)

      setPaymentStage('waiting')
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment stage: waiting for customer',
        level: 'info',
      })

      // TODO: Re-enable Sentry API span with Sentry v7 compatible API
      // const apiSpan = transaction.startChild({
      //   op: 'http.client',
      //   description: 'POST /api/pos/payment/process',
      // })

      const response = await fetch(PAYMENT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          locationId,
          registerId,
          amount: total,
          paymentMethod: 'credit',
        }),
        signal: controller.signal,
      })

      // apiSpan.setHttpStatus(response.status)
      // apiSpan.finish()

      clearTimeout(timeoutId)

      setPaymentStage('processing')
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment stage: processing authorization',
        level: 'info',
        data: {
          httpStatus: response.status,
        },
      })

      if (!response.ok) {
        let errorMessage = `Payment failed (${response.status})`

        try {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.message || errorMessage
          } else {
            // Server returned HTML instead of JSON
            const errorText = await response.text()
            logger.error('Non-JSON error response:', errorText.substring(0, 200))

            if (response.status === 401) {
              errorMessage = 'Session expired. Please log in again.'
            } else if (response.status === 503) {
              errorMessage = 'Payment terminal is offline. Please check terminal connection.'
            } else if (response.status === 500) {
              errorMessage = 'Server error. Please try again or contact support.'
            }
          }
        } catch (parseError) {
          logger.error('❌ Error parsing error response:', parseError)
        }

        throw new Error(errorMessage)
      }

      let result
      try {
        result = await response.json()
      } catch (jsonError) {
        logger.error('Failed to parse payment response:', jsonError)
        throw new Error('Invalid response from payment server. Please try again.')
      }

      // Validate response structure
      validatePaymentResponse(result)

      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment response validated successfully',
        level: 'info',
        data: {
          hasAuthCode: !!result.authorizationCode,
          hasTransactionId: !!result.transactionId,
          cardType: result.cardType,
        },
      })

      setPaymentStage('approving')
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment stage: approving',
        level: 'info',
      })

      await new Promise(resolve => setTimeout(resolve, 500))

      const paymentData: PaymentData = {
        paymentMethod: 'card',
        authorizationCode: result.authorizationCode,
        transactionId: result.transactionId,
        cardType: result.cardType,
        cardLast4: result.cardLast4,
      }

      setPaymentStage('success')
      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Payment approved successfully',
        level: 'info',
        data: {
          cardType: result.cardType,
          cardLast4: result.cardLast4,
        },
      })

      await new Promise(resolve => setTimeout(resolve, 1500))

      // TODO: Re-enable Sentry measurement with Sentry v7 compatible API
      // transaction.setMeasurement('payment.amount', total, 'usd')

      logger.debug('💳 Payment successful:', paymentData)
      onComplete(paymentData)
    } catch (error: any) {
      setPaymentStage('error')
      await new Promise(resolve => setTimeout(resolve, 1000))
      const isTimeout = error.name === 'AbortError'

      let userMessage = ''
      let shouldRetry = false
      let errorType = 'unknown'

      if (isTimeout) {
        errorType = 'timeout'
        userMessage = 'Payment took too long (3 min timeout).\n\nThe terminal may still be processing. Please:\n• Check the terminal screen\n• If transaction completed, do NOT retry\n• If transaction failed, you can try again'
        shouldRetry = true
      } else if (error.message.includes('Session expired')) {
        errorType = 'session_expired'
        userMessage = 'Your session has expired.\n\nPlease log out and log back in.'
        shouldRetry = false
      } else if (error.message.includes('terminal is offline')) {
        errorType = 'terminal_offline'
        userMessage = 'Payment terminal is not responding.\n\nPlease:\n• Check terminal power and connection\n• Wait a moment and try again'
        shouldRetry = true
      } else if (error.message.includes('Network request failed')) {
        errorType = 'network_error'
        userMessage = 'Network connection lost.\n\nPlease:\n• Check your internet connection\n• Try again in a moment'
        shouldRetry = true
      } else if (error.message.includes('Invalid response')) {
        errorType = 'invalid_response'
        userMessage = 'Server returned invalid response.\n\nPlease try again or contact support if this persists.'
        shouldRetry = true
      } else {
        errorType = 'generic_error'
        userMessage = error.message || 'Payment failed for an unknown reason'
        shouldRetry = true
      }

      logger.error('❌ Card payment error:', error)

      // Capture error in Sentry with full context
      Sentry.captureException(error, {
        level: isTimeout ? 'warning' : 'error',
        contexts: {
          payment: {
            type: 'card',
            amount: total,
            stage: paymentStage,
            errorType,
            isTimeout,
            shouldRetry,
          },
          processor: {
            id: currentProcessor?.processor_id,
            name: currentProcessor?.processor_name,
          },
        },
        tags: {
          'payment.method': 'card',
          'error.type': errorType,
          'payment.retryable': shouldRetry.toString(),
        },
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

      // Show user-friendly error with retry option
      setErrorModal({
        visible: true,
        title: 'Payment Failed',
        message: userMessage,
        canRetry: shouldRetry,
      })
    } finally {
      setProcessingCard(false)
    }
  }

  const canComplete = hasActiveProcessor && !processingCard

  return (
    <View style={styles.container}>
      {/* Error Modal */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        primaryButtonText={errorModal.canRetry ? 'Retry Payment' : 'OK'}
        secondaryButtonText={errorModal.canRetry ? 'Cancel' : undefined}
        onPrimaryPress={() => {
          setErrorModal({ visible: false, title: '', message: '', canRetry: false })
          if (errorModal.canRetry) {
            handleCardPayment()
          }
        }}
        onSecondaryPress={
          errorModal.canRetry
            ? () => setErrorModal({ visible: false, title: '', message: '', canRetry: false })
            : undefined
        }
        variant="error"
      />

      {processingCard ? (
        <View
          style={styles.processingContainer}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel="Payment processing"
          accessibilityValue={{
            text: `Processing ${total.toFixed(2)} dollars. ${
              paymentStage === 'initializing' ? 'Preparing terminal' :
              paymentStage === 'sending' ? 'Connecting to terminal' :
              paymentStage === 'waiting' ? 'Follow prompts on terminal' :
              paymentStage === 'processing' ? 'Authorizing payment' :
              paymentStage === 'approving' ? 'Finalizing transaction' :
              paymentStage === 'success' ? 'Payment approved' : ''
            }`
          }}
        >
          <View style={styles.processingHeader}>
            <Ionicons
              name="radio-outline"
              size={20}
              color="#10b981"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.listeningText}>LISTENING</Text>
          </View>

          <View style={styles.processingBody}>
            <Text
              style={styles.processingAmount}
              accessibilityLabel={`${total.toFixed(2)} dollars`}
            >
              ${total.toFixed(2)}
            </Text>

            <View
              style={styles.statusDivider}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />

            <Text
              style={styles.statusText}
              accessibilityLiveRegion="polite"
            >
              {paymentStage === 'initializing' && 'Preparing terminal...'}
              {paymentStage === 'sending' && 'Connecting...'}
              {paymentStage === 'waiting' && 'Follow prompts on terminal'}
              {paymentStage === 'processing' && 'Authorizing...'}
              {paymentStage === 'approving' && 'Finalizing transaction...'}
              {paymentStage === 'success' && 'Approved ✓'}
            </Text>

            <Text style={styles.terminalName}>
              {currentProcessor?.processor_name || 'Terminal'}
            </Text>
          </View>
        </View>
      ) : !hasActiveProcessor ? (
        <View
          style={styles.cardInfoContainer}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`No payment terminal connected. Status: ${processorStatus}. Please connect a payment terminal to accept card payments.`}
        >
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color="#ef4444"
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
          <Text style={styles.cardInfoTitle}>No Terminal Connected</Text>
          <Text style={styles.cardInfoSubtext}>
            Status: {processorStatus}
          </Text>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            tintColor="rgba(239,68,68,0.15)"
            style={styles.instructionCard}
            accessible={false}
          >
            <Text style={styles.instructionText}>
              Please connect a payment terminal to accept card payments
            </Text>
          </LiquidGlassView>
        </View>
      ) : (
        <>
          <View style={styles.cardInfoContainer}>
            <Ionicons
              name="card-outline"
              size={48}
              color="#10b981"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.cardInfoTitle}>Card Payment</Text>
            <Text style={styles.cardInfoSubtext}>
              Terminal: {currentProcessor?.processor_name || 'Not configured'}
            </Text>
            <Text
              style={styles.cardInfoAmount}
              accessibilityLabel={`Total: ${total.toFixed(2)} dollars`}
            >
              ${total.toFixed(2)}
            </Text>
          </View>

          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={styles.instructionCard}
            accessible={false}
          >
            <Text style={styles.instructionText}>
              Click COMPLETE to process card payment on terminal
            </Text>
          </LiquidGlassView>

          {/* Complete Button */}
          <TouchableOpacity
            onPress={handleCardPayment}
            disabled={!canComplete}
            activeOpacity={0.7}
            style={styles.completeButtonWrapper}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Complete payment"
            accessibilityHint={`Process ${total.toFixed(2)} dollar card payment on terminal`}
            accessibilityState={{ disabled: !canComplete }}
          >
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              tintColor={canComplete ? 'rgba(16,185,129,0.3)' : undefined}
              style={[
                styles.completeButton,
                !canComplete && styles.completeButtonDisabled,
              ]}
              accessible={false}
            >
              <Text style={[
                styles.completeButtonText,
                canComplete && styles.completeButtonTextActive
              ]}>
                Complete
              </Text>
            </LiquidGlassView>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  processingContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  processingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  listeningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  processingBody: {
    alignItems: 'center',
    width: '100%',
  },
  processingAmount: {
    fontSize: 56,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: -0.4,
    marginBottom: 24,
  },
  statusDivider: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 24,
  },
  statusText: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  terminalName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardInfoContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  cardInfoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  cardInfoSubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  cardInfoAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -0.4,
  },
  instructionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  instructionText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  completeButtonWrapper: {
    marginTop: 16,
  },
  completeButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.3,
  },
  completeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.2,
  },
  completeButtonTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
})
