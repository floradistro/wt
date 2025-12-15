/**
 * Split Payment View (Cash + Card)
 * Modern glass design with flex layout
 */

import { useState, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCheckoutTotals } from '@/hooks/useCheckoutTotals'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { PaymentProcessingAnimation } from './PaymentProcessingAnimation'
import { PaymentActionButton } from './PaymentActionButton'
import { logger } from '@/utils/logger'
import type { PaymentData, SaleCompletionData } from './PaymentTypes'

interface SplitPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
  onCancel: () => void
}

export function SplitPaymentView({
  onComplete,
  onCancel,
}: SplitPaymentViewProps) {
  const { total } = useCheckoutTotals()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)

  const [splitCashAmount, setSplitCashAmount] = useState('')
  const [splitCardAmount, setSplitCardAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  const splitCash = parseFloat(splitCashAmount) || 0
  const splitCard = parseFloat(splitCardAmount) || 0
  const splitTotal = splitCash + splitCard
  const isValid = Math.abs(splitTotal - total) < 0.01

  const canComplete = useMemo(() => {
    return isValid && splitCash >= 0 && splitCard >= 0 && !!currentProcessor
  }, [isValid, splitCash, splitCard, currentProcessor])

  // Auto-calculate the other field when one changes
  const handleCashChange = (value: string) => {
    setSplitCashAmount(value)
    const cashVal = parseFloat(value) || 0
    if (cashVal >= 0 && cashVal <= total) {
      setSplitCardAmount(Math.max(0, total - cashVal).toFixed(2))
    }
  }

  const handleCardChange = (value: string) => {
    setSplitCardAmount(value)
    const cardVal = parseFloat(value) || 0
    if (cardVal >= 0 && cardVal <= total) {
      setSplitCashAmount(Math.max(0, total - cardVal).toFixed(2))
    }
  }

  const handleSplitPayment = async () => {
    if (!canComplete) return

    try {
      setProcessing(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      await onComplete({
        paymentMethod: 'split',
        splitPayments: [
          { method: 'cash', amount: splitCash },
          { method: 'card', amount: splitCard },
        ],
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      logger.error('Split payment error:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setProcessing(false)
    }
  }

  // ========== PROCESSING VIEW ==========
  if (processing) {
    return (
      <View style={styles.container}>
        <PaymentProcessingAnimation
          amount={`$${total.toFixed(2)}`}
          title="Processing Split Payment"
          subtitle={`Cash $${splitCash.toFixed(2)} + Card $${splitCard.toFixed(2)}`}
          icon="git-compare"
        />
      </View>
    )
  }

  // ========== SETUP VIEW ==========
  return (
    <View style={styles.container}>
      {/* Input Cards Row */}
      <View style={styles.inputRow}>
        {/* Cash */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Ionicons name="cash-outline" size={16} color="#10b981" />
            <Text style={styles.inputLabel}>Cash</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={splitCashAmount}
              onChangeText={handleCashChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.2)"
              selectTextOnFocus
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

        {/* Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Ionicons name="card-outline" size={16} color="#3b82f6" />
            <Text style={styles.inputLabel}>Card</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={splitCardAmount}
              onChangeText={handleCardChange}
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
        {(splitCash > 0 || splitCard > 0) && (
          <View style={[styles.statusPill, isValid && styles.statusPillValid]}>
            <Ionicons
              name={isValid ? 'checkmark-circle' : 'alert-circle-outline'}
              size={16}
              color={isValid ? '#10b981' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[styles.statusText, isValid && styles.statusTextValid]}>
              {isValid
                ? 'Ready'
                : `${splitTotal > total ? '+' : ''}$${Math.abs(splitTotal - total).toFixed(2)} ${splitTotal > total ? 'over' : 'remaining'}`}
            </Text>
          </View>
        )}
      </View>

      {/* Action Button */}
      <PaymentActionButton
        onPress={canComplete ? handleSplitPayment : onCancel}
        isActive={canComplete}
        activeText={`Pay $${total.toFixed(2)}`}
        activeIcon="git-compare"
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
    paddingVertical: 20,
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
})
