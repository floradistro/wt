/**
 * Cash Payment View - TRUE ZERO PROPS ✅
 * Single Responsibility: Handle cash payment input and change calculation
 *
 * ZERO DATA PROPS - Reads from stores:
 * - total (calculated from subtotal + tax)
 * - subtotal, itemCount → cart.store
 * - taxAmount, taxRate, taxName → tax.store
 * - locationId → POSSessionContext
 */

import { useState, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'
import { Sentry } from '@/utils/sentry'
import { useCheckoutTotals } from '@/hooks/useCheckoutTotals'
import { PaymentProcessingAnimation } from './PaymentProcessingAnimation'
import { PaymentActionButton } from './PaymentActionButton'
import type { PaymentData, SaleCompletionData } from './PaymentTypes'

interface CashPaymentViewProps {
  onComplete: (paymentData: PaymentData) => Promise<SaleCompletionData>
  onCancel: () => void
}

export function CashPaymentView({
  onComplete,
  onCancel,
}: CashPaymentViewProps) {
  const { total } = useCheckoutTotals()

  const [cashTendered, setCashTendered] = useState('')
  const [processing, setProcessing] = useState(false)

  // Calculate change
  const changeAmount = useMemo(() => {
    return cashTendered ? parseFloat(cashTendered) - total : 0
  }, [cashTendered, total])

  const canComplete = useMemo(() => {
    return !!cashTendered && !isNaN(parseFloat(cashTendered)) && changeAmount >= 0 && !processing
  }, [cashTendered, changeAmount, processing])

  // Smart quick amounts
  const quickAmounts = useMemo(() => {
    return [
      Math.ceil(total),
      Math.ceil(total / 20) * 20,
      Math.ceil(total / 50) * 50,
      100,
    ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4)
  }, [total])

  const handleQuickAmount = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCashTendered(amount.toString())
  }

  const handleComplete = async () => {
    if (!canComplete) return

    setProcessing(true)

    Sentry.setContext('cash_payment', {
      amount: total,
      cashTendered: parseFloat(cashTendered),
      changeGiven: changeAmount,
    })

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      const paymentData: PaymentData = {
        paymentMethod: 'cash',
        cashTendered: parseFloat(cashTendered),
        changeGiven: changeAmount,
      }

      logger.debug('💵 Processing cash payment...', paymentData)
      await onComplete(paymentData)

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error: any) {
      logger.error('Cash payment error:', error)
      Sentry.captureException(error, {
        level: 'error',
        contexts: {
          cash_payment: {
            amount: total,
            cashTendered: parseFloat(cashTendered),
          },
        },
        tags: { payment_method: 'cash' },
      })
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
          title="Processing Cash Payment"
          subtitle={`Change: $${changeAmount.toFixed(2)}`}
          icon="cash"
          showProgress={false}
        />
      </View>
    )
  }

  const showChange = cashTendered && parseFloat(cashTendered) > 0
  const isValidAmount = changeAmount >= 0

  // ========== SETUP VIEW ==========
  return (
    <View style={styles.container}>
      {/* Main Input Area */}
      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <Text style={styles.currencySymbol} accessibilityElementsHidden>$</Text>
          <TextInput
            style={styles.input}
            value={cashTendered}
            onChangeText={setCashTendered}
            keyboardType="decimal-pad"
            placeholder={total.toFixed(2)}
            placeholderTextColor="rgba(255,255,255,0.2)"
            selectionColor="#10b981"
            accessibilityLabel="Cash tendered amount"
            accessibilityHint={`Enter cash amount. Total due is ${total.toFixed(2)} dollars`}
          />
        </View>

        {/* Quick Amount Buttons */}
        <View style={styles.quickRow} accessibilityRole="radiogroup" accessibilityLabel="Quick cash amounts">
          {quickAmounts.map((amount) => {
            const isSelected = cashTendered === amount.toString()
            return (
              <TouchableOpacity
                key={amount}
                onPress={() => handleQuickAmount(amount)}
                style={[styles.quickPill, isSelected && styles.quickPillActive]}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${amount} dollars`}
              >
                <Text style={[styles.quickPillText, isSelected && styles.quickPillTextActive]}>
                  ${amount}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Change Display - fills remaining space */}
      <View style={styles.changeArea}>
        {showChange ? (
          <View
            style={[styles.changeDisplay, !isValidAmount && styles.changeDisplayError]}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            accessibilityLabel={isValidAmount ? `Change due: ${Math.abs(changeAmount).toFixed(2)} dollars` : `Insufficient funds. Need ${Math.abs(changeAmount).toFixed(2)} more dollars`}
          >
            <Ionicons
              name={isValidAmount ? 'arrow-down-circle' : 'alert-circle'}
              size={28}
              color={isValidAmount ? '#10b981' : '#ef4444'}
            />
            <View style={styles.changeTextGroup}>
              <Text style={[styles.changeLabel, !isValidAmount && styles.changeLabelError]}>
                {isValidAmount ? 'Change Due' : 'Need More'}
              </Text>
              <Text style={[styles.changeAmount, !isValidAmount && styles.changeAmountError]}>
                ${Math.abs(changeAmount).toFixed(2)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyChange} accessibilityLabel="Enter cash amount to calculate change">
            <Ionicons name="cash-outline" size={32} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyChangeText}>Enter cash amount</Text>
          </View>
        )}
      </View>

      {/* Action Button */}
      <PaymentActionButton
        onPress={canComplete ? handleComplete : onCancel}
        isActive={canComplete}
        activeText="Complete Sale"
        activeIcon="checkmark-circle"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
  },

  // Input Area
  inputArea: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 40,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.25)',
    marginRight: 4,
  },
  input: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    padding: 0,
    minWidth: 120,
    textAlign: 'center',
    letterSpacing: -1,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  quickPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickPillActive: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  quickPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  quickPillTextActive: {
    color: '#10b981',
  },

  // Change Area - fills space
  changeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  changeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
  },
  changeDisplayError: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.15)',
  },
  changeTextGroup: {
    alignItems: 'flex-start',
  },
  changeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(16,185,129,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  changeLabelError: {
    color: 'rgba(239,68,68,0.7)',
  },
  changeAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  changeAmountError: {
    color: '#ef4444',
  },
  emptyChange: {
    alignItems: 'center',
    gap: 8,
  },
  emptyChangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.25)',
  },
})
