import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import type { CartItem, Customer, LoyaltyProgram } from '@/types/pos'
import { POSCartItem } from './POSCartItem'
import { POSTotalsSection } from './POSTotalsSection'

const { width } = Dimensions.get('window')
const isTablet = width > 600

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
  onApplyDiscount: (productId: string, type: 'percentage' | 'amount', value: number) => void
  onRemoveDiscount: (productId: string) => void
  onSelectCustomer: () => void
  onClearCustomer: () => void
  onSetLoyaltyPoints: (points: number) => void
  onCheckout: () => void
  onClearCart: () => void
  onOpenIDScanner: () => void
  onStartDiscounting: (productId: string) => void
  onCancelDiscounting: () => void
  onEndSession: () => void
  maxRedeemablePoints: number
}

export function POSCart({
  cart,
  subtotal,
  taxAmount,
  total,
  itemCount,
  taxRate,
  selectedCustomer,
  loyaltyPointsToRedeem,
  loyaltyProgram,
  loyaltyDiscountAmount,
  discountingItemId,
  onAddItem,
  onRemoveItem,
  onApplyDiscount,
  onRemoveDiscount,
  onSelectCustomer,
  onClearCustomer,
  onSetLoyaltyPoints,
  onCheckout,
  onClearCart,
  onOpenIDScanner,
  onStartDiscounting,
  onCancelDiscounting,
  onEndSession,
  maxRedeemablePoints,
}: POSCartProps) {
  return (
    <View style={styles.cartCard}>
      <View style={styles.cartBg}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      </View>

      {/* Cart Header */}
      <View style={styles.cartHeader}>
        <View>
          <Text style={styles.cartTitle}>CART</Text>
          <Text style={styles.cartSubtitle}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
        {cart.length > 0 && (
          <TouchableOpacity onPress={onClearCart} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>CLEAR</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cartDivider} />

      {/* Customer Selector - Jobs Principle: Integrated SCAN ID or Clear button */}
      <View style={styles.customerSection}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onSelectCustomer()
          }}
          style={styles.customerBar}
          activeOpacity={0.8}
        >
          <View style={styles.customerBarBg}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.customerBarContent}>
            <View style={styles.customerBarInfo}>
              <Text style={styles.customerBarLabel}>CUSTOMER</Text>
              <Text style={styles.customerBarValue} numberOfLines={1}>
                {selectedCustomer
                  ? selectedCustomer.display_name ||
                    `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim() ||
                    selectedCustomer.email
                  : 'Select Customer'}
              </Text>
              {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
                <Text style={styles.customerBarPoints}>
                  {selectedCustomer.loyalty_points} points
                </Text>
              )}
            </View>

            {/* Jobs Principle: Show SCAN ID when no customer, Clear button when customer selected */}
            {!selectedCustomer ? (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  onOpenIDScanner()
                }}
                style={styles.scanIDIntegrated}
                activeOpacity={0.7}
              >
                <Text style={styles.scanIDIntegratedText}>SCAN ID</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  onClearCustomer()
                }}
                style={styles.clearCustomerButton}
                activeOpacity={0.7}
              >
                <Text style={styles.clearCustomerButtonText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.cartDivider} />

      {/* Cart Items */}
      <ScrollView style={styles.cartItems} showsVerticalScrollIndicator={false}>
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
              onAdd={() => onAddItem(item.id)}
              onRemove={() => onRemoveItem(item.id)}
              onApplyDiscount={(type, value) => onApplyDiscount(item.id, type, value)}
              onRemoveDiscount={() => onRemoveDiscount(item.id)}
              isDiscounting={discountingItemId === item.id}
              onStartDiscounting={() => onStartDiscounting(item.id)}
              onCancelDiscounting={onCancelDiscounting}
            />
          ))
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
              />

              <View style={styles.loyaltyButtons}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onSetLoyaltyPoints(0)
                  }}
                  style={styles.loyaltyButtonClear}
                >
                  <Text style={styles.loyaltyButtonClearText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    onSetLoyaltyPoints(maxRedeemablePoints)
                  }}
                  style={styles.loyaltyButtonMax}
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
            onCheckout={onCheckout}
            disabled={false}
          />
        </>
      )}

      {/* Jobs Principle: End Session - Bottom of cart, subtle, out of the way */}
      <TouchableOpacity onPress={onEndSession} style={styles.endSessionFooter}>
        <Text style={styles.endSessionFooterText}>End Session</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  cartCard: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cartBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 4,
  },
  cartSubtitle: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  clearButtonText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  cartDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  customerSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  customerBar: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  customerBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  customerBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  customerBarInfo: {
    flex: 1,
    gap: 4,
  },
  customerBarLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  customerBarValue: {
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.2,
  },
  customerBarPoints: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(100,200,255,0.9)',
    letterSpacing: 0.3,
  },
  scanIDIntegrated: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  scanIDIntegratedText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(96,165,250,0.95)',
    letterSpacing: 1.5,
  },
  clearCustomerButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,0,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCustomerButtonText: {
    fontSize: 20,
    fontWeight: '200',
    color: 'rgba(255,80,80,0.95)',
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
    marginHorizontal: 24,
    marginBottom: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0,
  },
  endSessionFooterText: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },
})
