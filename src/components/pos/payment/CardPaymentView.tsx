/**
 * Card Payment View - TRUE ZERO PROPS ✅
 * Two-Phase Commit Architecture
 *
 * DOES NOT process payments itself.
 * Just triggers the checkout flow which calls Edge Function.
 * Edge Function handles: create order → process payment → complete atomically
 *
 * ZERO DATA PROPS - Reads from stores:
 * - total (calculated from subtotal + tax)
 * - subtotal, itemCount → cart.store
 * - taxAmount → tax.store
 * - currentProcessor, processorStatus → payment-processor.store
 * - locationId, registerId → posSession.store
 */

import { useState, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCartTotals } from '@/stores/cart.store'
import { usePOSSession } from '@/stores/posSession.store'
import { taxActions } from '@/stores/tax.store'
import { useLoyaltyState } from '@/stores/loyalty.store'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import type { PaymentData } from './PaymentTypes'

interface CardPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<import('./PaymentTypes').SaleCompletionData>  // ✅ Coordination callback only
}

export function CardPaymentView({
  onComplete,
}: CardPaymentViewProps) {
  // ========================================
  // STORES - TRUE ZERO PROPS (read from environment)
  // ========================================
  const { subtotal, itemCount } = useCartTotals()
  const { sessionInfo } = usePOSSession()
  const { loyaltyProgram, pointsToRedeem } = useLoyaltyState()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const processorStatus = usePaymentProcessor((state) => state.status)

  // Calculate tax
  const { taxAmount, taxRate, taxName } = useMemo(() => {
    if (!sessionInfo?.locationId) return { taxAmount: 0, taxRate: 0, taxName: undefined }
    return taxActions.calculateTax(subtotal, sessionInfo.locationId)
  }, [subtotal, sessionInfo?.locationId])

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
  const [processing, setProcessing] = useState(false)

  const hasActiveProcessor = !!currentProcessor

  const handleCardPayment = async () => {
    if (!currentProcessor) {
      return
    }

    try {
      setProcessing(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // NEW ARCHITECTURE: Just pass payment method
      // POSCheckout's handlePaymentComplete will call Edge Function
      // Edge Function will: create order → process payment → complete
      // All atomic!
      await onComplete({
        paymentMethod: 'card',
      })

      // Success handled by parent
    } catch (error) {
      // Error handled by parent
      console.error('Card payment error:', error)
    } finally {
      setProcessing(false)
    }
  }

  const canComplete = hasActiveProcessor && !processing

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
            <Text style={styles.statusText}>Processing payment...</Text>
            <Text style={styles.terminalName}>
              {currentProcessor?.processor_name || 'Terminal'}
            </Text>
          </View>
        </View>
      ) : !hasActiveProcessor ? (
        <View style={styles.cardInfoContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.cardInfoTitle}>No Terminal Connected</Text>
          <Text style={styles.cardInfoSubtext}>Status: {processorStatus}</Text>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            tintColor="rgba(239,68,68,0.15)"
            style={styles.instructionCard}
          >
            <Text style={styles.instructionText}>
              Please connect a payment terminal to accept card payments
            </Text>
          </LiquidGlassView>
        </View>
      ) : (
        <>
          <View style={styles.cardInfoContainer}>
            <Ionicons name="card-outline" size={48} color="#10b981" />
            <Text style={styles.cardInfoTitle}>Card Payment</Text>
            <Text style={styles.cardInfoSubtext}>
              Terminal: {currentProcessor?.processor_name || 'Not configured'}
            </Text>
            <Text style={styles.cardInfoAmount}>${total.toFixed(2)}</Text>
          </View>

          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={styles.instructionCard}
          >
            <Text style={styles.instructionText}>
              Click COMPLETE to process card payment on terminal
            </Text>
          </LiquidGlassView>

          <TouchableOpacity
            onPress={handleCardPayment}
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
              <Text
                style={[
                  styles.completeButtonText,
                  canComplete && styles.completeButtonTextActive,
                ]}
              >
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
