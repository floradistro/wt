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
import { usePOSSession } from '@/contexts/POSSessionContext'
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
  const { session } = usePOSSession()

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

  const locationId = session?.locationId

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

    // Debug logging - only log in development to reduce Sentry noise
    if (__DEV__) {
      logger.debug('🎯 LOYALTY CALCULATION:', {
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
    }

    return maxPoints
  }, [selectedCustomer, subtotal, loyaltyProgram])

  // ========================================
  // SLIDER - INSTANT UPDATES
  // ========================================
  const handleSliderChange = useCallback((value: number) => {
    const roundedValue = Math.round(value)
    loyaltyActions.setPointsToRedeem(roundedValue)
  }, [])

  const handleSliderComplete = useCallback(() => {
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
    maxRedeemablePoints > 0

  // Debug: Log why loyalty slider might not be showing
  logger.debug('🔍 LOYALTY SLIDER VISIBILITY:', {
    showLoyaltyRedemption,
    hasSelectedCustomer: !!selectedCustomer,
    customerPoints: selectedCustomer?.loyalty_points || 0,
    hasLoyaltyProgram: !!loyaltyProgram,
    programIsActive: loyaltyProgram?.is_active,
    maxRedeemablePoints,
  })

  return (
    <View style={styles.container}>

      {/* Loyalty Points Slider - Minimal, inline */}
      {showLoyaltyRedemption && (
        <View style={styles.loyaltyInline}>
          <Text style={styles.loyaltyInlineText}>
            {loyaltyPointsToRedeem} pts
          </Text>
          <Slider
            style={styles.loyaltySlider}
            minimumValue={0}
            maximumValue={maxRedeemablePoints}
            step={1}
            value={loyaltyPointsToRedeem}
            onValueChange={handleSliderChange}
            onSlidingComplete={handleSliderComplete}
            minimumTrackTintColor="rgba(255,255,255,0.3)"
            maximumTrackTintColor="rgba(255,255,255,0.1)"
            thumbTintColor="#fff"
          />
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
  // Loyalty Points - Minimal inline
  loyaltyInline: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loyaltyInlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    width: 60,
    textAlign: 'right',
  },
  loyaltySlider: {
    flex: 1,
    height: 40,
  },
})
