/**
 * POSTotalsSection Component - Apple Engineering Standard
 *
 * ZERO PROP DRILLING ✅
 * Reads ALL state from stores - no props needed
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import React, { memo, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { logger } from '@/utils/logger'

// Stores (ZERO PROP DRILLING)
import { useCartItems, useCartTotals } from '@/stores/cart.store'
import { useSelectedCustomer } from '@/stores/customer.store'
import { useSelectedDiscountId, checkoutUIActions } from '@/stores/checkout-ui.store'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { taxActions } from '@/stores/tax.store'
import { useCampaigns, useLoyaltyProgram, usePointsToRedeem } from '@/stores/loyalty-campaigns.store'

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
  // Calculate loyalty discount using correct loyaltyProgram from loyalty-campaigns store
  const loyaltyDiscountAmount = useMemo(() => {
    if (!loyaltyPointsToRedeem || !loyaltyProgram) return 0
    const pointValue = loyaltyProgram.point_value || 0.01
    return loyaltyPointsToRedeem * pointValue
  }, [loyaltyPointsToRedeem, loyaltyProgram])
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

  // ========================================
  // HANDLERS
  // ========================================
  const handleCheckout = () => {
    if (cart.length === 0) return
    logger.debug('🛒 POSTotalsSection: Opening payment modal')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    checkoutUIActions.openModal('payment')
  }

  return (
    <View style={styles.container}>
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

      {/* Checkout Button - Liquid Glass Style */}
      <View style={styles.checkoutButtonContainer}>
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          tintColor="rgba(255,255,255,0.08)"
          interactive
          style={[
            styles.checkoutButton,
            !isLiquidGlassSupported && styles.checkoutButtonFallback,
            cart.length === 0 && styles.checkoutButtonDisabled,
          ]}
        >
          <TouchableOpacity
            onPress={handleCheckout}
            disabled={cart.length === 0}
            style={styles.checkoutButtonPressable}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Checkout. Total: ${total.toFixed(2)} dollars`}
          >
            <Text style={[
              styles.checkoutButtonText,
              cart.length === 0 && styles.checkoutButtonTextDisabled,
            ]}>
              CHECKOUT
            </Text>
          </TouchableOpacity>
        </LiquidGlassView>
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
    borderTopColor: 'rgba(255,255,255,0.06)', // Match modal border styling
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
  // Checkout Button - Liquid Glass Style
  checkoutButtonContainer: {
    marginHorizontal: 12,
    marginBottom: 16,
  },
  checkoutButton: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 52,
  },
  checkoutButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  checkoutButtonDisabled: {
    opacity: 0.4,
  },
  checkoutButtonPressable: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  checkoutButtonTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
})
