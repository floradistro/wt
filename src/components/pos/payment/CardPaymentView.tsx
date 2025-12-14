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
 * - locationId, registerId → POSSessionContext
 */

import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useCheckoutTotals } from '@/hooks/useCheckoutTotals'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import type { PaymentData } from './PaymentTypes'

interface CardPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<import('./PaymentTypes').SaleCompletionData>  // ✅ Coordination callback only
  onCancel: () => void
}

export function CardPaymentView({
  onComplete,
  onCancel,
}: CardPaymentViewProps) {
  // ========================================
  // SINGLE SOURCE OF TRUTH - Centralized total calculation
  // ========================================
  const { total } = useCheckoutTotals()
  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const processorStatus = usePaymentProcessor((state) => state.status)

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
            <Ionicons name="card-outline" size={40} color="#10b981" />
            <Text style={styles.cardInfoSubtext}>
              Terminal: {currentProcessor?.processor_name || 'Not configured'}
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
              onPress={handleCardPayment}
              disabled={!canComplete}
              activeOpacity={0.7}
              style={styles.completeButtonWrapper}
              accessibilityRole="button"
              accessibilityLabel="Complete card payment"
              accessibilityState={{ disabled: !canComplete }}
            >
              <View
                style={[
                  styles.completeButton,
                  canComplete && styles.completeButtonActive,
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
    paddingVertical: 16,
  },
  cardInfoSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    letterSpacing: -0.1,
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
