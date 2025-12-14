/**
 * Split Payment View - TRUE ZERO PROPS ✅
 * Two-Phase Commit Architecture
 *
 * DOES NOT process payments itself.
 * Just collects split amounts and triggers checkout.
 * Edge Function handles the actual payment processing.
 *
 * ZERO DATA PROPS - Reads from stores:
 * - total (calculated from subtotal + tax)
 * - subtotal → cart.store
 * - taxAmount → tax.store
 * - currentProcessor → payment-processor.store
 * - locationId, registerId → POSSessionContext
 */

import { useState, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCheckoutTotals } from '@/hooks/useCheckoutTotals'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import type { PaymentData, SaleCompletionData } from './PaymentTypes'

interface SplitPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>  // ✅ Coordination callback only
  onCancel: () => void
}

export function SplitPaymentView({
  onComplete,
  onCancel,
}: SplitPaymentViewProps) {
  // ========================================
  // SINGLE SOURCE OF TRUTH - Centralized total calculation
  // ========================================
  const { total } = useCheckoutTotals()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)

  // ========================================
  // LOCAL STATE (UI only)
  // ========================================
  const [splitCashAmount, setSplitCashAmount] = useState('')
  const [splitCardAmount, setSplitCardAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  // Calculate totals
  const splitCash = parseFloat(splitCashAmount) || 0
  const splitCard = parseFloat(splitCardAmount) || 0
  const splitTotal = splitCash + splitCard

  const canComplete = useMemo(() => {
    return Math.abs(splitTotal - total) < 0.01 && splitCash >= 0 && splitCard >= 0 && !!currentProcessor
  }, [splitTotal, total, splitCash, splitCard, currentProcessor])

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

    try {
      setProcessing(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // NEW ARCHITECTURE: Just pass split payment data
      // POSCheckout's handlePaymentComplete will call Edge Function
      // Edge Function will handle everything atomically
      await onComplete({
        paymentMethod: 'split',
        splitPayments: [
          { method: 'cash', amount: splitCash },
          { method: 'card', amount: splitCard },
        ],
      })

      // Success handled by parent
    } catch (error) {
      // Error handled by parent
      console.error('Split payment error:', error)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <View style={styles.container}>
      {processing ? (
        <View style={styles.processingContainer}>
          <View style={styles.processingHeader}>
            <Ionicons name="radio-outline" size={20} color="#10b981" />
            <Text style={styles.listeningText}>PROCESSING SPLIT PAYMENT</Text>
          </View>
          <View style={styles.processingBody}>
            {/* Show breakdown prominently */}
            <View style={styles.splitAmountsContainer}>
              <View style={styles.splitAmountRow}>
                <Ionicons name="cash-outline" size={24} color="#10b981" />
                <Text style={styles.splitAmountLabel}>Cash</Text>
                <Text style={styles.splitAmountValue}>${splitCash.toFixed(2)}</Text>
              </View>
              <View style={styles.splitAmountRow}>
                <Ionicons name="card-outline" size={24} color="#3b82f6" />
                <Text style={styles.splitAmountLabel}>Card</Text>
                <Text style={styles.splitAmountValue}>${splitCard.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.processingAmount}>${total.toFixed(2)}</Text>
            </View>

            <Text style={styles.statusText}>
              Processing card payment for ${splitCard.toFixed(2)}...
            </Text>
          </View>
        </View>
      ) : (
        <>
          {/* Cash Input */}
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Cash Amount</Text>
              <TouchableOpacity onPress={fillSplitCash} style={styles.fillButton}>
                <Text style={styles.fillButtonText}>Fill Remaining</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                value={splitCashAmount}
                onChangeText={setSplitCashAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                selectTextOnFocus
              />
            </View>
          </View>

          {/* Card Input */}
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Card Amount</Text>
              <TouchableOpacity onPress={fillSplitCard} style={styles.fillButton}>
                <Text style={styles.fillButtonText}>Fill Remaining</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.input}
                value={splitCardAmount}
                onChangeText={setSplitCardAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.3)"
                selectTextOnFocus
              />
            </View>
          </View>

          {/* Split Total Display */}
          <View style={styles.splitTotalRow}>
            <Text style={styles.splitTotalLabel}>Split Total</Text>
            <Text style={[
              styles.splitTotalAmount,
              canComplete ? styles.splitTotalValid : styles.splitTotalInvalid
            ]}>
              ${splitTotal.toFixed(2)}
            </Text>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              style={styles.cancelButtonWrapper}
              accessibilityRole="button"
              accessibilityLabel="Cancel payment"
            >
              <View style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSplitPayment}
              disabled={!canComplete}
              activeOpacity={0.7}
              style={styles.completeButtonWrapper}
              accessibilityRole="button"
              accessibilityLabel="Complete split payment"
              accessibilityState={{ disabled: !canComplete }}
            >
              <View
                style={[
                  styles.completeButton,
                  canComplete && styles.completeButtonActive,
                  !canComplete && styles.completeButtonDisabled,
                ]}
              >
                <Text style={[
                  styles.completeButtonText,
                  canComplete && styles.completeButtonTextActive
                ]}>
                  Complete
                </Text>
              </View>
            </TouchableOpacity>
          </View>
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
  splitAmountsContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  splitAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  splitAmountLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  splitAmountValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  processingAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -0.5,
  },
  statusDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 16,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  inputCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fillButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 8,
  },
  fillButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '400',
    color: '#fff',
    padding: 0,
    minHeight: 44,
  },
  splitTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 24,
  },
  splitTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  splitTotalAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  splitTotalValid: {
    color: '#10b981',
  },
  splitTotalInvalid: {
    color: '#ef4444',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButtonWrapper: {
    flex: 1,
  },
  cancelButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.2,
  },
  completeButtonWrapper: {
    flex: 1,
  },
  completeButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  completeButtonActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: '#10b981',
  },
  completeButtonDisabled: {
    opacity: 0.4,
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
