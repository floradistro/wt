/**
 * POS Payment Modal
 * Single Responsibility: Payment orchestration and modal presentation
 * Apple Standard: Component < 300 lines
 */

import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, ScrollView } from 'react-native'
import { LiquidGlassView } from '@callstack/liquid-glass'
import { useState, useRef, useEffect, memo } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { usePaymentProcessor } from '@/stores/payment-processor.store'
import { CashPaymentView } from './payment/CashPaymentView'
import { CardPaymentView } from './payment/CardPaymentView'
import { SplitPaymentView } from './payment/SplitPaymentView'
import type { PaymentModalProps, PaymentData } from './payment/PaymentTypes'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

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
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  const currentProcessor = usePaymentProcessor((state) => state.currentProcessor)
  const processorStatus = usePaymentProcessor((state) => state.status)

  const hasActiveProcessor = !!currentProcessor
  const canCompleteCard = hasActiveProcessor

  // Animation
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
      slideAnim.setValue(SCREEN_HEIGHT)
      fadeAnim.setValue(0)
      setPaymentMethod('cash')
    }
  }, [visible])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCancel()
  }

  const handleTabChange = (method: 'cash' | 'card' | 'split') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPaymentMethod(method)
  }

  const handlePaymentComplete = (paymentData: PaymentData) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onPaymentComplete(paymentData)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Modal Container */}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LiquidGlassView
          effect="regular"
          colorScheme="dark"
          style={styles.modalCard}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>CHECKOUT</Text>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
          </View>

          {/* Payment Method Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, paymentMethod === 'cash' && styles.tabActive]}
              onPress={() => handleTabChange('cash')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="cash-outline"
                size={20}
                color={paymentMethod === 'cash' ? '#10b981' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={[styles.tabText, paymentMethod === 'cash' && styles.tabTextActive]}>
                CASH
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, paymentMethod === 'card' && styles.tabActive]}
              onPress={() => handleTabChange('card')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="card-outline"
                size={20}
                color={paymentMethod === 'card' ? '#10b981' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={[styles.tabText, paymentMethod === 'card' && styles.tabTextActive]}>
                CARD
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, paymentMethod === 'split' && styles.tabActive]}
              onPress={() => handleTabChange('split')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={20}
                color={paymentMethod === 'split' ? '#10b981' : 'rgba(255,255,255,0.6)'}
              />
              <Text style={[styles.tabText, paymentMethod === 'split' && styles.tabTextActive]}>
                SPLIT
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>{itemCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
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
    bottom: 0,
    left: 0,
    right: 0,
    top: '40%',
  },
  modalCard: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
    overflow: 'hidden',
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
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
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
    maxHeight: SCREEN_HEIGHT * 0.5,
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
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
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
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
})

export default memo(POSPaymentModal)
