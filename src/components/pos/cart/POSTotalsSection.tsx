/**
 * POSTotalsSection Component - Apple Engineering Standard
 *
 * ZERO PROP DRILLING ✅
 * Reads ALL state from stores - no props needed
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import React, { memo, useMemo, useRef, useCallback } from 'react'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import { Button } from '@/theme'
import { logger } from '@/utils/logger'

// Stores (ZERO PROP DRILLING)
import { useCartItems, useCartTotals } from '@/stores/cart.store'
import { useSelectedCustomer } from '@/stores/customer.store'
import { useLoyaltyProgram, usePointsToRedeem, loyaltyActions } from '@/stores/loyalty.store'
import { useSelectedDiscountId, checkoutUIActions } from '@/stores/checkout-ui.store'
import { usePOSSession } from '@/stores/posSession.store'
import { taxActions } from '@/stores/tax.store'
import { useCampaigns } from '@/stores/loyalty-campaigns.store'

function POSTotalsSection() {
  // ========================================
  // STORES - Read ALL state (ZERO PROP DRILLING)
  // ========================================
  const cart = useCartItems()
  const { subtotal } = useCartTotals()
  const selectedCustomer = useSelectedCustomer()
  const loyaltyProgram = useLoyaltyProgram()
  const loyaltyPointsToRedeem = usePointsToRedeem()
  const selectedDiscountId = useSelectedDiscountId()
  const { sessionInfo } = usePOSSession()

  // Get active discounts
  const campaigns = useCampaigns()
  const activeDiscounts = useMemo(() =>
    campaigns.filter(d => d.is_active),
    [campaigns]
  )

  // Get selected discount
  const selectedDiscount = useMemo(() =>
    activeDiscounts.find(d => d.id === selectedDiscountId) || null,
    [activeDiscounts, selectedDiscountId]
  )

  // ========================================
  // CALCULATIONS (from stores) - using store value (no local state)
  // ========================================
  const loyaltyDiscountAmount = loyaltyActions.getDiscountAmount()
  const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscountAmount)

  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0

    if (selectedDiscount.discount_type === 'percentage') {
      return subtotalAfterLoyalty * (selectedDiscount.discount_value / 100)
    } else {
      return Math.min(selectedDiscount.discount_value, subtotalAfterLoyalty)
    }
  }, [selectedDiscount, subtotalAfterLoyalty])

  const subtotalAfterDiscount = Math.max(0, subtotalAfterLoyalty - discountAmount)

  const locationId = sessionInfo?.locationId

  // Tax calculation from tax store
  const { taxAmount, taxRate } = useMemo(() => {
    if (!locationId) {
      return { taxAmount: 0, taxRate: 0.08 }
    }
    return taxActions.calculateTax(subtotalAfterDiscount, locationId)
  }, [subtotalAfterDiscount, locationId])

  const total = subtotalAfterDiscount + taxAmount

  const maxRedeemablePoints = useMemo(() => {
    if (!selectedCustomer) return 0

    const customerPoints = selectedCustomer.loyalty_points || 0
    let pointValue = loyaltyProgram?.point_value || 0.01

    // TEMPORARY FIX: If point_value seems wrong (too high), use 0.05
    // This happens when the loyalty program is misconfigured in the database
    if (pointValue > 1) {
      logger.error('❌ LOYALTY CONFIG ERROR: point_value is too high!', {
        configuredValue: pointValue,
        expectedValue: 0.05,
        fixing: true,
      })
      pointValue = 0.05 // Override with sensible default
    }

    // Calculate max from subtotal (how many points worth of discount can be applied)
    const maxFromSubtotal = Math.floor(subtotal / pointValue)
    const maxPoints = Math.min(customerPoints, maxFromSubtotal)

    // Debug logging
    logger.warn('🎯 LOYALTY DEBUG:', {
      customerName: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`,
      customerPoints,
      subtotal,
      pointValue,
      pointValueFromDB: loyaltyProgram?.point_value,
      wasFixed: (loyaltyProgram?.point_value || 0) > 1,
      calculation: `${subtotal} / ${pointValue} = ${maxFromSubtotal}`,
      maxFromSubtotal,
      finalMaxPoints: maxPoints,
    })

    return maxPoints
  }, [selectedCustomer, subtotal, loyaltyProgram])

  // ========================================
  // SLIDER OPTIMIZATION - Use throttled updates
  // ========================================
  const sliderTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSliderChange = useCallback((value: number) => {
    const roundedValue = Math.round(value)

    // Clear existing timeout
    if (sliderTimeoutRef.current) {
      clearTimeout(sliderTimeoutRef.current)
    }

    // Throttle updates: only update store after 50ms of no movement
    sliderTimeoutRef.current = setTimeout(() => {
      loyaltyActions.setPointsToRedeem(roundedValue)
    }, 50)
  }, [])

  const handleSliderComplete = useCallback((value: number) => {
    // Clear any pending throttled update
    if (sliderTimeoutRef.current) {
      clearTimeout(sliderTimeoutRef.current)
    }

    // Immediate final update
    const roundedValue = Math.round(value)
    loyaltyActions.setPointsToRedeem(roundedValue)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  // ========================================
  // HANDLERS
  // ========================================
  const handleCheckout = () => {
    if (cart.length === 0) return
    logger.debug('🛒 POSTotalsSection: Opening payment modal')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    checkoutUIActions.openModal('payment')
  }

  const showLoyaltyRedemption =
    selectedCustomer &&
    selectedCustomer.loyalty_points > 0 &&
    loyaltyProgram &&
    // @ts-expect-error - LoyaltyProgram schema mismatch (enabled property)
    loyaltyProgram.enabled &&
    maxRedeemablePoints > 0

  // ========================================
  // DISCOUNT SELECTOR STATE
  // ========================================
  const [showDiscountSelector, setShowDiscountSelector] = React.useState(false)

  const handleSelectDiscount = useCallback((discountId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    checkoutUIActions.setSelectedDiscountId(discountId)
    setShowDiscountSelector(false)
  }, [])

  const handleClearDiscount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    checkoutUIActions.setSelectedDiscountId(null)
  }, [])

  return (
    <View style={styles.container}>
      {/* Discount Selector - Only show if there are active discounts */}
      {activeDiscounts.length > 0 && (
        <View style={styles.discountSection}>
          {!selectedDiscount ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setShowDiscountSelector(!showDiscountSelector)
              }}
              style={styles.discountButton}
            >
              <Text style={styles.discountButtonText}>
                {showDiscountSelector ? 'Hide Discounts' : 'Apply Discount'}
              </Text>
              <Text style={styles.discountButtonCount}>
                {activeDiscounts.length} available
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.discountSelected}>
              <View style={styles.discountSelectedInfo}>
                <Text style={styles.discountSelectedName}>{selectedDiscount.name}</Text>
                <Text style={styles.discountSelectedValue}>
                  {selectedDiscount.discount_type === 'percentage'
                    ? `-${selectedDiscount.discount_value}%`
                    : `-$${selectedDiscount.discount_value}`}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClearDiscount} style={styles.discountClearButton}>
                <Text style={styles.discountClearButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Discount List (when expanded) */}
          {showDiscountSelector && !selectedDiscount && (
            <View style={styles.discountList}>
              {activeDiscounts.map((discount) => (
                <TouchableOpacity
                  key={discount.id}
                  onPress={() => handleSelectDiscount(discount.id)}
                  style={styles.discountListItem}
                >
                  <View style={styles.discountListItemInfo}>
                    <Text style={styles.discountListItemName}>{discount.name}</Text>
                    {discount.badge_text && (
                      <Text style={styles.discountListItemDescription}>
                        {discount.badge_text}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.discountListItemValue}>
                    {discount.discount_type === 'percentage'
                      ? `-${discount.discount_value}%`
                      : `-$${discount.discount_value}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

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
                step={loyaltyProgram?.min_redemption_points || 10}
                value={loyaltyPointsToRedeem}
                onValueChange={handleSliderChange}
                onSlidingComplete={handleSliderComplete}
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
                    loyaltyActions.setPointsToRedeem(0)
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
                    loyaltyActions.setPointsToRedeem(maxRedeemablePoints)
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
                loyaltyActions.setPointsToRedeem(maxRedeemablePoints)
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

        {/* Show discount if active */}
        {discountAmount > 0 && selectedDiscount && (
          <View style={styles.totalRow} accessible={false}>
            <Text style={[styles.totalLabel, styles.loyaltyLabel]}>{selectedDiscount.name}</Text>
            <Text style={[styles.totalValue, styles.loyaltyValue]}>
              -${discountAmount.toFixed(2)}
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
          disabled={cart.length === 0}
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
    letterSpacing: -0.1,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.2,
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
    letterSpacing: 0.6,
  },
  finalTotalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
  },
  // Checkout Button Container
  checkoutButtonContainer: {
    marginHorizontal: 16,
    marginBottom: 16, // ✅ Bottom padding - lift off bottom edge
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
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  loyaltyRedemptionAvailable: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
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
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.6,
  },
  loyaltyRedemptionActiveValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.1,
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
  // Discount Selector Section
  discountSection: {
    marginHorizontal: 16,
    gap: 8,
  },
  discountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  discountButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(59,130,246,0.9)',
    letterSpacing: -0.1,
  },
  discountButtonCount: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(59,130,246,0.6)',
    letterSpacing: 0.6,
  },
  // Selected discount pill
  discountSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  discountSelectedInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountSelectedName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.1,
  },
  discountSelectedValue: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(59,130,246,0.9)',
    letterSpacing: -0.1,
  },
  discountClearButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountClearButtonText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
  // Discount list (expanded)
  discountList: {
    gap: 6,
  },
  discountListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  discountListItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  discountListItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  discountListItemDescription: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.05,
  },
  discountListItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(59,130,246,0.9)',
    letterSpacing: -0.2,
  },
})
