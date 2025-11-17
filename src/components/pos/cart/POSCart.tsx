import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native'
import { memo, useState, useRef } from 'react'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import type { CartItem, Customer, LoyaltyProgram, Product, PricingTier } from '@/types/pos'
import { POSCartItem } from './POSCartItem'
import { POSTotalsSection } from './POSTotalsSection'
import { POSProductCard } from '../POSProductCard'
import { layout } from '@/theme/layout'

const { width: _width } = Dimensions.get('window')

interface POSCartProps {
  cart: CartItem[]
  subtotal: number
  taxAmount: number
  total: number
  itemCount: number
  taxRate: number
  selectedCustomer: Customer | null
  loyaltyPointsToRedeem: number
  loyaltyProgram: LoyaltyProgram | null
  loyaltyDiscountAmount: number
  discountingItemId: string | null
  onAddItem: (productId: string) => void
  onRemoveItem: (productId: string) => void
  onChangeTier: (oldItemId: string, product: Product, newTier: PricingTier) => void
  onApplyDiscount: (productId: string, type: 'percentage' | 'amount', value: number) => void
  onRemoveDiscount: (productId: string) => void
  onSelectCustomer: () => void
  onClearCustomer: () => void
  onSetLoyaltyPoints: (points: number) => void
  onCheckout: () => void
  onClearCart: () => void
  onStartDiscounting: (productId: string) => void
  onCancelDiscounting: () => void
  onEndSession: () => void
  maxRedeemablePoints: number
  products: Product[]
}

function POSCart({
  cart,
  subtotal,
  taxAmount,
  total,
  taxRate,
  selectedCustomer,
  loyaltyPointsToRedeem,
  loyaltyProgram,
  loyaltyDiscountAmount,
  discountingItemId,
  onAddItem,
  onRemoveItem,
  onChangeTier,
  onApplyDiscount,
  onRemoveDiscount,
  onSelectCustomer,
  onClearCustomer,
  onSetLoyaltyPoints,
  onCheckout,
  onClearCart,
  onStartDiscounting,
  onCancelDiscounting,
  onEndSession,
  maxRedeemablePoints,
  products,
}: POSCartProps) {
  const [tierSelectorProductId, setTierSelectorProductId] = useState<string | null>(null)
  const productCardRef = useRef<any>(null)

  // Find the product for the tier selector
  const tierSelectorProduct = tierSelectorProductId
    ? products.find(p => p.id === tierSelectorProductId)
    : null

  return (
    <LiquidGlassView
      effect="clear"
      colorScheme="dark"
      tintColor="rgba(0,0,0,0.05)"
      style={[
        styles.cartCard,
        !isLiquidGlassSupported && styles.cartCardFallback
      ]}
    >
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
                onSelectCustomer()
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
                onSelectCustomer()
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
                  onClearCustomer()
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

        {/* Action Buttons Row */}
        {cart.length > 0 && (
          <View style={styles.actionRow}>
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              interactive
              style={[
                styles.actionButton,
                !isLiquidGlassSupported && styles.actionButtonFallback
              ]}
            >
              <TouchableOpacity
                onPress={onClearCart}
                style={styles.actionButtonPressable}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Clear cart"
                accessibilityHint={`Removes all ${cart.length} ${cart.length === 1 ? 'item' : 'items'} from cart`}
              >
                <Text style={styles.actionButtonText}>Clear Cart</Text>
              </TouchableOpacity>
            </LiquidGlassView>
          </View>
        )}
      </View>

      {/* Cart Items */}
      <ScrollView style={styles.cartItems} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: layout.dockHeight }}>
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
                onAdd={() => onAddItem(item.id)}
                onRemove={() => onRemoveItem(item.id)}
                onOpenTierSelector={
                  hasTiers && product
                    ? () => {
                        setTierSelectorProductId(product.id)
                        // Trigger the product card modal to open
                        setTimeout(() => {
                          if (productCardRef.current?.openPricingModal) {
                            productCardRef.current.openPricingModal()
                          }
                        }, 100)
                      }
                    : undefined
                }
                onApplyDiscount={(type, value) => onApplyDiscount(item.id, type, value)}
                onRemoveDiscount={() => onRemoveDiscount(item.id)}
                isDiscounting={discountingItemId === item.id}
                onStartDiscounting={() => onStartDiscounting(item.id)}
                onCancelDiscounting={onCancelDiscounting}
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

              {loyaltyPointsToRedeem > 0 && (
                <View style={styles.loyaltyValueDisplay}>
                  <Text style={styles.loyaltyPointsText}>
                    {loyaltyPointsToRedeem} {loyaltyPointsToRedeem === 1 ? 'point' : 'points'}
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
                value={loyaltyPointsToRedeem}
                onValueChange={onSetLoyaltyPoints}
                minimumTrackTintColor="rgba(255,255,255,0.3)"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#fff"
                accessibilityLabel="Loyalty points to redeem"
                accessibilityValue={{
                  min: 0,
                  max: maxRedeemablePoints,
                  now: loyaltyPointsToRedeem,
                  text: `${loyaltyPointsToRedeem} points, ${loyaltyDiscountAmount.toFixed(2)} dollars off`
                }}
                accessibilityHint={`Slide to redeem loyalty points. Maximum ${maxRedeemablePoints} points available`}
              />

              <View style={styles.loyaltyButtons}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onSetLoyaltyPoints(0)
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
                    onSetLoyaltyPoints(maxRedeemablePoints)
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
            taxAmount={taxAmount}
            taxRate={taxRate}
            total={total}
            selectedCustomer={selectedCustomer}
            loyaltyProgram={loyaltyProgram}
            loyaltyPointsToRedeem={loyaltyPointsToRedeem}
            maxRedeemablePoints={maxRedeemablePoints}
            onSetLoyaltyPoints={onSetLoyaltyPoints}
            onCheckout={onCheckout}
            disabled={false}
          />
        </>
      )}

      {/* Jobs Principle: End Session - Bottom of cart, subtle, out of the way */}
      <TouchableOpacity
        onPress={onEndSession}
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
                  onChangeTier(cartItem.id, product, tier)
                }
              }
              setTierSelectorProductId(null)
            }}
          />
        </View>
      )}
    </LiquidGlassView>
  )
}

const POSCartMemo = memo(POSCart)
export { POSCartMemo as POSCart }

const styles = StyleSheet.create({
  // Liquid Glass Cart Container - iOS 26 Best Practice
  cartCard: {
    flex: 1,
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cartCardFallback: {
    backgroundColor: 'rgba(20,20,20,0.85)',
  },

  // Perfectly Simple Cart Header
  cartHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },

  // Customer Pill Button (when no customer selected) - Liquid Glass
  customerPillButton: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  customerPillButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  customerPillButtonPressable: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerPillText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.3,
  },

  // Customer Pill (when customer selected) - Liquid Glass with regular effect
  customerPill: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 0,
  },
  customerPillFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  customerPillPressable: {
    height: 48,
  },
  customerPillContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 6,
    gap: 12,
  },
  customerPillTextContainer: {
    flex: 1,
    gap: 2,
  },
  customerPillName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.4,
  },
  customerPillPoints: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.95)',
    letterSpacing: -0.2,
  },
  customerPillClearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  customerPillClearText: {
    fontSize: 22,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0,
  },

  // Action Row - Pills Layout
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },

  // Action Button - Liquid Glass Pill
  actionButton: {
    flex: 1,
    borderRadius: 100,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionButtonFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionButtonPressable: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.2,
  },

  cartItems: {
    flex: 1,
  },
  emptyCart: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyCartText: {
    fontSize: 13,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
  },
  emptyCartSubtext: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.25)',
  },
  loyaltySection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  loyaltySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltySectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  loyaltySectionAvailable: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(100,200,255,0.9)',
    letterSpacing: 0.3,
  },
  loyaltyValueDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  loyaltyPointsText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.7)',
  },
  loyaltyDiscountValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10b981',
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
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  loyaltyButtonClearText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  loyaltyButtonMax: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(100,200,255,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(100,200,255,0.3)',
    alignItems: 'center',
  },
  loyaltyButtonMaxText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(100,200,255,0.95)',
    letterSpacing: 1,
  },
  endSessionFooter: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0,
  },
  endSessionFooterText: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },
  // iOS 26 Divider - Hairline
  cartDivider: {
    height: 0.33,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
  },
})
