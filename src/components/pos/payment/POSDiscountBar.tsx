/**
 * POSDiscountBar - Horizontal Discount Pills + Loyalty Slider
 *
 * Apple Design: Clean horizontal layout
 * - Discount pills: Horizontal scroll with individual pills per discount
 * - Loyalty slider: Sleek inline slider when customer has points
 */

import { useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

// Stores
import { useSelectedCustomer } from '@/stores/customer.store'
import { useCartTotals } from '@/stores/cart.store'
import {
  useLoyaltyProgram,
  usePointsToRedeem,
  loyaltyActions,
  useCampaigns,
} from '@/stores/loyalty-campaigns.store'
import { useSelectedDiscountId, checkoutUIActions } from '@/stores/checkout-ui.store'

export function POSDiscountBar() {
  // ========================================
  // STORES
  // ========================================
  const selectedCustomer = useSelectedCustomer()
  const { subtotal } = useCartTotals()
  const loyaltyProgram = useLoyaltyProgram()
  const pointsToRedeem = usePointsToRedeem()
  const selectedDiscountId = useSelectedDiscountId()
  const campaigns = useCampaigns()

  // ========================================
  // COMPUTED
  // ========================================
  const pointValue = loyaltyProgram?.point_value || 0.01
  const customerPoints = selectedCustomer?.loyalty_points || 0
  const loyaltyDiscount = pointsToRedeem * pointValue

  const maxRedeemablePoints = useMemo(() => {
    if (!selectedCustomer || !loyaltyProgram?.is_active) return 0
    const maxPointsFromSubtotal = Math.floor(subtotal / pointValue)
    return Math.min(customerPoints, maxPointsFromSubtotal)
  }, [selectedCustomer, loyaltyProgram, subtotal, pointValue, customerPoints])

  const showLoyaltySlider = selectedCustomer && customerPoints > 0 && loyaltyProgram?.is_active && maxRedeemablePoints > 0

  // Active POS discounts
  const activeDiscounts = useMemo(() => {
    return campaigns.filter((d) => {
      if (!d.is_active) return false
      const salesChannel = (d as any).sales_channel || 'both'
      return salesChannel === 'in_store' || salesChannel === 'both'
    })
  }, [campaigns])

  const showDiscounts = activeDiscounts.length > 0

  // Nothing to show
  if (!showLoyaltySlider && !showDiscounts) return null

  // ========================================
  // HANDLERS
  // ========================================
  const handleSliderChange = useCallback((value: number) => {
    const roundedValue = Math.round(value)
    loyaltyActions.setPointsToRedeem(roundedValue)
  }, [])

  const handleSliderComplete = useCallback(() => {
    if (pointsToRedeem > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [pointsToRedeem])

  const handleToggleMax = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    loyaltyActions.setPointsToRedeem(
      pointsToRedeem === maxRedeemablePoints ? 0 : maxRedeemablePoints
    )
  }, [pointsToRedeem, maxRedeemablePoints])

  const handleSelectDiscount = useCallback((discountId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // Toggle off if already selected
    if (selectedDiscountId === discountId) {
      checkoutUIActions.setSelectedDiscountId(null)
    } else {
      checkoutUIActions.setSelectedDiscountId(discountId)
    }
  }, [selectedDiscountId])

  // ========================================
  // RENDER
  // ========================================
  return (
    <View style={styles.container}>
      {/* Discount Pills - Horizontal Scroll */}
      {showDiscounts && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.discountPillsContainer}
          style={styles.discountPillsScroll}
        >
          {activeDiscounts.map((discount) => {
            const isSelected = selectedDiscountId === discount.id
            const discountLabel = discount.discount_type === 'percentage'
              ? `${discount.discount_value}% off`
              : `$${discount.discount_value.toFixed(0)} off`

            return (
              <TouchableOpacity
                key={discount.id}
                onPress={() => handleSelectDiscount(discount.id)}
                style={[styles.discountPill, isSelected && styles.discountPillActive]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'pricetag-outline'}
                  size={14}
                  color={isSelected ? '#10b981' : 'rgba(255,255,255,0.5)'}
                />
                <Text style={[styles.discountPillText, isSelected && styles.discountPillTextActive]}>
                  {discount.name}
                </Text>
                <View style={[styles.discountBadge, isSelected && styles.discountBadgeActive]}>
                  <Text style={[styles.discountBadgeText, isSelected && styles.discountBadgeTextActive]}>
                    {discountLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Loyalty Slider - Minimal: just points counter + slider */}
      {showLoyaltySlider && (
        <TouchableOpacity onPress={handleToggleMax} style={styles.loyaltyContainer} activeOpacity={0.8}>
          <Text style={styles.pointsValue}>
            {pointsToRedeem > 0 ? `-$${loyaltyDiscount.toFixed(2)}` : `${customerPoints.toLocaleString()} pts`}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={maxRedeemablePoints}
            step={1}
            value={pointsToRedeem}
            onValueChange={handleSliderChange}
            onSlidingComplete={handleSliderComplete}
            minimumTrackTintColor="#10b981"
            maximumTrackTintColor="rgba(255,255,255,0.1)"
            thumbTintColor="#10b981"
          />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    gap: 10,
  },

  // Discount Pills - Horizontal
  discountPillsScroll: {
    marginHorizontal: -24, // Bleed to edges
  },
  discountPillsContainer: {
    paddingHorizontal: 24,
    gap: 8,
    flexDirection: 'row',
  },
  discountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  discountPillActive: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  discountPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  discountPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  discountBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  discountBadgeActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  discountBadgeTextActive: {
    color: '#10b981',
  },

  // Loyalty Slider - Minimal
  loyaltyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pointsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    minWidth: 70,
  },
  slider: {
    flex: 1,
    height: 32,
  },
})
