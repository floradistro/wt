/**
 * POSCart Component (ZERO PROP DRILLING)
 * Apple Engineering Standard: Complete elimination of prop drilling
 *
 * BEFORE: 25+ props (15+ callback handlers)
 * AFTER: 0 props ✅
 *
 * ALL state now from stores:
 * - cart.store: Cart data and actions
 * - customer.store: Customer selection
 * - loyalty.store: Loyalty points and rewards
 * - products.store: Product catalog
 * - checkout-ui.store: Modal orchestration and UI state
 * - tax.store: Tax calculations
 * - posSession.store: Session management
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native'
import { memo, useRef, useMemo, useCallback } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import { POSCartItem } from './POSCartItem'
import { POSTotalsSection } from './POSTotalsSection'
import { POSProductCard } from '../POSProductCard'
import { layout } from '@/theme/layout'

// Stores (ZERO PROP DRILLING)
import { useCartItems, cartActions, useCartTotals, useDiscountingItemId } from '@/stores/cart.store'
import {
  useSelectedDiscountId,
  useTierSelectorProductId,
  useShowDiscountSelector,
  checkoutUIActions,
} from '@/stores/checkout-ui.store'
import { useSelectedCustomer, customerActions } from '@/stores/customer.store'
import { useLoyaltyState, loyaltyActions } from '@/stores/loyalty.store'
import { useProducts } from '@/stores/products.store'
import { taxActions } from '@/stores/tax.store'
import { posSessionActions, usePOSSession } from '@/stores/posSession.store'

// Hooks
import { useCampaigns } from '@/hooks/useCampaigns'

const { width: _width } = Dimensions.get('window')

// ========================================
// ZERO PROP DRILLING COMPONENT ✅
// ========================================
function POSCart() {
  // ========================================
  // STORES - All state from Zustand (ZERO PROP DRILLING)
  // ========================================
  // Cart
  const cart = useCartItems()
  const { subtotal, itemCount } = useCartTotals()
  const discountingItemId = useDiscountingItemId()

  // Customer
  const selectedCustomer = useSelectedCustomer()

  // Loyalty
  const { loyaltyProgram, pointsToRedeem } = useLoyaltyState()
  const loyaltyDiscountAmount = loyaltyActions.getDiscountAmount()

  // Products
  const products = useProducts()

  // Session (for locationId to calculate tax)
  const { sessionInfo } = usePOSSession()

  // Checkout UI
  const selectedDiscountId = useSelectedDiscountId()
  const tierSelectorProductId = useTierSelectorProductId()
  const showDiscountSelector = useShowDiscountSelector()

  // ========================================
  // HOOKS - Discounts
  // ========================================
  const { campaigns: discounts } = useCampaigns()
  const activeDiscounts = useMemo(() => discounts.filter(d => d.is_active), [discounts])

  // ========================================
  // REFS
  // ========================================
  const productCardRef = useRef<any>(null)

  // ========================================
  // COMPUTED VALUES
  // ========================================
  const selectedDiscount = useMemo(
    () => activeDiscounts.find(d => d.id === selectedDiscountId) || null,
    [activeDiscounts, selectedDiscountId]
  )

  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0

    const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscountAmount)

    if (selectedDiscount.discount_type === 'percentage') {
      return subtotalAfterLoyalty * (selectedDiscount.discount_value / 100)
    } else {
      return Math.min(selectedDiscount.discount_value, subtotalAfterLoyalty)
    }
  }, [selectedDiscount, subtotal, loyaltyDiscountAmount])

  const subtotalAfterLoyalty = Math.max(0, subtotal - loyaltyDiscountAmount)
  const subtotalAfterDiscount = Math.max(0, subtotalAfterLoyalty - discountAmount)

  // Tax calculation from tax.store (ANTI-LOOP: uses locationId from sessionInfo)
  const { taxAmount, taxRate } = useMemo(() => {
    if (!sessionInfo?.locationId) {
      return { taxAmount: 0, taxRate: 0.08 }
    }
    return taxActions.calculateTax(subtotalAfterDiscount, sessionInfo.locationId)
  }, [subtotalAfterDiscount, sessionInfo?.locationId])

  const total = subtotalAfterDiscount + taxAmount

  // Max redeemable points calculation
  const maxRedeemablePoints = useMemo(() => {
    if (!selectedCustomer) return 0
    const maxFromSubtotal = loyaltyActions.getMaxRedeemablePoints(subtotal)
    return Math.min(selectedCustomer.loyalty_points, maxFromSubtotal)
  }, [selectedCustomer, subtotal])

  // Find the product for the tier selector
  const tierSelectorProduct = tierSelectorProductId
    ? products.find(p => p.id === tierSelectorProductId)
    : null

  // ========================================
  // HANDLERS (MEMOIZED to prevent re-render loops)
  // ========================================
  const handleClearCart = useCallback(() => {
    cartActions.clearCart()
    cartActions.setDiscountingItemId(null)
    checkoutUIActions.setSelectedDiscountId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Store actions are stable from zustand, safe to omit from deps
  }, [])

  return (
    <View style={styles.cartCard}>
      {/* iOS 26 Perfectly Simple Cart Header */}
      <View style={styles.cartHeader}>
        {/* Customer Section - iOS 26 Rounded Container or Pill Button */}
        {!selectedCustomer ? (
          <LiquidGlassView
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                checkoutUIActions.openModal('customerSelector')
              }}
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
            effect="regular"
            colorScheme="dark"
            interactive
            style={[
              styles.customerPill,
              !isLiquidGlassSupported && styles.customerPillFallback
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                checkoutUIActions.openModal('customerSelector')
              }}
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  customerActions.clearCustomer()
                  loyaltyActions.resetLoyalty()
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

        {/* Discount Selector */}
        {cart.length > 0 && activeDiscounts.length > 0 && (
          <>
            {!selectedDiscount ? (
              <LiquidGlassView
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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    checkoutUIActions.setShowDiscountSelector(!showDiscountSelector)
                  }}
                  style={styles.customerPillButtonPressable}
                  activeOpacity={0.7}
                >
                  <Text style={styles.customerPillText}>
                    {showDiscountSelector ? 'Hide Discounts' : 'Apply Discount'}
                  </Text>
                </TouchableOpacity>
              </LiquidGlassView>
            ) : (
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                interactive
                style={[
                  styles.customerPill,
                  !isLiquidGlassSupported && styles.customerPillFallback
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    checkoutUIActions.setShowDiscountSelector(!showDiscountSelector)
                  }}
                  style={styles.customerPillPressable}
                  activeOpacity={0.8}
                >
                  <View style={styles.customerPillContent}>
                    <View style={styles.customerPillTextContainer}>
                      <Text style={styles.customerPillName} numberOfLines={1}>
                        {selectedDiscount.name}
                      </Text>
                      <Text style={styles.customerPillPoints}>
                        {selectedDiscount.badge_text}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation()
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        checkoutUIActions.setSelectedDiscountId(null)
                        checkoutUIActions.setShowDiscountSelector(false)
                      }}
                      style={styles.customerPillClearButton}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.customerPillClearText}>×</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </LiquidGlassView>
            )}

            {/* Discount List */}
            {showDiscountSelector && (
              <View style={styles.discountList}>
                {activeDiscounts.map(discount => (
                  <LiquidGlassView
                    key={discount.id}
                    effect="regular"
                    colorScheme="dark"
                    interactive
                    style={[
                      styles.discountItem,
                      !isLiquidGlassSupported && styles.discountItemFallback
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        checkoutUIActions.setSelectedDiscountId(discount.id)
                        checkoutUIActions.setShowDiscountSelector(false)
                      }}
                      style={styles.discountItemPressable}
                      activeOpacity={0.8}
                    >
                      <View style={styles.discountItemContent}>
                        <Text style={styles.discountItemName}>{discount.name}</Text>
                        <Text style={styles.discountItemBadge}>{discount.badge_text}</Text>
                      </View>
                    </TouchableOpacity>
                  </LiquidGlassView>
                ))}
              </View>
            )}
          </>
        )}

        {/* Clear Cart Button */}
        {cart.length > 0 && (
          <View style={styles.headerActions}>
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              tintColor="rgba(255,255,255,0.05)"
              interactive
              style={[
                styles.actionButton,
                !isLiquidGlassSupported && styles.actionButtonFallback
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  handleClearCart()
                }}
                style={styles.actionButtonPressable}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Clear cart"
                accessibilityHint="Removes all items from cart"
              >
                <Text style={styles.actionButtonText}>Clear Cart</Text>
              </TouchableOpacity>
            </LiquidGlassView>
          </View>
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
          cart.map((item) => {
            // Find the product for this cart item
            const product = products.find(p => p.id === item.productId)
            const hasTiers = product && ((product.meta_data?.pricing_tiers?.length ?? 0) > 0 || (product.pricing_tiers?.length ?? 0) > 0)

            return (
              <POSCartItem
                key={item.id}
                item={item}
                onAdd={() => cartActions.updateQuantity(item.id, 1)}
                onRemove={() => cartActions.updateQuantity(item.id, -1)}
                onOpenTierSelector={
                  hasTiers && product
                    ? () => {
                        checkoutUIActions.setTierSelectorProductId(product.id)
                        // Trigger the product card modal to open
                        setTimeout(() => {
                          if (productCardRef.current?.openPricingModal) {
                            productCardRef.current.openPricingModal()
                          }
                        }, 100)
                      }
                    : undefined
                }
                onApplyDiscount={(type, value) => cartActions.applyManualDiscount(item.id, type, value)}
                onRemoveDiscount={() => cartActions.removeManualDiscount(item.id)}
                isDiscounting={discountingItemId === item.id}
                onStartDiscounting={() => cartActions.setDiscountingItemId(item.id)}
                onCancelDiscounting={() => cartActions.setDiscountingItemId(null)}
              />
            )
          })
        )}
      </ScrollView>

      {cart.length > 0 && (
        <>
          <View style={styles.cartDivider} />

          {/* JOBS PRINCIPLE: Loyalty Points - Minimal, Elegant */}
          {loyaltyProgram && selectedCustomer && selectedCustomer.loyalty_points > 0 && (
            <View style={styles.loyaltySection}>
              <View style={styles.loyaltySectionHeader}>
                <Text style={styles.loyaltySectionTitle}>Loyalty Points</Text>
                <Text style={styles.loyaltySectionAvailable}>
                  {selectedCustomer.loyalty_points} pts ($
                  {(selectedCustomer.loyalty_points * (loyaltyProgram.point_value || 0.01)).toFixed(
                    2
                  )}{' '}
                  value)
                </Text>
              </View>

              {pointsToRedeem > 0 && (
                <View style={styles.loyaltyValueDisplay}>
                  <Text style={styles.loyaltyPointsText}>
                    {pointsToRedeem} {pointsToRedeem === 1 ? 'point' : 'points'}
                  </Text>
                  <Text style={styles.loyaltyDiscountValue}>
                    -${loyaltyDiscountAmount.toFixed(2)}
                  </Text>
                </View>
              )}

              <Slider
                style={styles.loyaltySlider}
                minimumValue={0}
                maximumValue={maxRedeemablePoints}
                step={1}
                value={pointsToRedeem}
                onValueChange={loyaltyActions.setPointsToRedeem}
                minimumTrackTintColor="rgba(255,255,255,0.3)"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#fff"
                accessibilityLabel="Loyalty points to redeem"
                accessibilityValue={{
                  min: 0,
                  max: maxRedeemablePoints,
                  now: pointsToRedeem,
                  text: `${pointsToRedeem} points, ${loyaltyDiscountAmount.toFixed(2)} dollars off`
                }}
                accessibilityHint={`Slide to redeem loyalty points. Maximum ${maxRedeemablePoints} points available`}
              />

              <View style={styles.loyaltyButtons}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    loyaltyActions.setPointsToRedeem(0)
                  }}
                  style={styles.loyaltyButtonClear}
                  accessibilityRole="button"
                  accessibilityLabel="Clear loyalty points"
                  accessibilityHint="Sets redeemed points to zero"
                >
                  <Text style={styles.loyaltyButtonClearText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    loyaltyActions.setPointsToRedeem(maxRedeemablePoints)
                  }}
                  style={styles.loyaltyButtonMax}
                  accessibilityRole="button"
                  accessibilityLabel="Redeem maximum loyalty points"
                  accessibilityHint={`Redeems all ${maxRedeemablePoints} available points for ${(maxRedeemablePoints * (loyaltyProgram?.point_value || 0.01)).toFixed(2)} dollars off`}
                >
                  <Text style={styles.loyaltyButtonMaxText}>Max</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loyaltyProgram && selectedCustomer && selectedCustomer.loyalty_points > 0 && (
            <View style={styles.cartDivider} />
          )}

          {/* Totals and Checkout */}
          <POSTotalsSection
            subtotal={subtotal}
            loyaltyDiscountAmount={loyaltyDiscountAmount}
            discountAmount={discountAmount}
            selectedDiscount={selectedDiscount}
            taxAmount={taxAmount}
            taxRate={taxRate}
            total={total}
            selectedCustomer={selectedCustomer}
            loyaltyProgram={loyaltyProgram}
            loyaltyPointsToRedeem={pointsToRedeem}
            maxRedeemablePoints={maxRedeemablePoints}
            onSetLoyaltyPoints={loyaltyActions.setPointsToRedeem}
            onCheckout={() => {
              if (cart.length === 0) return
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              checkoutUIActions.openModal('payment')
            }}
            disabled={cart.length === 0}
          />
        </>
      )}

      {/* Jobs Principle: End Session - Bottom of cart, subtle, out of the way */}
      <TouchableOpacity
        onPress={() => posSessionActions.prepareEndSession()}
        style={styles.endSessionFooter}
        accessibilityRole="button"
        accessibilityLabel="End session"
        accessibilityHint="Closes the current POS session and returns to session setup"
      >
        <Text style={styles.endSessionFooterText}>End Session</Text>
      </TouchableOpacity>

      {/* Hidden product card for tier selection - reuses existing modal */}
      {tierSelectorProduct && (
        <View style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
          <POSProductCard
            ref={productCardRef}
            product={{
              ...tierSelectorProduct,
              // Force inventory to show as in stock
              inventory_quantity: 999
            }}
            onAddToCart={(product, tier) => {
              if (tier && tierSelectorProductId) {
                // Find the cart item with this product ID
                const cartItem = cart.find(item => item.productId === tierSelectorProductId)
                if (cartItem) {
                  cartActions.changeTier(cartItem.id, product, tier)
                }
              }
              checkoutUIActions.setTierSelectorProductId(null)
            }}
          />
        </View>
      )}
    </View>
  )
}

// ✅ ZERO PROP DRILLING: Simple memo, no prop comparison needed
// Component re-renders only when store values it subscribes to change
const POSCartMemo = memo(POSCart)

export { POSCartMemo as POSCart }

const styles = StyleSheet.create({
  cartCard: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    overflow: 'hidden',
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
  discountList: {
    gap: 6,
    marginTop: 4,
  },
  discountItem: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 40,
  },
  discountItemFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  discountItemPressable: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  discountItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  discountItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
  },
  discountItemBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 40,
  },
  actionButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionButtonPressable: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
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
  loyaltySection: {
    padding: 16,
    gap: 12,
  },
  loyaltySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltySectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  loyaltySectionAvailable: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  loyaltyValueDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  loyaltyPointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  loyaltyDiscountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4ade80',
  },
  loyaltySlider: {
    width: '100%',
    height: 40,
  },
  loyaltyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  loyaltyButtonClear: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  loyaltyButtonClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  loyaltyButtonMax: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
  },
  loyaltyButtonMaxText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ade80',
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
