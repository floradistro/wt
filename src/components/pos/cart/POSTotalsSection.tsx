import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { memo } from 'react'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import type { Customer, LoyaltyProgram } from '@/types/pos'
import { Button } from '@/theme'

interface POSTotalsSectionProps {
  subtotal: number
  loyaltyDiscountAmount: number
  taxAmount: number
  taxRate: number
  total: number
  selectedCustomer: Customer | null
  loyaltyProgram: LoyaltyProgram | null
  loyaltyPointsToRedeem: number
  maxRedeemablePoints: number
  onSetLoyaltyPoints: (points: number) => void
  onCheckout: () => void
  disabled?: boolean
}

function POSTotalsSection({
  subtotal,
  loyaltyDiscountAmount,
  taxAmount,
  taxRate,
  total,
  selectedCustomer,
  loyaltyProgram,
  loyaltyPointsToRedeem,
  maxRedeemablePoints,
  onSetLoyaltyPoints,
  onCheckout,
  disabled = false,
}: POSTotalsSectionProps) {
  const handleCheckout = () => {
    if (disabled) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onCheckout()
  }

  const showLoyaltyRedemption =
    selectedCustomer &&
    selectedCustomer.loyalty_points > 0 &&
    loyaltyProgram &&
    // @ts-expect-error - LoyaltyProgram schema mismatch (enabled property)
    loyaltyProgram.enabled &&
    maxRedeemablePoints > 0

  return (
    <View style={styles.container}>
      {/* Loyalty Points Redemption - Before totals */}
      {showLoyaltyRedemption && (
        <View style={styles.loyaltyRedemptionSection}>
          <View style={styles.loyaltyRedemptionHeader}>
            <Text style={styles.loyaltyRedemptionTitle}>Loyalty Points</Text>
            <Text style={styles.loyaltyRedemptionAvailable}>
              {selectedCustomer.loyalty_points.toLocaleString()} available
            </Text>
          </View>

          {loyaltyPointsToRedeem > 0 ? (
            <>
              <View style={styles.loyaltyRedemptionActive}>
                <Text style={styles.loyaltyRedemptionActiveText}>
                  Using {loyaltyPointsToRedeem.toLocaleString()} points
                </Text>
                <Text style={styles.loyaltyRedemptionActiveValue}>
                  -${loyaltyDiscountAmount.toFixed(2)}
                </Text>
              </View>

              <Slider
                style={styles.loyaltySlider}
                minimumValue={0}
                maximumValue={maxRedeemablePoints}
                step={Math.max(10, loyaltyProgram.min_redemption_points || 10)}
                value={loyaltyPointsToRedeem}
                onValueChange={(value) => onSetLoyaltyPoints(Math.round(value))}
                minimumTrackTintColor="rgba(255,255,255,0.3)"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#fff"
                accessible={true}
                accessibilityRole="adjustable"
                accessibilityLabel="Loyalty points to redeem"
                accessibilityValue={{
                  min: 0,
                  max: maxRedeemablePoints,
                  now: loyaltyPointsToRedeem,
                  text: `${loyaltyPointsToRedeem} points, saving ${loyaltyDiscountAmount.toFixed(2)} dollars`
                }}
                accessibilityHint="Swipe up to increase points, swipe down to decrease points"
              />

              <View style={styles.loyaltyRedemptionActions}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onSetLoyaltyPoints(0)
                  }}
                  style={styles.loyaltyClearButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Clear loyalty points"
                  accessibilityHint="Double tap to remove all redeemed points"
                >
                  <Text style={styles.loyaltyClearButtonText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onSetLoyaltyPoints(maxRedeemablePoints)
                  }}
                  style={styles.loyaltyMaxButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Use maximum loyalty points"
                  accessibilityHint={`Double tap to redeem ${maxRedeemablePoints} points for ${(maxRedeemablePoints * (loyaltyProgram.point_value || 0.01)).toFixed(2)} dollar discount`}
                >
                  <Text style={styles.loyaltyMaxButtonText}>Use Maximum</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onSetLoyaltyPoints(maxRedeemablePoints)
              }}
              style={styles.loyaltyRedeemButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Redeem loyalty points"
              accessibilityHint={`Double tap to redeem ${maxRedeemablePoints} points for ${(maxRedeemablePoints * (loyaltyProgram.point_value || 0.01)).toFixed(2)} dollar discount`}
            >
              <Text style={styles.loyaltyRedeemButtonText}>
                Redeem Points ({maxRedeemablePoints.toLocaleString()} pts = -$
                {(maxRedeemablePoints * (loyaltyProgram.point_value || 0.01)).toFixed(2)})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Totals */}
      <View
        style={styles.totals}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={`Order totals. Subtotal: ${subtotal.toFixed(2)} dollars${
          loyaltyDiscountAmount > 0 ? `. Loyalty discount: ${loyaltyDiscountAmount.toFixed(2)} dollars` : ''
        }. Tax at ${(taxRate * 100).toFixed(2)} percent: ${taxAmount.toFixed(2)} dollars. Total: ${total.toFixed(2)} dollars`}
      >
        <View style={styles.totalRow} accessible={false}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
        </View>

        {/* JOBS PRINCIPLE: Show loyalty discount if active */}
        {loyaltyDiscountAmount > 0 && (
          <View style={styles.totalRow} accessible={false}>
            <Text style={[styles.totalLabel, styles.loyaltyLabel]}>Loyalty Discount</Text>
            <Text style={[styles.totalValue, styles.loyaltyValue]}>
              -${loyaltyDiscountAmount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.totalRow} accessible={false}>
          <Text style={styles.totalLabel}>Tax ({(taxRate * 100).toFixed(2)}%)</Text>
          <Text style={styles.totalValue}>${taxAmount.toFixed(2)}</Text>
        </View>

        <View style={[styles.totalRow, styles.finalTotalRow]} accessible={false}>
          <Text style={styles.finalTotalLabel}>TOTAL</Text>
          <Text style={styles.finalTotalValue}>${total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Checkout Button - Using Design System */}
      <View style={styles.checkoutButtonContainer}>
        <Button
          variant="primary"
          size="large"
          fullWidth
          onPress={handleCheckout}
          disabled={disabled}
        >
          CHECKOUT
        </Button>
      </View>
    </View>
  )
}

const POSTotalsSectionMemo = memo(POSTotalsSection)
export { POSTotalsSectionMemo as POSTotalsSection }

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  // iOS 26 Totals - Clean typography
  totals: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.2,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  loyaltyLabel: {
    color: 'rgba(255,255,255,0.7)',
  },
  loyaltyValue: {
    color: '#10b981',
    fontWeight: '600',
  },
  finalTotalRow: {
    paddingTop: 14,
    marginTop: 10,
    borderTopWidth: 0.33,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  finalTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.5,
  },
  finalTotalValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.5,
  },
  // Checkout Button Container
  checkoutButtonContainer: {
    marginHorizontal: 16,
  },
  // Loyalty Redemption Section
  loyaltyRedemptionSection: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    gap: 12,
  },
  loyaltyRedemptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltyRedemptionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  loyaltyRedemptionAvailable: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  loyaltyRedemptionActive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loyaltyRedemptionActiveText: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
  },
  loyaltyRedemptionActiveValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loyaltySlider: {
    width: '100%',
    height: 40,
  },
  loyaltyRedemptionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  loyaltyClearButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
  },
  loyaltyClearButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  loyaltyMaxButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    alignItems: 'center',
  },
  loyaltyMaxButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  loyaltyRedeemButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 12,
    alignItems: 'center',
  },
  loyaltyRedeemButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: -0.2,
  },
})
