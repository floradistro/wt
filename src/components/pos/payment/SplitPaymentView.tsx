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
import { useCartTotals } from '@/stores/cart.store'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { taxActions } from '@/stores/tax.store'
import { useLoyaltyState } from '@/stores/loyalty.store'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import type { PaymentData, SaleCompletionData } from './PaymentTypes'

interface SplitPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>  // ✅ Coordination callback only
}

export function SplitPaymentView({
  onComplete,
}: SplitPaymentViewProps) {
  // ========================================
  // STORES - TRUE ZERO PROPS (read from environment)
  // ========================================
  const { subtotal, itemCount } = useCartTotals()
  const { session } = usePOSSession()
  const { loyaltyProgram, pointsToRedeem } = useLoyaltyState()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)

  // Calculate tax
  const { taxAmount, taxRate, taxName } = useMemo(() => {
    if (!session?.locationId) return { taxAmount: 0, taxRate: 0, taxName: undefined }
    return taxActions.calculateTax(subtotal, session.locationId)
  }, [subtotal, session?.locationId])

  // Calculate loyalty discount
  const loyaltyDiscountAmount = useMemo(() => {
    if (!loyaltyProgram || pointsToRedeem === 0) return 0
    return (pointsToRedeem * (loyaltyProgram.point_value || 0.01))
  }, [loyaltyProgram, pointsToRedeem])

  // Calculate total
  const total = useMemo(() => {
    const subtotalAfterDiscount = Math.max(0, subtotal - loyaltyDiscountAmount)
    return subtotalAfterDiscount + taxAmount
  }, [subtotal, loyaltyDiscountAmount, taxAmount])

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
            <Text style={styles.listeningText}>PROCESSING</Text>
          </View>
          <View style={styles.processingBody}>
            <Text style={styles.processingAmount}>${total.toFixed(2)}</Text>
            <View style={styles.statusDivider} />
            <Text style={styles.statusText}>Processing split payment...</Text>
            <Text style={styles.splitBreakdown}>
              Cash: ${splitCash.toFixed(2)} | Card: ${splitCard.toFixed(2)}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.splitHeader}>
            <Ionicons name="swap-horizontal-outline" size={32} color="#10b981" />
            <Text style={styles.splitTitle}>Split Payment</Text>
            <Text style={styles.splitSubtext}>Cash + Card</Text>
          </View>

          <View style={styles.totalDisplay}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
          </View>

          {/* Cash Input */}
          <LiquidGlassView effect="regular" colorScheme="dark" style={styles.inputCard}>
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
          </LiquidGlassView>

          {/* Card Input */}
          <LiquidGlassView effect="regular" colorScheme="dark" style={styles.inputCard}>
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
          </LiquidGlassView>

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

          {/* Complete Button */}
          <TouchableOpacity
            onPress={handleSplitPayment}
            disabled={!canComplete}
            activeOpacity={0.7}
            style={styles.completeButtonWrapper}
          >
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              tintColor={canComplete ? 'rgba(16,185,129,0.3)' : undefined}
              style={[
                styles.completeButton,
                !canComplete && styles.completeButtonDisabled,
              ]}
            >
              <Text style={[
                styles.completeButtonText,
                canComplete && styles.completeButtonTextActive
              ]}>
                Complete Split Payment
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
    marginBottom: 12,
    textAlign: 'center',
  },
  splitBreakdown: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  splitHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  splitTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  splitSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  totalDisplay: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#10b981',
    marginTop: 4,
  },
  inputCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
