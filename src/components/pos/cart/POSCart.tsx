/**
 * POSCart Component - MINIMALIST REDESIGN
 * Apple Engineering: Everything in its place. Zero redundancy.
 *
 * RULES:
 * - Show each data point ONCE
 * - No duplicate buttons
 * - Clean, minimal, sexy
 * - NO EMOJIS EVER
 * - Empty cart = NOTHING (just customer button + end session)
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { memo } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { POSCartItem } from './POSCartItem'
import { POSTotalsSection } from './POSTotalsSection'
import { POSLoyaltySlider } from './POSLoyaltySlider'
import { colors, spacing } from '@/theme/tokens'

// Stores
import { useCartItems, cartActions } from '@/stores/cart.store'
import { checkoutUIActions } from '@/stores/checkout-ui.store'
import { useSelectedCustomer, customerActions } from '@/stores/customer.store'
import { useLoyaltyState, loyaltyActions } from '@/stores/loyalty.store'
import { posSessionActions } from '@/stores/posSession.store'

function POSCartComponent() {
  // State from Zustand
  const cart = useCartItems()
  const selectedCustomer = useSelectedCustomer()
  const { loyaltyProgram } = useLoyaltyState()

  const hasLoyaltyProgram = Boolean(loyaltyProgram)
  const customerHasPoints = selectedCustomer && selectedCustomer.loyalty_points > 0
  const cartIsEmpty = cart.length === 0

  // Actions
  const handleSelectCustomer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    checkoutUIActions.openModal('customerSelector')
  }

  const handleRemoveCustomer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    customerActions.clearCustomer()
    loyaltyActions.setPointsToRedeem(0)
    cartActions.clearCart()
    checkoutUIActions.setSelectedDiscountId(null)
  }

  const handleEndSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    posSessionActions.endSession()
  }

  return (
    <View style={styles.cartCard}>
      {/* ========================================
          HEADER - Customer ONLY
      ======================================== */}
      <View style={styles.cartHeader}>
        {!selectedCustomer ? (
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            interactive
            style={[styles.customerButton, !isLiquidGlassSupported && styles.customerButtonFallback]}
          >
            <TouchableOpacity
              onPress={handleSelectCustomer}
              style={styles.customerButtonPressable}
              activeOpacity={0.7}
            >
              <Text style={styles.customerButtonText}>Select Customer</Text>
            </TouchableOpacity>
          </LiquidGlassView>
        ) : (
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            interactive
            style={[styles.customerPill, !isLiquidGlassSupported && styles.customerPillFallback]}
          >
            <View style={styles.customerPillContent}>
              <Text style={styles.customerName} numberOfLines={1}>
                {selectedCustomer.display_name ||
                  `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim() ||
                  'Customer'}
              </Text>
              <TouchableOpacity
                onPress={handleRemoveCustomer}
                style={styles.customerRemoveButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.customerRemoveIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          </LiquidGlassView>
        )}
      </View>

      {/* ========================================
          CART ITEMS (or empty state)
      ======================================== */}
      <ScrollView
        style={styles.cartItems}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        contentContainerStyle={[
          styles.cartItemsContent,
          cartIsEmpty && styles.cartItemsContentEmpty,
        ]}
      >
        {cartIsEmpty ? (
          <View style={styles.emptyCart}>
            {/* NOTHING - Pure minimalism */}
          </View>
        ) : (
          cart.map((item, index) => (
            <POSCartItem
              key={item.id}
              item={item}
              isLast={index === cart.length - 1}
            />
          ))
        )}
      </ScrollView>

      {/* ========================================
          LOYALTY SLIDER - Only when cart has items
      ======================================== */}
      {!cartIsEmpty && selectedCustomer && hasLoyaltyProgram && customerHasPoints && (
        <>
          <View style={styles.divider} />
          <POSLoyaltySlider />
        </>
      )}

      {/* ========================================
          TOTALS & CHECKOUT - Only when cart has items
      ======================================== */}
      {!cartIsEmpty && (
        <>
          <View style={styles.divider} />
          <POSTotalsSection />
        </>
      )}

      {/* ========================================
          END SESSION - Only when cart is empty
      ======================================== */}
      {cartIsEmpty && (
        <View style={styles.endSessionContainer}>
          <TouchableOpacity
            onPress={handleEndSession}
            style={styles.endSessionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.endSessionText}>End Session</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export const POSCart = memo(POSCartComponent)

// ========================================
// STYLES - Minimal, Clean, No Redundancy
// ========================================
const styles = StyleSheet.create({
  cartCard: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Header
  cartHeader: {
    paddingHorizontal: spacing.xs, // 8px
    paddingVertical: spacing.xs, // 8px
    minHeight: 60,
  },

  // Customer Button (No customer)
  customerButton: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  customerButtonFallback: {
    backgroundColor: colors.glass.regular,
  },
  customerButtonPressable: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  customerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },

  // Customer Pill (Clean - name + X only)
  customerPill: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  customerPillFallback: {
    backgroundColor: colors.glass.regular,
  },
  customerPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 20,
    paddingRight: 12,
    minHeight: 44,
  },
  customerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  customerRemoveButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerRemoveIcon: {
    fontSize: 18,
    color: colors.text.tertiary,
  },

  // Cart Items
  cartItems: {
    flex: 1,
  },
  cartItemsContent: {
    paddingBottom: spacing.xs, // 8px
  },
  cartItemsContentEmpty: {
    flex: 1, // Fill available space when empty
  },

  // Empty State - NOTHING (pure minimalism)
  emptyCart: {
    flex: 1,
    // No content, no visual noise
  },

  // End Session (bottom of empty cart)
  endSessionContainer: {
    paddingHorizontal: spacing.md, // 16px
    paddingVertical: spacing.md, // 16px
  },
  endSessionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.glass.regular,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  endSessionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: -0.2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.xs, // 8px
  },
})
