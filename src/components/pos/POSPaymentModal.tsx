/**
 * POS Payment Modal
 * Single Responsibility: Payment orchestration and modal presentation
 * Apple Standard: Component < 300 lines
 */

import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, useWindowDimensions, ScrollView } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { useState, useRef, useEffect, memo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { CashPaymentView } from './payment/CashPaymentView'
import { CardPaymentView } from './payment/CardPaymentView'
import { SplitPaymentView } from './payment/SplitPaymentView'
import type { PaymentModalProps, PaymentData } from './payment/PaymentTypes'

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
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height

  // Use current height for animations
  const slideAnim = useRef(new Animated.Value(height)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const processorStatus = usePaymentProcessor((state) => state.status)

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
    return await onPaymentComplete(paymentData)
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
          {/* Handle - only show in portrait */}
          {!isLandscape && (
            <View style={styles.handle} accessibilityElementsHidden={true} importantForAccessibility="no" />
          )}

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
          </View>

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

          <ScrollView
            style={[styles.content, { maxHeight: height * (isLandscape ? 0.5 : 0.75) }]}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            scrollIndicatorInsets={{ right: 2 }}
            bounces={false}
          >
            {/* Payment Views */}
            {paymentMethod === 'cash' && (
              <CashPaymentView
                total={total}
                subtotal={subtotal}
                taxAmount={taxAmount}
                taxRate={taxRate}
                taxName={taxName}
                itemCount={itemCount}
                onComplete={handlePaymentComplete}
              />
            )}

            {paymentMethod === 'card' && (
              <CardPaymentView
                total={total}
                subtotal={subtotal}
                taxAmount={taxAmount}
                taxRate={taxRate}
                taxName={taxName}
                itemCount={itemCount}
                currentProcessor={currentProcessor}
                processorStatus={processorStatus}
                locationId={locationId}
                registerId={registerId}
                onComplete={handlePaymentComplete}
              />
            )}

            {paymentMethod === 'split' && (
              <SplitPaymentView
                total={total}
                subtotal={subtotal}
                taxAmount={taxAmount}
                taxRate={taxRate}
                taxName={taxName}
                itemCount={itemCount}
                currentProcessor={currentProcessor}
                locationId={locationId}
                registerId={registerId}
                onComplete={handlePaymentComplete}
              />
            )}

            {/* Summary */}
            <View
              style={styles.summary}
              accessible={true}
              accessibilityRole="summary"
              accessibilityLabel={`Order summary. ${itemCount} items. Subtotal: ${subtotal.toFixed(2)} dollars. ${taxName || 'Tax'} at ${(taxRate * 100).toFixed(2)} percent: ${taxAmount.toFixed(2)} dollars.`}
            >
              <View style={styles.summaryRow} accessible={false}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>{itemCount}</Text>
              </View>
              <View style={styles.summaryRow} accessible={false}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow} accessible={false}>
                <Text style={styles.summaryLabel}>
                  {taxName || 'Tax'} ({(taxRate * 100).toFixed(2)}%)
                </Text>
                <Text style={styles.summaryValue}>${taxAmount.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.7}
              style={styles.actionButtonWrapper}
              accessibilityRole="button"
              accessibilityLabel="Cancel payment"
              accessibilityHint="Close checkout and return to cart"
            >
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </LiquidGlassView>
            </TouchableOpacity>
          </View>
        </LiquidGlassView>
      </Animated.View>
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
    bottom: 0,
    left: 0,
    right: 0,
    top: '15%',
  },
  containerLandscape: {
    // FIXED: Responsive modal for iPad Pro 11" and all landscape sizes
    // Uses smaller percentages to ensure it fits on smaller iPads
    top: '5%',
    bottom: '5%',
    left: '10%',
    right: '10%',
    maxHeight: '90%', // Prevent overflow on smaller screens
  },
  modalCard: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalCardPortrait: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  modalCardLandscape: {
    borderRadius: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
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
  summary: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButtonWrapper: {
    flex: 1,
  },
  cancelButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.4,
  },
})

export default memo(POSPaymentModal)
