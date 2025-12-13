/**
 * POSLoyaltySlider - MINIMALIST REDESIGN
 * Apple Engineering: Show points ONCE. Clear UI. No redundancy.
 *
 * ALL LOYALTY INFO IN ONE PLACE:
 * - Available points (ONLY place points are shown)
 * - Slider
 * - Redeeming info (when active)
 * - Actions (Clear/Max)
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { memo, useMemo } from 'react'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import { colors, spacing } from '@/theme/tokens'

// Stores
import { useCartTotals } from '@/stores/cart.store'
import { useSelectedCustomer } from '@/stores/customer.store'
import { useLoyaltyState, loyaltyActions } from '@/stores/loyalty-campaigns.store'

function POSLoyaltySliderComponent() {
  // State from Zustand
  const { subtotal } = useCartTotals()
  const selectedCustomer = useSelectedCustomer()
  const { loyaltyProgram, pointsToRedeem } = useLoyaltyState()

  // Computed values
  const pointValue = loyaltyProgram?.point_value || 0.01
  const customerPoints = selectedCustomer?.loyalty_points || 0

  const maxRedeemablePoints = useMemo(() => {
    if (!customerPoints) return 0
    const maxFromSubtotal = Math.floor(subtotal / pointValue)
    return Math.min(customerPoints, maxFromSubtotal)
  }, [customerPoints, subtotal, pointValue])

  const dollarDiscount = useMemo(() => {
    return pointsToRedeem * pointValue
  }, [pointsToRedeem, pointValue])

  // Actions
  const handleSliderChange = (value: number) => {
    const roundedValue = Math.round(value)
    if (roundedValue !== pointsToRedeem) {
      loyaltyActions.setPointsToRedeem(roundedValue)
    }
  }

  const handleClearPoints = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    loyaltyActions.setPointsToRedeem(0)
  }

  const handleMaxPoints = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    loyaltyActions.setPointsToRedeem(maxRedeemablePoints)
  }

  if (maxRedeemablePoints === 0) return null

  return (
    <View style={styles.container}>
      {/* ========================================
          HEADER - Points available (ONLY place points shown!)
      ======================================== */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>LOYALTY POINTS</Text>
        <Text style={styles.headerPoints}>
          {customerPoints.toLocaleString()} pts
        </Text>
      </View>

      {/* ========================================
          ACTIVE REDEMPTION - Show what they're using
      ======================================== */}
      {pointsToRedeem > 0 && (
        <View style={styles.redemptionActive}>
          <Text style={styles.redemptionPoints}>
            {pointsToRedeem.toLocaleString()} points
          </Text>
          <Text style={styles.redemptionDiscount}>
            -${dollarDiscount.toFixed(2)}
          </Text>
        </View>
      )}

      {/* ========================================
          SLIDER
      ======================================== */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={maxRedeemablePoints}
        step={1}
        value={pointsToRedeem}
        onValueChange={handleSliderChange}
        onSlidingComplete={() => {
          if (pointsToRedeem > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          }
        }}
        minimumTrackTintColor={colors.semantic.success}
        maximumTrackTintColor={colors.border.regular}
        thumbTintColor={colors.text.primary}
      />

      {/* ========================================
          BUTTONS - Clear & Max
      ======================================== */}
      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={handleClearPoints}
          style={[styles.button, styles.buttonClear]}
          disabled={pointsToRedeem === 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, pointsToRedeem === 0 && styles.buttonTextDisabled]}>
            Clear
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleMaxPoints}
          style={[styles.button, styles.buttonMax]}
          disabled={pointsToRedeem === maxRedeemablePoints}
          activeOpacity={0.7}
        >
          <Text style={[styles.buttonText, pointsToRedeem === maxRedeemablePoints && styles.buttonTextDisabled]}>
            Max
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export const POSLoyaltySlider = memo(POSLoyaltySliderComponent)

// ========================================
// STYLES - Minimal & Clean
// ========================================
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md, // 16px
    paddingVertical: spacing.md, // 16px
  },

  // Header - Points info
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm, // 12px
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  headerPoints: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.semantic.success,
    letterSpacing: -0.1,
  },

  // Active redemption display
  redemptionActive: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.xs, // 8px
  },
  redemptionPoints: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  redemptionDiscount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.semantic.success,
    letterSpacing: -0.4,
  },

  // Slider
  slider: {
    width: '100%',
    height: 40,
    marginVertical: spacing.xxs, // 4px
  },

  // Buttons
  buttons: {
    flexDirection: 'row',
    gap: spacing.xs, // 8px
    marginTop: spacing.xs, // 8px
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.glass.regular,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  buttonClear: {
    // Inherits base button
  },
  buttonMax: {
    backgroundColor: colors.semantic.successBg,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  buttonTextDisabled: {
    color: colors.text.disabled,
  },
})
