/**
 * Split Card Payment View - 2 Cards
 * Modern glass design with flex layout
 */

import { useState, useRef, useMemo, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCheckoutTotals } from '@/hooks/useCheckoutTotals'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { PaymentActionButton } from './PaymentActionButton'
import type { PaymentData, SaleCompletionData, SplitPayment } from './PaymentTypes'

interface RetryContext {
  orderId: string
  orderNumber: string
  card1Amount: number
  card1Auth: string
  card1Last4: string
  amountRemaining: number
}

interface SplitCardPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
  onCancel: () => void
  retryContext?: RetryContext
}

export function SplitCardPaymentView({ onComplete, onCancel, retryContext }: SplitCardPaymentViewProps) {
  const { total: cartTotal } = useCheckoutTotals()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)

  const isRetry = !!retryContext
  const total = isRetry ? (retryContext.card1Amount + retryContext.amountRemaining) : cartTotal

  const [card1Amount, setCard1Amount] = useState(isRetry ? retryContext.card1Amount.toFixed(2) : '')
  const [card2Amount, setCard2Amount] = useState(isRetry ? retryContext.amountRemaining.toFixed(2) : '')
  const [step, setStep] = useState<'setup' | 'processing' | 'complete' | 'error'>('setup')
  const [errorMessage, setErrorMessage] = useState('')
  const [partialOrderInfo, setPartialOrderInfo] = useState<{ orderId: string; amountRemaining: number } | null>(null)

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current
  const ringRotation = useRef(new Animated.Value(0)).current

  const amount1 = parseFloat(card1Amount) || 0
  const amount2 = parseFloat(card2Amount) || 0
  const splitTotal = amount1 + amount2
  const isValid = Math.abs(splitTotal - total) < 0.01

  const canStart = useMemo(() => {
    if (isRetry) return amount2 > 0 && !!currentProcessor
    return isValid && amount1 > 0 && amount2 > 0 && !!currentProcessor
  }, [isRetry, isValid, amount1, amount2, currentProcessor])

  useEffect(() => {
    if (step === 'processing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
      const ring = Animated.loop(
        Animated.timing(ringRotation, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
      )
      pulse.start()
      ring.start()
      return () => { pulse.stop(); ring.stop() }
    }
  }, [step])

  // Auto-calculate the other field when one changes
  const handleCard1Change = (value: string) => {
    setCard1Amount(value)
    if (!isRetry) {
      const val = parseFloat(value) || 0
      if (val >= 0 && val <= total) {
        setCard2Amount(Math.max(0, total - val).toFixed(2))
      }
    }
  }

  const handleCard2Change = (value: string) => {
    setCard2Amount(value)
    if (!isRetry) {
      const val = parseFloat(value) || 0
      if (val >= 0 && val <= total) {
        setCard1Amount(Math.max(0, total - val).toFixed(2))
      }
    }
  }

  const splitEvenly = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const half = total / 2
    setCard1Amount(half.toFixed(2))
    setCard2Amount(half.toFixed(2))
  }

  const handleStartPayment = async () => {
    if (!canStart) return

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setErrorMessage('')
      setStep('processing')

      const payments: SplitPayment[] = [
        { method: 'card', cardNumber: 1, amount: amount1, status: 'pending' },
        { method: 'card', cardNumber: 2, amount: amount2, status: 'pending' },
      ]

      await onComplete({ paymentMethod: 'multi-card', splitPayments: payments })

      setStep('complete')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error: any) {
      if (error?.partialSuccess) {
        setStep('error')
        setErrorMessage('Card 1 approved. Card 2 failed.')
        if (error.orderId && error.amountRemaining) {
          setPartialOrderInfo({ orderId: error.orderId, amountRemaining: error.amountRemaining })
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      } else {
        setStep('error')
        setErrorMessage(error.message || 'Payment failed')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    }
  }

  const handleRetry = async () => {
    const orderIdToUse = partialOrderInfo?.orderId || retryContext?.orderId
    const amountToCharge = partialOrderInfo?.amountRemaining || retryContext?.amountRemaining || amount2

    if (!orderIdToUse) {
      setErrorMessage('Cannot retry - missing order info.')
      return
    }

    try {
      setStep('processing')
      setErrorMessage('')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      await onComplete({
        paymentMethod: 'multi-card',
        orderId: orderIdToUse,
        amountRemaining: amountToCharge,
        splitPayments: [
          { method: 'card', cardNumber: 1, amount: amount1, status: 'success' },
          { method: 'card', cardNumber: 2, amount: amountToCharge, status: 'pending' },
        ],
      })

      setStep('complete')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error: any) {
      setStep('error')
      setErrorMessage(error.message || 'Retry failed')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const ringRotationInterpolate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  // ========== SETUP VIEW ==========
  if (step === 'setup') {
    return (
      <View style={styles.container}>
        {/* Input Cards Row */}
        <View style={styles.inputRow}>
          <View style={styles.inputCard}>
            <View style={styles.inputHeader}>
              <Ionicons name="card-outline" size={16} color="#10b981" />
              <Text style={styles.inputLabel}>Card 1</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={card1Amount}
                onChangeText={handleCard1Change}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.2)"
                selectTextOnFocus
                editable={!isRetry}
              />
            </View>
          </View>

          {/* Liquid Glass Divider Orb */}
          <View style={styles.dividerOrb}>
            <LinearGradient
              colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dividerOrbGradient}
            >
              <View style={styles.dividerOrbInner}>
                <Ionicons name="add" size={18} color="rgba(255,255,255,0.6)" />
              </View>
            </LinearGradient>
            <View style={styles.dividerOrbShine} />
          </View>

          <View style={styles.inputCard}>
            <View style={styles.inputHeader}>
              <Ionicons name="card-outline" size={16} color="#3b82f6" />
              <Text style={styles.inputLabel}>Card 2</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={card2Amount}
                onChangeText={handleCard2Change}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.2)"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Status Area */}
        <View style={styles.statusArea}>
          {!isRetry && (
            <TouchableOpacity onPress={splitEvenly} style={styles.splitPill}>
              <Ionicons name="git-compare-outline" size={14} color="#10b981" />
              <Text style={styles.splitPillText}>50/50</Text>
            </TouchableOpacity>
          )}
          {(amount1 > 0 || amount2 > 0) && (
            <View style={[styles.statusPill, isValid && styles.statusPillValid]}>
              <Ionicons
                name={isValid ? 'checkmark-circle' : 'alert-circle-outline'}
                size={16}
                color={isValid ? '#10b981' : 'rgba(255,255,255,0.4)'}
              />
              <Text style={[styles.statusText, isValid && styles.statusTextValid]}>
                {isValid ? 'Ready' : `$${Math.abs(splitTotal - total).toFixed(2)} ${splitTotal > total ? 'over' : 'remaining'}`}
              </Text>
            </View>
          )}
        </View>

        {/* Action Button */}
        <PaymentActionButton
          onPress={canStart ? handleStartPayment : onCancel}
          isActive={canStart}
          activeText={isRetry ? `Retry Card 2 $${amount2.toFixed(2)}` : `Pay $${total.toFixed(2)}`}
          activeIcon="card-outline"
        />
      </View>
    )
  }

  // ========== PROCESSING VIEW ==========
  if (step === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.processingArea}>
          <View style={styles.spinnerContainer}>
            <Animated.View style={[styles.spinnerRing, { transform: [{ rotate: ringRotationInterpolate }] }]}>
              <View style={styles.spinnerDot} />
            </Animated.View>
            <Animated.View style={[styles.spinnerCenter, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="card" size={28} color="#fff" />
            </Animated.View>
          </View>
          <Text style={styles.processingTitle}>Processing</Text>
          <Text style={styles.processingSubtitle}>Present cards when prompted</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownText}>Card 1: ${amount1.toFixed(2)}</Text>
            <Text style={styles.breakdownDivider}>•</Text>
            <Text style={styles.breakdownText}>Card 2: ${amount2.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    )
  }

  // ========== COMPLETE VIEW ==========
  if (step === 'complete') {
    return (
      <View style={styles.container}>
        <View style={styles.completeArea}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={styles.completeTitle}>Payment Complete</Text>
          <Text style={styles.completeSubtitle}>Both cards charged</Text>
        </View>
      </View>
    )
  }

  // ========== ERROR VIEW ==========
  return (
    <View style={styles.container}>
      <View style={styles.errorArea}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert" size={28} color="#ef4444" />
        </View>
        <Text style={styles.errorTitle}>Payment Issue</Text>
        <Text style={styles.errorSubtitle}>{errorMessage}</Text>
      </View>

      <PaymentActionButton
        onPress={partialOrderInfo ? handleRetry : onCancel}
        isActive={!!partialOrderInfo}
        activeText="Retry Card 2"
        activeIcon="refresh"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
  },

  // Input Row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currency: {
    fontSize: 24,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.25)',
    marginRight: 2,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    padding: 0,
  },

  // Liquid Glass Divider Orb
  dividerOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dividerOrbGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dividerOrbInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dividerOrbShine: {
    position: 'absolute',
    top: 4,
    left: 8,
    width: 16,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ rotate: '-20deg' }],
  },

  // Status Area
  statusArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  splitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
  },
  splitPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statusPillValid: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.15)',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  statusTextValid: {
    color: '#10b981',
  },

  // Processing
  processingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  spinnerRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: '#10b981',
  },
  spinnerDot: {
    position: 'absolute',
    top: -3,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  spinnerCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  processingSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  breakdownDivider: {
    color: 'rgba(255,255,255,0.2)',
  },

  // Complete
  completeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16,185,129,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  completeSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },

  // Error
  errorArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
})
