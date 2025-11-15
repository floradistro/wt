import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

interface POSTotalsSectionProps {
  subtotal: number
  loyaltyDiscountAmount: number
  taxAmount: number
  taxRate: number
  total: number
  onCheckout: () => void
  disabled?: boolean
}

export function POSTotalsSection({
  subtotal,
  loyaltyDiscountAmount,
  taxAmount,
  taxRate,
  total,
  onCheckout,
  disabled = false,
}: POSTotalsSectionProps) {
  const handleCheckout = () => {
    if (disabled) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onCheckout()
  }

  return (
    <View style={styles.container}>
      {/* Totals */}
      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
        </View>

        {/* JOBS PRINCIPLE: Show loyalty discount if active */}
        {loyaltyDiscountAmount > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.loyaltyLabel]}>Loyalty Discount</Text>
            <Text style={[styles.totalValue, styles.loyaltyValue]}>
              -${loyaltyDiscountAmount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax ({(taxRate * 100).toFixed(2)}%)</Text>
          <Text style={styles.totalValue}>${taxAmount.toFixed(2)}</Text>
        </View>

        <View style={[styles.totalRow, styles.finalTotalRow]}>
          <Text style={styles.finalTotalLabel}>TOTAL</Text>
          <Text style={styles.finalTotalValue}>${total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Checkout Button */}
      <TouchableOpacity
        onPress={handleCheckout}
        disabled={disabled}
        style={[styles.checkoutButton, disabled && styles.checkoutButtonDisabled]}
        activeOpacity={0.8}
      >
        <View style={styles.checkoutButtonBg}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        </View>
        <Text style={styles.checkoutButtonText}>CHECKOUT</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  totals: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.9)',
  },
  loyaltyLabel: {
    color: 'rgba(100,200,255,0.9)',
  },
  loyaltyValue: {
    color: '#10b981',
    fontWeight: '500',
  },
  finalTotalRow: {
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  finalTotalLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
  },
  finalTotalValue: {
    fontSize: 20,
    fontWeight: '300',
    color: '#fff',
  },
  checkoutButton: {
    marginHorizontal: 16,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  checkoutButtonDisabled: {
    opacity: 0.4,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  checkoutButtonBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59,130,246,0.3)',
  },
  checkoutButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 3,
    zIndex: 1,
  },
})
