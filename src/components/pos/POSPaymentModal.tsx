/**
 * POS Payment Modal
 * Optimized glass modal for checkout - INSTANT OPEN
 */

import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, useWindowDimensions, Platform, KeyboardAvoidingView, Pressable, PanResponder, InteractionManager } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { POSDiscountBar } from './payment/POSDiscountBar'
import { CashPaymentView } from './payment/CashPaymentView'
import { CardPaymentView } from './payment/CardPaymentView'
import { SplitPaymentView } from './payment/SplitPaymentView'
import { SplitCardPaymentView } from './payment/SplitCardPaymentView'
import { playSaleCompletionSound } from '@/lib/id-scanner/audio'
import type { PaymentModalProps, PaymentData, SaleCompletionData } from './payment/PaymentTypes'
import { useModalData } from '@/stores/checkout-ui.store'

type PaymentMethod = 'cash' | 'card' | 'split' | 'multi-card'

interface RetryContext {
  orderId: string
  orderNumber: string
  card1Amount: number
  card1Auth: string
  card1Last4: string
  amountRemaining: number
}

// Tab config for cleaner rendering
const TABS: { id: PaymentMethod; icon: string; label: string }[] = [
  { id: 'cash', icon: 'cash-outline', label: 'Cash' },
  { id: 'card', icon: 'card-outline', label: 'Card' },
  { id: 'split', icon: 'git-compare-outline', label: 'Split' },
  { id: 'multi-card', icon: 'copy-outline', label: '2 Cards' },
]

function POSPaymentModal({
  visible,
  total,
  itemCount,
  onPaymentComplete,
  onCancel,
}: PaymentModalProps) {
  const modalData = useModalData()
  const retryContext: RetryContext | undefined = modalData?.mode === 'retry' ? {
    orderId: modalData.orderId,
    orderNumber: modalData.orderNumber,
    card1Amount: modalData.card1Amount,
    card1Auth: modalData.card1Auth,
    card1Last4: modalData.card1Last4,
    amountRemaining: modalData.amountRemaining,
  } : undefined

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [completionData, setCompletionData] = useState<SaleCompletionData | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [contentReady, setContentReady] = useState(false) // Deferred content loading
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  // Refs for pan responder and double-tap
  const showSuccessRef = useRef(false)
  const onCancelRef = useRef(onCancel)
  const lastTapRef = useRef<number>(0)

  // Animation values - stored in refs for pan responder access
  const slideAnimRef = useRef(new Animated.Value(height))
  const opacityAnimRef = useRef(new Animated.Value(0))
  const successAnimRef = useRef(new Animated.Value(0))
  const slideAnim = slideAnimRef.current
  const opacityAnim = opacityAnimRef.current
  const successAnim = successAnimRef.current

  // Sync refs
  useEffect(() => { showSuccessRef.current = showSuccess }, [showSuccess])
  useEffect(() => { onCancelRef.current = onCancel }, [onCancel])

  // Auto-switch tab for retry
  useEffect(() => {
    if (visible && retryContext) setPaymentMethod('multi-card')
  }, [visible, retryContext])

  // Pan responder for drag-to-dismiss with integrated double-tap
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capture vertical drags (but not during success animation)
        return !showSuccessRef.current && Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
      },
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0 && !showSuccessRef.current) {
          slideAnimRef.current.setValue(gestureState.dy)
          opacityAnimRef.current.setValue(Math.max(0, 1 - gestureState.dy / 300))
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (showSuccessRef.current) return

        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Dismiss
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onCancelRef.current()
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(slideAnimRef.current, { toValue: 0, tension: 300, friction: 26, useNativeDriver: true }),
            Animated.timing(opacityAnimRef.current, { toValue: 1, duration: 120, useNativeDriver: true }),
          ]).start()
        }
      },
    })
  ).current

  // INSTANT OPEN: Animate in when visible, defer heavy content
  useEffect(() => {
    if (visible) {
      // Reset state immediately
      setShowSuccess(false)
      setCompletionData(null)
      successAnim.setValue(0)
      lastTapRef.current = 0 // Reset double-tap state

      // Start slide-up animation IMMEDIATELY (modal shell appears instantly)
      slideAnim.setValue(height * 0.3) // Start slightly below
      opacityAnim.setValue(0.5)

      // Fast spring animation for responsive feel
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 200,
          friction: 22,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true
        }),
      ]).start()

      // Defer heavy content (payment views) until after animation
      InteractionManager.runAfterInteractions(() => {
        setContentReady(true)
      })
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: height, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => {
        setPaymentMethod('cash')
        setShowSuccess(false)
        setCompletionData(null)
        setContentReady(false)
      })
    }
  }, [visible, height])

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onCancel()
  }, [onCancel])

  // Double-tap anywhere to close (same pattern as other modals)
  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onCancel()
    }
    lastTapRef.current = now
  }, [onCancel])

  const handleTabChange = useCallback((method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPaymentMethod(method)
  }, [])

  const handlePaymentComplete = useCallback(async (paymentData: PaymentData) => {
    const saleData = await onPaymentComplete(paymentData)
    setCompletionData(saleData)
    setShowSuccess(true)

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    playSaleCompletionSound()

    Animated.spring(successAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start()

    setTimeout(() => {
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onCancel())
    }, 1500)

    return saleData
  }, [onPaymentComplete, onCancel, successAnim])

  if (!visible) return null

  const successScale = successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] })
  const contentOpacity = successAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })

  const displayTotal = retryContext?.amountRemaining ?? total

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        {/* Full-screen double-tap to close (same as other modals) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={showSuccess ? undefined : handleDoubleTap}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <Animated.View style={[styles.sheet, { height: height * 0.92, transform: [{ translateY: slideAnim }] }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
            {/* Double-tap anywhere on content to close */}
            <Pressable
              style={[styles.content, { paddingBottom: insets.bottom }]}
              onPress={showSuccess ? undefined : handleDoubleTap}
            >
              {/* Content blur - matches other modals */}
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

              {/* Handle - drag to close */}
              <View
                style={styles.handleRow}
                {...panResponder.panHandlers}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Drag handle"
                accessibilityHint="Swipe down to close payment modal"
              >
                <View style={styles.handle} />
              </View>

              {/* Success Overlay */}
              {showSuccess && completionData && (
                <Animated.View
                  style={[styles.success, { opacity: successAnim, transform: [{ scale: successScale }] }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={`Payment complete. Total ${completionData.total?.toFixed(2)} dollars. Order number ${completionData.orderNumber}${completionData.changeGiven && completionData.changeGiven > 0 ? `. Change due ${completionData.changeGiven.toFixed(2)} dollars` : ''}`}
                >
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={56} color="#fff" />
                  </View>
                  <Text style={styles.successAmount}>${completionData.total?.toFixed(2)}</Text>
                  <Text style={styles.successOrder}>#{completionData.orderNumber}</Text>
                  {completionData.changeGiven !== undefined && completionData.changeGiven > 0 && (
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Change</Text>
                      <Text style={styles.changeAmount}>${completionData.changeGiven.toFixed(2)}</Text>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* Main Content */}
              <Animated.View style={[styles.flex, { opacity: contentOpacity }]}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.label}>{retryContext ? 'RETRY CARD 2' : 'CHECKOUT'}</Text>
                  <Text style={styles.amount}>${displayTotal.toFixed(2)}</Text>
                  <Text style={styles.subtext}>
                    {retryContext
                      ? `Order #${retryContext.orderNumber} · Card 1 paid $${retryContext.card1Amount.toFixed(2)}`
                      : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                  </Text>
                </View>

                {/* Body */}
                <View style={styles.body}>
                  {!retryContext && <POSDiscountBar />}

                  {/* Tabs */}
                  {!retryContext && (
                    <View style={styles.tabs} accessibilityRole="tablist">
                      {TABS.map(tab => (
                        <TouchableOpacity
                          key={tab.id}
                          style={[styles.tab, paymentMethod === tab.id && styles.tabActive]}
                          onPress={() => handleTabChange(tab.id)}
                          activeOpacity={0.7}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: paymentMethod === tab.id }}
                          accessibilityLabel={`${tab.label} payment`}
                          accessibilityHint={`Switch to ${tab.label.toLowerCase()} payment method`}
                        >
                          <Ionicons
                            name={tab.icon as any}
                            size={18}
                            color={paymentMethod === tab.id ? '#10b981' : 'rgba(255,255,255,0.5)'}
                          />
                          <Text style={[styles.tabText, paymentMethod === tab.id && styles.tabTextActive]}>
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Payment View - Deferred until animation completes */}
                  <View style={styles.paymentView}>
                    {contentReady && paymentMethod === 'cash' && (
                      <CashPaymentView onComplete={handlePaymentComplete} onCancel={handleClose} />
                    )}
                    {contentReady && paymentMethod === 'card' && (
                      <CardPaymentView onComplete={handlePaymentComplete} onCancel={handleClose} />
                    )}
                    {contentReady && paymentMethod === 'split' && (
                      <SplitPaymentView onComplete={handlePaymentComplete} onCancel={handleClose} />
                    )}
                    {contentReady && paymentMethod === 'multi-card' && (
                      <SplitCardPaymentView onComplete={handlePaymentComplete} onCancel={handleClose} retryContext={retryContext} />
                    )}
                  </View>
                </View>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    minHeight: 44, // Apple minimum touch target
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // Header
  header: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -2,
  },
  subtext: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  // Body
  body: { flex: 1, paddingHorizontal: 24 },
  paymentView: { flex: 1, marginTop: 8 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: '#10b981' },

  // Success
  success: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  successAmount: {
    fontSize: 52,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -2,
    marginBottom: 4,
  },
  successOrder: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 16,
  },
  changeLabel: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  changeAmount: { fontSize: 18, fontWeight: '700', color: '#10b981' },
})

export default memo(POSPaymentModal)
