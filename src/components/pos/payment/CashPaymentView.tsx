/**
 * Cash Payment View
 * Single Responsibility: Handle cash payment input and change calculation
 * Apple Standard: Component < 300 lines
 */

import { useState, useMemo } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import type { BasePaymentViewProps, PaymentData } from './PaymentTypes'

interface CashPaymentViewProps extends BasePaymentViewProps {
  onComplete: (paymentData: PaymentData) => void
}

export function CashPaymentView({
  total,
  onComplete,
}: CashPaymentViewProps) {
  const [cashTendered, setCashTendered] = useState('')

  // Calculate change
  const changeAmount = useMemo(() => {
    return cashTendered ? parseFloat(cashTendered) - total : 0
  }, [cashTendered, total])

  const canComplete = useMemo(() => {
    return cashTendered && !isNaN(parseFloat(cashTendered)) && changeAmount >= 0
  }, [cashTendered, changeAmount])

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

  const handleComplete = () => {
    if (!canComplete) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const paymentData: PaymentData = {
      paymentMethod: 'cash',
      cashTendered: parseFloat(cashTendered),
      changeGiven: changeAmount,
    }

    onComplete(paymentData)
  }

  return (
    <View style={styles.container}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
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
