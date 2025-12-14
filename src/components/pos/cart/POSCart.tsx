/**
 * POSCart Component - ZERO PROPS ARCHITECTURE
 * Apple Engineering Standard: Complete store-based architecture
 *
 * Store usage:
 * - cart.store: Cart data and actions
 * - checkout-ui.store: UI state (modals)
 * - customer.store: Customer selection and actions
 *
 * All state and actions read/dispatched through stores = zero prop drilling!
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useCallback, useState } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as Haptics from 'expo-haptics'
import { POSCartItem } from './POSCartItem'
import { POSTotalsSection } from './POSTotalsSection'
import { POSMissingContactBanner } from '../POSMissingContactBanner'
import { POSUpdateContactModal } from '../POSUpdateContactModal'
import { POSScannedOrderCard } from '../POSScannedOrderCard'
import { layout } from '@/theme/layout'

// Stores
import { useCartItems, cartActions, useCartTotals } from '@/stores/cart.store'
import { checkoutUIActions } from '@/stores/checkout-ui.store'
import { useSelectedCustomer, customerActions } from '@/stores/customer.store'
import { useScannedOrder } from '@/stores/scanned-order.store'

interface POSCartProps {
  onEndSession?: () => void
}

export function POSCart({ onEndSession }: POSCartProps) {
  // ========================================
  // LOCAL STATE
  // ========================================
  const [showUpdateContactModal, setShowUpdateContactModal] = useState(false)

  // ========================================
  // STORES - Cart Data
  // ========================================
  const cart = useCartItems()
  const { subtotal, itemCount } = useCartTotals()

  // ========================================
  // STORES - Scanned Pickup Order
  // ========================================
  const scannedOrder = useScannedOrder()

  // ========================================
  // STORES - Customer
  // ========================================
  const selectedCustomer = useSelectedCustomer()

  // ========================================
  // HANDLERS (MEMOIZED to prevent re-render loops)
  // ========================================
  const handleSelectCustomer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    checkoutUIActions.openModal('customerSelector')
  }, [])

  const handleClearCustomer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    customerActions.clearCustomer()
  }, [])

  const handleEndSession = useCallback(() => {
    if (onEndSession) {
      onEndSession()
    }
  }, [onEndSession])

  const handleClearCart = useCallback(() => {
    cartActions.clearCart()
    cartActions.setDiscountingItemId(null)
  }, [])

  const handleUpdateContactInfo = useCallback(() => {
    setShowUpdateContactModal(true)
  }, [])

  // ========================================
  // RENDER - Scanned Order takes precedence
  // ========================================
  if (scannedOrder) {
    return (
      <View style={styles.cartCard}>
        <POSScannedOrderCard />
      </View>
    )
  }

  return (
    <View style={styles.cartCard}>
      {/* Update Contact Modal */}
      <POSUpdateContactModal
        visible={showUpdateContactModal}
        onClose={() => setShowUpdateContactModal(false)}
      />

      {/* iOS 26 Perfectly Simple Cart Header */}
      <View style={styles.cartHeader}>
        {/* Customer Section - iOS 26 Rounded Container or Pill Button */}
        {!selectedCustomer ? (
          <LiquidGlassView
            key="customer-pill-empty"
            effect="regular"
            colorScheme="dark"
            tintColor="rgba(255,255,255,0.05)"
            interactive
            style={[
              styles.customerPillButton,
              !isLiquidGlassSupported && styles.customerPillButtonFallback
            ]}
          >
            <TouchableOpacity
              onPress={handleSelectCustomer}
              style={styles.customerPillButtonPressable}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Select customer"
              accessibilityHint="Opens customer selection to apply loyalty points or track purchase"
            >
              <Text style={styles.customerPillText}>Customer</Text>
            </TouchableOpacity>
          </LiquidGlassView>
        ) : (
          <LiquidGlassView
            key={`customer-pill-${selectedCustomer.id}`}
            effect="regular"
            colorScheme="dark"
            interactive
            style={[
              styles.customerPill,
              !isLiquidGlassSupported && styles.customerPillFallback
            ]}
          >
            <TouchableOpacity
              onPress={handleSelectCustomer}
              style={styles.customerPillPressable}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Selected customer: ${selectedCustomer.display_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim() || selectedCustomer.email}${selectedCustomer.loyalty_points > 0 ? `, ${selectedCustomer.loyalty_points} loyalty points` : ''}`}
              accessibilityHint="Tap to change customer or view customer details"
            >
            <View style={styles.customerPillContent}>
              <View style={styles.customerPillTextContainer}>
                <Text style={styles.customerPillName} numberOfLines={1}>
                  {selectedCustomer.display_name ||
                    `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim() ||
                    selectedCustomer.email}
                </Text>
                {selectedCustomer.loyalty_points > 0 && (
                  <Text style={styles.customerPillPoints}>
                    {selectedCustomer.loyalty_points.toLocaleString()} pts
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  handleClearCustomer()
                }}
                style={styles.customerPillClearButton}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Clear customer selection"
                accessibilityHint="Removes customer from this transaction"
              >
                <Text style={styles.customerPillClearText}>×</Text>
              </TouchableOpacity>
            </View>
            </TouchableOpacity>
          </LiquidGlassView>
        )}

        {/* Missing Contact Banner - shows when customer needs email/phone */}
        {selectedCustomer && (
          <POSMissingContactBanner onUpdateCustomer={handleUpdateContactInfo} />
        )}

        {/* Clear Cart Button - Pill Style */}
        {cart.length > 0 && (
          <LiquidGlassView
            key="clear-cart-button"
            effect="regular"
            colorScheme="dark"
            tintColor="rgba(255,255,255,0.05)"
            interactive
            style={[
              styles.customerPillButton,
              !isLiquidGlassSupported && styles.customerPillButtonFallback
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                handleClearCart()
              }}
              style={styles.customerPillButtonPressable}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear cart"
              accessibilityHint="Removes all items from cart"
            >
              <Text style={styles.customerPillText}>Clear Cart</Text>
            </TouchableOpacity>
          </LiquidGlassView>
        )}
      </View>

      {/* Cart Items */}
      <ScrollView
        style={styles.cartItems}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
        scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
        contentContainerStyle={{ paddingBottom: layout.dockHeight }}
      >
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyCartText}>Cart is empty</Text>
            <Text style={styles.emptyCartSubtext}>Add items to get started</Text>
          </View>
        ) : (
          cart.map((item) => (
            <POSCartItem
              key={item.id}
              item={item}
            />
          ))
        )}
      </ScrollView>

      {cart.length > 0 && (
        <>
          <View style={styles.cartDivider} />

          {/* Totals and Checkout */}
          <POSTotalsSection />
        </>
      )}

      {/* Jobs Principle: End Session - Bottom of cart, subtle, out of the way */}
      <TouchableOpacity
        onPress={handleEndSession}
        style={styles.endSessionFooter}
        accessibilityRole="button"
        accessibilityLabel="End session"
        accessibilityHint="Closes the current POS session and returns to session setup"
      >
        <Text style={styles.endSessionFooterText}>End Session</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  cartCard: {
    flex: 1,
    // No background - let LiquidGlassView container handle it
  },
  cartHeader: {
    padding: 12,
    gap: 8,
  },
  customerPillButton: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 44,
  },
  customerPillButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  customerPillButtonPressable: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  customerPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  customerPill: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 44,
  },
  customerPillFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  customerPillPressable: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  customerPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  customerPillTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerPillName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  customerPillPoints: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  customerPillClearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerPillClearText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  cartItems: {
    flex: 1,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCartText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
  },
  emptyCartSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
  },
  cartDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },
  endSessionFooter: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  endSessionFooterText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
})
