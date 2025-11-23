/**
 * Cash Payment View - TRUE ZERO PROPS ✅
 * Single Responsibility: Handle cash payment input and change calculation
 * Apple Standard: Component < 300 lines
 *
 * ZERO DATA PROPS - Reads from stores:
 * - total (calculated from subtotal + tax)
 * - subtotal, itemCount → cart.store
 * - taxAmount, taxRate, taxName → tax.store
 * - locationId → POSSessionContext
 */

import { useState, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'
import { Sentry } from '@/utils/sentry'
import { useCartTotals } from '@/stores/cart.store'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { taxActions } from '@/stores/tax.store'
import { useLoyaltyState } from '@/stores/loyalty.store'
import type { PaymentData, SaleCompletionData, PaymentStage } from './PaymentTypes'

interface CashPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>  // ✅ Coordination callback only
}

export function CashPaymentView({
  onComplete,
}: CashPaymentViewProps) {
  // ========================================
  // STORES - TRUE ZERO PROPS (read from environment)
  // ========================================
  const { subtotal, itemCount } = useCartTotals()
  const { session } = usePOSSession()
  const { loyaltyProgram, pointsToRedeem } = useLoyaltyState()

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
  const [cashTendered, setCashTendered] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paymentStage, setPaymentStage] = useState<PaymentStage>('initializing')
  const [completionData, setCompletionData] = useState<SaleCompletionData | null>(null)

  // Calculate change
  const changeAmount = useMemo(() => {
    return cashTendered ? parseFloat(cashTendered) - total : 0
  }, [cashTendered, total])

  const canComplete = useMemo(() => {
    return cashTendered && !isNaN(parseFloat(cashTendered)) && changeAmount >= 0 && !processing
  }, [cashTendered, changeAmount, processing])

  // Smart quick amounts
  const quickAmounts = useMemo(() => {
    return [
      Math.ceil(total),
      Math.ceil(total / 20) * 20,
      Math.ceil(total / 50) * 50,
      100,
    ].filter((v, i, a) => a.indexOf(v) === i && v >= total)
  }, [total])

  const handleQuickAmount = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setCashTendered(amount.toString())
  }

  const handleComplete = async () => {
    if (!canComplete) return

    setProcessing(true)
    setPaymentStage('processing')

    // Set Sentry context for cash payment tracking
    Sentry.setContext('cash_payment', {
      amount: total,
      cashTendered: parseFloat(cashTendered),
      changeGiven: changeAmount,
    })

    Sentry.addBreadcrumb({
      category: 'payment',
      message: 'Cash payment initiated',
      level: 'info',
      data: {
        amount: total,
        cashTendered: parseFloat(cashTendered),
        changeGiven: changeAmount,
      },
    })

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      const paymentData: PaymentData = {
        paymentMethod: 'cash',
        cashTendered: parseFloat(cashTendered),
        changeGiven: changeAmount,
      }

      // Brief moment to show success
      await new Promise(resolve => setTimeout(resolve, 500))
      setPaymentStage('success')

      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Cash payment accepted',
        level: 'info',
      })

      // CRITICAL: Save sale to database - MUST complete
      setPaymentStage('saving')
      logger.debug('💵 Cash payment complete, saving sale...', paymentData)

      Sentry.addBreadcrumb({
        category: 'payment',
        message: 'Saving cash sale to database',
        level: 'info',
      })

      try {
        const saleData = await onComplete(paymentData)

        // Sale saved successfully!
        setCompletionData(saleData)
        setPaymentStage('complete')

        logger.debug('💵 Cash sale completed successfully', { orderNumber: saleData.orderNumber })

        Sentry.addBreadcrumb({
          category: 'payment',
          message: 'Cash sale completed successfully',
          level: 'info',
          data: {
            orderNumber: saleData.orderNumber,
            loyaltyPointsAdded: saleData.loyaltyPointsAdded,
          },
        })

        // Parent modal will show success animation and handle dismissal
        // Keep processing state until modal fully closes (parent will reset on next open)

      } catch (saveError) {
        // CRITICAL: Sale save failed
        logger.error('💥 CRITICAL: Cash payment accepted but sale save failed', saveError)

        Sentry.captureException(saveError, {
          level: 'fatal',
          contexts: {
            cash_payment: {
              amount: total,
              cashTendered: parseFloat(cashTendered),
              changeGiven: changeAmount,
              stage: 'save_failed',
            },
          },
          tags: {
            payment_method: 'cash',
            critical: 'sale_save_failure',
          },
        })

        setPaymentStage('error')
        setProcessing(false)
        throw new Error('Sale could not be saved. Please contact support.')
      }
    } catch (error: any) {
      setPaymentStage('error')
      setProcessing(false)
      logger.error('Cash payment error:', error)

      Sentry.captureException(error, {
        level: 'error',
        contexts: {
          cash_payment: {
            amount: total,
            cashTendered: parseFloat(cashTendered),
            stage: paymentStage,
          },
        },
        tags: {
          payment_method: 'cash',
        },
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      // Error will be shown by parent
    }
  }

  return (
    <View style={styles.container}>
      {processing ? (
        <View style={styles.processingContainer}>
          <View style={styles.processingHeader}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>

          <View style={styles.processingBody}>
            <Text style={styles.processingAmount}>${total.toFixed(2)}</Text>

            <View style={styles.statusDivider} />

            <Text style={styles.statusText}>
              {paymentStage === 'processing' && 'Processing...'}
              {paymentStage === 'success' && 'Approved ✓'}
              {paymentStage === 'saving' && 'Saving sale...'}
              {paymentStage === 'complete' && 'Complete ✓'}
              {paymentStage === 'error' && 'Error'}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>CASH RECEIVED</Text>

      {/* Quick Buttons */}
      <View style={styles.quickButtons}>
        {quickAmounts.map((amount) => (
          <TouchableOpacity
            key={amount}
            onPress={() => handleQuickAmount(amount)}
            style={[
              styles.quickButton,
              cashTendered === amount.toString() && styles.quickButtonActive,
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${amount} dollars`}
            accessibilityHint="Quick select this cash amount"
            accessibilityState={{ selected: cashTendered === amount.toString() }}
          >
            <Text
              style={[
                styles.quickButtonText,
                cashTendered === amount.toString() && styles.quickButtonTextActive,
              ]}
            >
              ${amount}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.orLabel}>OR ENTER AMOUNT</Text>

      {/* Cash Input */}
      <LiquidGlassView
        effect="regular"
        colorScheme="dark"
        style={styles.inputCard}
      >
        <TextInput
          style={styles.input}
          value={cashTendered}
          onChangeText={setCashTendered}
          keyboardType="decimal-pad"
          placeholder={`$${total.toFixed(2)}`}
          placeholderTextColor="rgba(255,255,255,0.3)"
          selectionColor="#10b981"
          accessibilityLabel="Cash received amount"
          accessibilityHint={`Enter cash amount, minimum ${total.toFixed(2)} dollars`}
          accessibilityRole="text"
        />
      </LiquidGlassView>

      {/* Change Display */}
      {cashTendered && parseFloat(cashTendered) > 0 && (
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          tintColor={changeAmount >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
          style={styles.changeCard}
        >
          <Text style={[styles.changeLabel, changeAmount < 0 && styles.changeLabelError]}>
            {changeAmount >= 0 ? 'GIVE CUSTOMER' : 'INSUFFICIENT'}
          </Text>
          <Text
            style={[
              styles.changeAmount,
              changeAmount < 0 && styles.changeAmountError,
            ]}
          >
            ${Math.abs(changeAmount).toFixed(2)}
          </Text>
          <Text style={[styles.changeSubtext, changeAmount < 0 && styles.changeSubtextError]}>
            {changeAmount >= 0 ? 'in change' : `need $${Math.abs(changeAmount).toFixed(2)} more`}
          </Text>
        </LiquidGlassView>
      )}

      {/* Complete Button */}
      <TouchableOpacity
        onPress={handleComplete}
        disabled={!canComplete}
        activeOpacity={0.7}
        style={styles.completeButtonWrapper}
        accessibilityRole="button"
        accessibilityLabel="Complete cash payment"
        accessibilityHint={canComplete ? `Give customer $${changeAmount.toFixed(2)} in change` : `Enter at least $${total.toFixed(2)}`}
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
    marginBottom: 24,
  },
  processingBody: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  processingAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
  },
  statusDivider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 8,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  completionDetails: {
    marginTop: 16,
    alignItems: 'center',
    gap: 6,
  },
  completionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
  },
  completionSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickButton: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: '#10b981',
    borderWidth: 2,
  },
  quickButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: -0.2,
  },
  quickButtonTextActive: {
    color: '#10b981',
  },
  orLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  inputCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  input: {
    fontSize: 34,
    fontWeight: '400',
    color: '#fff',
    textAlign: 'center',
    padding: 0,
    letterSpacing: -0.3,
  },
  changeCard: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  changeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  changeLabelError: {
    color: '#ef4444',
  },
  changeAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  changeAmountError: {
    color: '#ef4444',
  },
  changeSubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(16,185,129,0.7)',
    letterSpacing: 0,
  },
  changeSubtextError: {
    color: 'rgba(239,68,68,0.7)',
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
