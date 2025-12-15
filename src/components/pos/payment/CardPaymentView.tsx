/**
 * Card Payment View - TRUE ZERO PROPS ✅
 * Modern glass design with flex layout
 */

import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'
import { useCheckoutTotals } from '@/hooks/useCheckoutTotals'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { PaymentProcessingAnimation } from './PaymentProcessingAnimation'
import { PaymentActionButton } from './PaymentActionButton'
import type { PaymentData, SaleCompletionData } from './PaymentTypes'

interface CardPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
  onCancel: () => void
}

export function CardPaymentView({
  onComplete,
  onCancel,
}: CardPaymentViewProps) {
  const { total } = useCheckoutTotals()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const processorStatus = usePaymentProcessor((state) => state.status)

  const [processing, setProcessing] = useState(false)

  const hasActiveProcessor = !!currentProcessor

  const handleCardPayment = async () => {
    if (!currentProcessor) return

    try {
      setProcessing(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      await onComplete({
        paymentMethod: 'card',
      })
    } catch (error) {
      logger.error('Card payment error:', error)
    } finally {
      setProcessing(false)
    }
  }

  const canComplete = hasActiveProcessor && !processing

  // ========== PROCESSING VIEW ==========
  if (processing) {
    return (
      <View style={styles.container}>
        <PaymentProcessingAnimation
          amount={`$${total.toFixed(2)}`}
          title="Processing Card Payment"
          subtitle={`Terminal: ${currentProcessor?.processor_name || 'Unknown'}`}
          icon="card"
        />
      </View>
    )
  }

  // ========== NO TERMINAL VIEW ==========
  if (!hasActiveProcessor) {
    return (
      <View style={styles.container}>
        <View
          style={styles.centerArea}
          accessibilityRole="alert"
          accessibilityLabel={`No payment terminal connected. ${processorStatus}`}
        >
          <View style={styles.errorIcon}>
            <Ionicons name="wifi-outline" size={28} color="rgba(255,255,255,0.3)" />
          </View>
          <Text style={styles.errorTitle}>No Terminal</Text>
          <Text style={styles.errorSubtitle}>Connect a payment terminal</Text>
          <Text style={styles.errorStatus}>{processorStatus}</Text>
        </View>

        <PaymentActionButton
          onPress={onCancel}
          isActive={false}
          activeText=""
        />
      </View>
    )
  }

  // ========== READY VIEW ==========
  return (
    <View style={styles.container}>
      {/* Center Area - Terminal Ready */}
      <View
        style={styles.centerArea}
        accessibilityRole="text"
        accessibilityLabel={`Ready to charge ${total.toFixed(2)} dollars. Terminal: ${currentProcessor?.processor_name || 'Connected'}`}
      >
        <View style={styles.terminalIcon}>
          <Ionicons name="card-outline" size={32} color="#10b981" />
        </View>
        <Text style={styles.readyTitle}>Ready to Charge</Text>
        <View style={styles.terminalPill}>
          <View style={styles.statusDot} accessibilityLabel="Terminal connected" />
          <Text style={styles.terminalName}>
            {currentProcessor?.processor_name || 'Terminal'}
          </Text>
        </View>
      </View>

      {/* Action Button */}
      <PaymentActionButton
        onPress={canComplete ? handleCardPayment : onCancel}
        isActive={canComplete}
        activeText={`Charge $${total.toFixed(2)}`}
        activeIcon="card-outline"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
  },

  // Center Area
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  terminalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  terminalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  terminalName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },

  // Error State
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  errorStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
