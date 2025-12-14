/**
 * POS Payment Modal
 * Single Responsibility: Payment orchestration and modal presentation
 * Apple Standard: Component < 300 lines
 */

import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, useWindowDimensions, ScrollView, LayoutAnimation, Platform, UIManager, KeyboardAvoidingView } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import * as Haptics from 'expo-haptics'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { useSelectedCustomer } from '@/stores/customer.store'
import { useCartTotals } from '@/stores/cart.store'
import { useLoyaltyProgram, usePointsToRedeem, loyaltyActions, useCampaigns } from '@/stores/loyalty-campaigns.store'
import { useSelectedDiscountId, checkoutUIActions } from '@/stores/checkout-ui.store'
import { CashPaymentView } from './payment/CashPaymentView'
import { CardPaymentView } from './payment/CardPaymentView'
import { SplitPaymentView } from './payment/SplitPaymentView'
import { SaleSuccessModal } from './SaleSuccessModal'
import type { PaymentModalProps, PaymentData, SaleCompletionData } from './payment/PaymentTypes'

function POSPaymentModal({
  visible,
  total,
  subtotal,
  taxAmount,
  taxRate,
  taxName,
  itemCount,
  onPaymentComplete,
  onCancel,
  locationId,
  registerId,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split'>('cash')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [completionData, setCompletionData] = useState<SaleCompletionData | null>(null)
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  // Use current height for animations
  const slideAnim = useRef(new Animated.Value(height)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const processorStatus = usePaymentProcessor((state) => state.status)

  // Loyalty state from stores (ZERO PROP DRILLING)
  const selectedCustomer = useSelectedCustomer()
  const loyaltyProgram = useLoyaltyProgram()
  const pointsToRedeem = usePointsToRedeem()
  const { subtotal: cartSubtotal } = useCartTotals()

  // Calculate loyalty discount for display (total prop already has it applied)
  const pointValue = loyaltyProgram?.point_value || 0.05
  const loyaltyDiscount = pointsToRedeem * pointValue

  // Calculate max redeemable points
  const maxRedeemablePoints = useMemo(() => {
    if (!selectedCustomer || !loyaltyProgram?.is_active) return 0
    const customerPoints = selectedCustomer.loyalty_points || 0
    const maxFromSubtotal = Math.floor(cartSubtotal / pointValue)
    return Math.min(customerPoints, maxFromSubtotal)
  }, [selectedCustomer, loyaltyProgram, cartSubtotal, pointValue])

  // NOTE: `total` prop already includes loyalty discount from useCheckoutTotals
  // No need to calculate adjustedTotal - use total directly

  // Show loyalty section if customer has points
  const showLoyaltySection = selectedCustomer &&
    (selectedCustomer.loyalty_points || 0) > 0 &&
    maxRedeemablePoints > 0

  // Discount state from stores
  const campaigns = useCampaigns()
  const selectedDiscountId = useSelectedDiscountId()
  const [showDiscountPicker, setShowDiscountPicker] = useState(false)

  // Get active POS discounts (in_store or both)
  const activeDiscounts = useMemo(() => {
    return campaigns.filter(d => {
      if (!d.is_active) return false
      const salesChannel = (d as any).sales_channel || 'both'
      return salesChannel === 'in_store' || salesChannel === 'both'
    })
  }, [campaigns])

  // Get selected discount
  const selectedDiscount = useMemo(() =>
    activeDiscounts.find(d => d.id === selectedDiscountId) || null,
    [activeDiscounts, selectedDiscountId]
  )

  // Calculate discount amount for display
  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0
    const subtotalAfterLoyalty = Math.max(0, cartSubtotal - loyaltyDiscount)
    if (selectedDiscount.discount_type === 'percentage') {
      return subtotalAfterLoyalty * (selectedDiscount.discount_value / 100)
    }
    return Math.min(selectedDiscount.discount_value, subtotalAfterLoyalty)
  }, [selectedDiscount, cartSubtotal, loyaltyDiscount])

  // Discount handlers
  const handleSelectDiscount = useCallback((discountId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    LayoutAnimation.configureNext(LayoutAnimation.create(
      200,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    ))
    checkoutUIActions.setSelectedDiscountId(discountId)
    setShowDiscountPicker(false)
  }, [])

  const handleClearDiscount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    checkoutUIActions.setSelectedDiscountId(null)
  }, [])

  const handleToggleDiscountPicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.create(
      200,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    ))
    setShowDiscountPicker(prev => !prev)
  }, [])

  // Loyalty slider handlers
  const handleSliderChange = useCallback((value: number) => {
    const roundedValue = Math.round(value)
    loyaltyActions.setPointsToRedeem(roundedValue)
  }, [])

  const handleSliderComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const handleUseAllPoints = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    loyaltyActions.setPointsToRedeem(pointsToRedeem === maxRedeemablePoints ? 0 : maxRedeemablePoints)
  }, [pointsToRedeem, maxRedeemablePoints])

  const hasActiveProcessor = !!currentProcessor
  const canCompleteCard = hasActiveProcessor

  // Animation - update when visibility or dimensions change
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 10,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      slideAnim.setValue(height)
      fadeAnim.setValue(0)
      setPaymentMethod('cash')
      // Reset success modal state when payment modal closes
      setShowSuccessModal(false)
      setCompletionData(null)
    }
  }, [visible, height])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCancel()
  }

  const handleTabChange = (method: 'cash' | 'card' | 'split') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPaymentMethod(method)
  }

  const handlePaymentComplete = async (paymentData: PaymentData) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const saleData = await onPaymentComplete(paymentData)

    // Show Apple-style success modal
    setCompletionData(saleData)
    setShowSuccessModal(true)

    return saleData
  }

  const handleSuccessModalDismiss = () => {
    // Hide success modal first
    setShowSuccessModal(false)

    // Wait a moment for the success modal's fade out animation
    // Then close the payment modal smoothly
    setTimeout(() => {
      setCompletionData(null)
      onCancel()
    }, 300) // Give 300ms for any exit animations
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape']}
      accessibilityViewIsModal={true}
    >
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: fadeAnim }]}
        accessible={true}
        accessibilityRole="none"
        accessibilityLabel={`Checkout. Total: ${total.toFixed(2)} dollars`}
        onAccessibilityEscape={handleClose}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          activeOpacity={1}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close checkout"
          accessibilityHint="Double tap to cancel and return to cart"
        />
      </Animated.View>

      {/* Modal Container */}
      <Animated.View
        style={[
          styles.container,
          isLandscape ? styles.containerLandscape : styles.containerPortrait,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
        accessible={false}
      >
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={[
            styles.modalCard,
            isLandscape ? styles.modalCardLandscape : styles.modalCardPortrait
          ]}
          accessible={false}
        >
          {/* Handle removed - full screen modal */}

          {/* Header */}
          <View style={styles.header} accessible={false}>
            <Text style={styles.title} accessibilityRole="header">CHECKOUT</Text>
            <Text style={styles.totalLabel} accessible={false}>TOTAL</Text>
            <Text
              style={styles.totalAmount}
              accessibilityLabel={`Total amount: ${total.toFixed(2)} dollars`}
              accessibilityRole="text"
            >
              ${total.toFixed(2)}
            </Text>
            {loyaltyDiscount > 0 && (
              <Text style={styles.loyaltySavings}>
                Saving ${loyaltyDiscount.toFixed(2)} with {pointsToRedeem} points
              </Text>
            )}
          </View>

          {/* Loyalty Points Redemption */}
          {showLoyaltySection && (
            <View style={styles.loyaltySection}>
              <View style={styles.loyaltyHeader}>
                <Text style={styles.loyaltyTitle}>Redeem Points</Text>
                <Text style={styles.loyaltyAvailable}>
                  {(selectedCustomer?.loyalty_points || 0).toLocaleString()} available
                </Text>
              </View>
              <View style={styles.loyaltySliderRow}>
                <Text style={styles.loyaltyPointsText}>
                  {pointsToRedeem} pts
                </Text>
                <Slider
                  style={styles.loyaltySlider}
                  minimumValue={0}
                  maximumValue={maxRedeemablePoints}
                  step={1}
                  value={pointsToRedeem}
                  onValueChange={handleSliderChange}
                  onSlidingComplete={handleSliderComplete}
                  minimumTrackTintColor="#10b981"
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor="#10b981"
                />
                <TouchableOpacity onPress={handleUseAllPoints} style={styles.useAllButton}>
                  <Text style={styles.useAllText}>
                    {pointsToRedeem === maxRedeemablePoints ? 'Clear' : 'Max'}
                  </Text>
                </TouchableOpacity>
              </View>
              {pointsToRedeem > 0 && (
                <Text style={styles.loyaltyDiscountText}>
                  -${loyaltyDiscount.toFixed(2)} discount
                </Text>
              )}
            </View>
          )}

          {/* Discount Section */}
          {activeDiscounts.length > 0 && (
            <TouchableOpacity
              style={styles.discountSection}
              onPress={selectedDiscount ? undefined : handleToggleDiscountPicker}
              activeOpacity={selectedDiscount ? 1 : 0.7}
              disabled={!!selectedDiscount}
            >
              <View style={styles.discountHeader}>
                <View style={styles.discountTitleRow}>
                  <Ionicons
                    name="pricetag-outline"
                    size={16}
                    color={selectedDiscount ? '#10b981' : 'rgba(255,255,255,0.6)'}
                    style={styles.discountIcon}
                  />
                  <Text style={[styles.discountTitle, selectedDiscount && styles.discountTitleActive]}>
                    {selectedDiscount ? selectedDiscount.name : 'Apply Discount'}
                  </Text>
                </View>
                {selectedDiscount ? (
                  <TouchableOpacity onPress={handleClearDiscount} style={styles.discountClearButton}>
                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                ) : (
                  <Ionicons
                    name={showDiscountPicker ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                )}
              </View>
              {selectedDiscount && discountAmount > 0 && (
                <Text style={styles.discountAmountText}>
                  -{selectedDiscount.discount_type === 'percentage'
                    ? `${selectedDiscount.discount_value}%`
                    : `$${selectedDiscount.discount_value.toFixed(2)}`}
                  {' '}· saves ${discountAmount.toFixed(2)}
                </Text>
              )}
              {showDiscountPicker && !selectedDiscount && (
                <View style={styles.discountPickerList}>
                  {activeDiscounts.map(discount => (
                    <TouchableOpacity
                      key={discount.id}
                      onPress={() => handleSelectDiscount(discount.id)}
                      style={styles.discountPickerItem}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.discountPickerItemName}>{discount.name}</Text>
                      <Text style={styles.discountPickerItemBadge}>
                        {discount.discount_type === 'percentage'
                          ? `${discount.discount_value}% off`
                          : `$${discount.discount_value.toFixed(2)} off`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Payment Method Tabs */}
          <View style={styles.tabs} accessibilityRole="tablist" accessible={false}>
            <TouchableOpacity
              style={[styles.tab, paymentMethod === 'cash' && styles.tabActive]}
              onPress={() => handleTabChange('cash')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel="Cash payment"
              accessibilityState={{ selected: paymentMethod === 'cash' }}
              accessibilityHint="Pay with cash"
            >
              <Ionicons
                name="cash-outline"
                size={20}
                color={paymentMethod === 'cash' ? '#10b981' : 'rgba(255,255,255,0.6)'}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
              <Text style={[styles.tabText, paymentMethod === 'cash' && styles.tabTextActive]}>
                CASH
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, paymentMethod === 'card' && styles.tabActive]}
              onPress={() => handleTabChange('card')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel="Card payment"
              accessibilityState={{ selected: paymentMethod === 'card' }}
              accessibilityHint="Pay with credit or debit card"
            >
              <Ionicons
                name="card-outline"
                size={20}
                color={paymentMethod === 'card' ? '#10b981' : 'rgba(255,255,255,0.6)'}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
              <Text style={[styles.tabText, paymentMethod === 'card' && styles.tabTextActive]}>
                CARD
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, paymentMethod === 'split' && styles.tabActive]}
              onPress={() => handleTabChange('split')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel="Split payment"
              accessibilityState={{ selected: paymentMethod === 'split' }}
              accessibilityHint="Split payment between cash and card"
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={20}
                color={paymentMethod === 'split' ? '#10b981' : 'rgba(255,255,255,0.6)'}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
              <Text style={[styles.tabText, paymentMethod === 'split' && styles.tabTextActive]}>
                SPLIT
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={[styles.content, { maxHeight: height * (isLandscape ? 0.5 : 0.75) }]}
              showsVerticalScrollIndicator={true}
              indicatorStyle="white"
              scrollIndicatorInsets={{ right: 2 }}
              bounces={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="interactive"
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {/* Payment Views - total already includes loyalty discount */}
              {paymentMethod === 'cash' && (
                <CashPaymentView
                  onComplete={handlePaymentComplete}
                  onCancel={handleClose}
                />
              )}

              {paymentMethod === 'card' && (
                <CardPaymentView
                  onComplete={handlePaymentComplete}
                  onCancel={handleClose}
                />
              )}

              {paymentMethod === 'split' && (
                <SplitPaymentView
                  onComplete={handlePaymentComplete}
                  onCancel={handleClose}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </LiquidGlassView>
      </Animated.View>

      {/* Apple-style success modal */}
      <SaleSuccessModal
        visible={showSuccessModal}
        completionData={completionData}
        onDismiss={handleSuccessModalDismiss}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    position: 'absolute',
  },
  containerPortrait: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  containerLandscape: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalCard: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalCardPortrait: {
    borderRadius: 0,
  },
  modalCardLandscape: {
    borderRadius: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  loyaltySavings: {
    fontSize: 13,
    fontWeight: '500',
    color: '#10b981',
    marginTop: 4,
  },
  // Loyalty Section
  loyaltySection: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  loyaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  loyaltyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
    letterSpacing: 0.3,
  },
  loyaltyAvailable: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  loyaltySliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loyaltyPointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    width: 55,
    textAlign: 'right',
  },
  loyaltySlider: {
    flex: 1,
    height: 36,
  },
  useAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
  },
  useAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  loyaltyDiscountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    textAlign: 'center',
    marginTop: 8,
  },
  loyaltyLabel: {
    color: '#10b981',
  },
  loyaltyValue: {
    color: '#10b981',
  },
  discountLabel: {
    color: '#10b981',
  },
  discountValue: {
    color: '#10b981',
  },
  // Discount Section - matches modal theme
  discountSection: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  discountIcon: {
    marginRight: 8,
  },
  discountTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
  },
  discountTitleActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  discountClearButton: {
    padding: 4,
  },
  discountAmountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 8,
  },
  discountPickerList: {
    marginTop: 10,
    gap: 6,
  },
  discountPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  discountPickerItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
  },
  discountPickerItemBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderColor: '#10b981',
    borderWidth: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#10b981',
  },
  content: {
    // maxHeight is applied inline based on orientation
  },
})

export default memo(POSPaymentModal)
