/**
 * Split Payment View
 * Single Responsibility: Handle split payment (cash + card)
 * Apple Standard: Component < 300 lines
 */

import { useState, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { validatePaymentResponse } from '@/utils/payment-validation'
import { ErrorModal } from '@/components/ErrorModal'
import type { ProcessorInfo } from '@/stores/payment-processor.store'
import type { BasePaymentViewProps, PaymentData } from './PaymentTypes'
import { logger } from '@/utils/logger'

interface SplitPaymentViewProps extends BasePaymentViewProps {
  currentProcessor: ProcessorInfo | null
  locationId?: string
  registerId?: string
  onComplete: (paymentData: PaymentData) => void
}

export function SplitPaymentView({
  total,
  currentProcessor,
  locationId,
  registerId,
  onComplete,
}: SplitPaymentViewProps) {
  const [splitCashAmount, setSplitCashAmount] = useState('')
  const [splitCardAmount, setSplitCardAmount] = useState('')
  const [processing, setProcessing] = useState(false)
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

  // Calculate totals
  const splitCash = parseFloat(splitCashAmount) || 0
  const splitCard = parseFloat(splitCardAmount) || 0
  const splitTotal = splitCash + splitCard

  const canComplete = useMemo(() => {
    return Math.abs(splitTotal - total) < 0.01 && splitCash >= 0 && splitCard >= 0
  }, [splitTotal, total, splitCash, splitCard])

  const fillSplitCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const remaining = total - splitCash
    setSplitCardAmount(Math.max(0, remaining).toFixed(2))
  }

  const fillSplitCash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const remaining = total - splitCard
    setSplitCashAmount(Math.max(0, remaining).toFixed(2))
  }

  const handleSplitPayment = async () => {
    if (!canComplete) return

    // Process card portion first if > 0
    if (splitCard > 0) {
      if (!currentProcessor) {
        setErrorModal({
          visible: true,
          title: 'No Payment Processor',
          message: 'No payment processor is configured for the card portion. Please set up a payment terminal in settings.',
          canRetry: false,
        })
        return
      }

      setProcessing(true)

      try {
        const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

        // Get auth session
        const { supabase } = await import('@/lib/supabase/client')
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.access_token) {
          throw new Error('Authentication required')
        }

        const PAYMENT_ENDPOINT = `${BASE_URL}/api/pos/payment/process`

        logger.debug('💳 Processing split payment (card portion):', {
          cardAmount: splitCard,
          cashAmount: splitCash,
          locationId,
          registerId,
        })

        const controller = new AbortController()
        // 3 minutes timeout for split payment card portion
        const timeoutId = setTimeout(() => controller.abort(), 180000)

        const response = await fetch(PAYMENT_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            locationId,
            registerId,
            amount: splitCard,
            paymentMethod: 'credit',
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          let errorMessage = `Payment failed (${response.status})`

          try {
            const contentType = response.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json()
              errorMessage = errorData.error || errorData.message || errorMessage
            } else {
              const errorText = await response.text()
              logger.error('❌ Non-JSON error response:', errorText.substring(0, 200))

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
          logger.error('❌ Failed to parse payment response as JSON:', jsonError)
          throw new Error('Invalid response from payment server. Please try again.')
        }

        // Validate response
        validatePaymentResponse(result)

        const paymentData: PaymentData = {
          paymentMethod: 'split',
          splitPayments: [
            { method: 'cash', amount: splitCash },
            { method: 'card', amount: splitCard },
          ],
          authorizationCode: result.authorizationCode,
          transactionId: result.transactionId,
          cardType: result.cardType,
          cardLast4: result.cardLast4,
        }

        logger.debug('💳 Split payment successful:', paymentData)
        onComplete(paymentData)
      } catch (error: any) {
        const isTimeout = error.name === 'AbortError'

        let userMessage = ''
        let shouldRetry = false

        if (isTimeout) {
          userMessage = 'Split payment took too long (3 min timeout).\n\nThe terminal may still be processing. Please:\n• Check the terminal screen\n• If transaction completed, do NOT retry\n• If transaction failed, you can try again'
          shouldRetry = true
        } else if (error.message.includes('Session expired')) {
          userMessage = 'Your session has expired.\n\nPlease log out and log back in.'
          shouldRetry = false
        } else if (error.message.includes('terminal is offline')) {
          userMessage = 'Payment terminal is not responding.\n\nPlease:\n• Check terminal power and connection\n• Wait a moment and try again'
          shouldRetry = true
        } else if (error.message.includes('Network request failed')) {
          userMessage = 'Network connection lost.\n\nPlease:\n• Check your internet connection\n• Try again in a moment'
          shouldRetry = true
        } else if (error.message.includes('Invalid response')) {
          userMessage = 'Server returned invalid response.\n\nPlease try again or contact support if this persists.'
          shouldRetry = true
        } else {
          userMessage = error.message || 'Split payment failed for an unknown reason'
          shouldRetry = true
        }

        logger.error('❌ Split payment error:', error)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)

        // Show user-friendly error with retry option
        setErrorModal({
          visible: true,
          title: 'Split Payment Failed',
          message: userMessage,
          canRetry: shouldRetry,
        })
      } finally {
        setProcessing(false)
      }
    } else {
      // Cash only split (shouldn't happen but handle it)
      const paymentData: PaymentData = {
        paymentMethod: 'split',
        splitPayments: [{ method: 'cash', amount: splitCash }],
      }
      onComplete(paymentData)
    }
  }

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
            handleSplitPayment()
          }
        }}
        onSecondaryPress={
          errorModal.canRetry
            ? () => setErrorModal({ visible: false, title: '', message: '', canRetry: false })
            : undefined
        }
        variant="error"
      />

      <Text style={styles.sectionLabel}>SPLIT PAYMENT</Text>

      {/* Cash Portion */}
      <View style={styles.splitSection}>
        <View style={styles.splitHeader}>
          <Ionicons name="cash-outline" size={20} color="#10b981" />
          <Text style={styles.splitLabel}>CASH AMOUNT</Text>
          <TouchableOpacity onPress={fillSplitCash} style={styles.fillButton}>
            <Text style={styles.fillButtonText}>FILL</Text>
          </TouchableOpacity>
        </View>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={styles.inputCard}
        >
          <TextInput
            style={styles.splitInput}
            value={splitCashAmount}
            onChangeText={setSplitCashAmount}
            keyboardType="decimal-pad"
            placeholder="$0.00"
            placeholderTextColor="rgba(255,255,255,0.3)"
            selectionColor="#10b981"
          />
        </LiquidGlassView>
      </View>

      {/* Card Portion */}
      <View style={styles.splitSection}>
        <View style={styles.splitHeader}>
          <Ionicons name="card-outline" size={20} color="#3b82f6" />
          <Text style={styles.splitLabel}>CARD AMOUNT</Text>
          <TouchableOpacity onPress={fillSplitCard} style={styles.fillButton}>
            <Text style={styles.fillButtonText}>FILL</Text>
          </TouchableOpacity>
        </View>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={styles.inputCard}
        >
          <TextInput
            style={styles.splitInput}
            value={splitCardAmount}
            onChangeText={setSplitCardAmount}
            keyboardType="decimal-pad"
            placeholder="$0.00"
            placeholderTextColor="rgba(255,255,255,0.3)"
            selectionColor="#3b82f6"
          />
        </LiquidGlassView>
      </View>

      {/* Split Total Display */}
      {(splitCash > 0 || splitCard > 0) && (
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          tintColor={canComplete ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
          style={styles.splitTotalCard}
        >
          <Text style={[styles.splitTotalLabel, !canComplete && styles.splitTotalLabelError]}>
            {canComplete ? 'TOTAL MATCHES' : 'TOTAL MISMATCH'}
          </Text>
          <Text style={[styles.splitTotalAmount, !canComplete && styles.splitTotalAmountError]}>
            ${splitTotal.toFixed(2)} / ${total.toFixed(2)}
          </Text>
          {!canComplete && (
            <Text style={styles.splitTotalError}>
              Adjust amounts to match total
            </Text>
          )}
        </LiquidGlassView>
      )}

      {/* Complete Button */}
      <TouchableOpacity
        onPress={handleSplitPayment}
        disabled={!canComplete || processing}
        activeOpacity={0.7}
        style={styles.completeButtonWrapper}
      >
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          tintColor={canComplete ? 'rgba(16,185,129,0.3)' : undefined}
          style={[
            styles.completeButton,
            (!canComplete || processing) && styles.completeButtonDisabled,
          ]}
        >
          <Text style={[
            styles.completeButtonText,
            canComplete && !processing && styles.completeButtonTextActive
          ]}>
            {processing ? 'Processing...' : 'Complete'}
          </Text>
        </LiquidGlassView>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 12,
  },
  splitSection: {
    marginBottom: 20,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  splitLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  fillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  fillButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 1,
  },
  inputCard: {
    borderRadius: 14,
    padding: 12,
  },
  splitInput: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
    textAlign: 'center',
    padding: 0,
  },
  splitTotalCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  splitTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  splitTotalLabelError: {
    color: '#ef4444',
  },
  splitTotalAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -1,
  },
  splitTotalAmountError: {
    color: '#ef4444',
  },
  splitTotalError: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(239,68,68,0.8)',
    marginTop: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  completeButtonTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
})
