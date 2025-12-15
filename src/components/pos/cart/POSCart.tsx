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

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Animated, Easing } from 'react-native'
import { useCallback, useState, useRef, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'    // ms total to end session (after press starts)
import { POSCartItem } from './POSCartItem'
import { POSTotalsSection } from './POSTotalsSection'
import { POSScannedOrderCard } from '../POSScannedOrderCard'
import { layout } from '@/theme/layout'

// Stores
import { useCartItems, cartActions, useCartTotals } from '@/stores/cart.store'
import { useScannedOrder } from '@/stores/scanned-order.store'

// Timing constants
const CLEAR_CART_DELAY = 600      // ms to clear cart
const END_SESSION_DELAY = 2000

interface POSCartProps {
  onEndSession?: () => void
}

export function POSCart({ onEndSession }: POSCartProps) {
  // ========================================
  // SAFE AREA - For iOS status bar
  // ========================================
  const insets = useSafeAreaInsets()

  // ========================================
  // LOCAL STATE
  // ========================================

  // ========================================
  // ANIMATION - Long press feedback
  // ========================================
  const scaleAnim = useRef(new Animated.Value(1)).current
  const opacityAnim = useRef(new Animated.Value(1)).current
  const endSessionProgress = useRef(new Animated.Value(0)).current
  const [showEndSessionHint, setShowEndSessionHint] = useState(false)
  const [endSessionCountdown, setEndSessionCountdown] = useState<number | null>(null)

  // Timers for staged long press
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const endSessionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPressing = useRef(false)

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
  // CLEANUP - Clear timers on unmount
  // ========================================
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
      if (endSessionTimerRef.current) clearTimeout(endSessionTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [])

  // ========================================
  // HANDLERS - Staged Long Press
  // ========================================
  const clearAllTimers = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (endSessionTimerRef.current) {
      clearTimeout(endSessionTimerRef.current)
      endSessionTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  const handlePressIn = useCallback(() => {
    // Clear any existing timers first
    clearAllTimers()

    isPressing.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Reset animations to starting state
    scaleAnim.setValue(1)
    opacityAnim.setValue(1)
    endSessionProgress.setValue(0)

    // Scale down to indicate press
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start()

    // Stage 1: Clear cart after CLEAR_CART_DELAY (if cart has items)
    if (cart.length > 0) {
      pressTimerRef.current = setTimeout(() => {
        if (!isPressing.current) return

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        // Flash animation on clear
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start()

        cartActions.clearCart()
        cartActions.setDiscountingItemId(null)

        // Start end session countdown after cart is cleared
        if (isPressing.current) {
          startEndSessionPhase()
        }
      }, CLEAR_CART_DELAY)
    } else {
      // Cart is empty - start end session countdown after a brief delay
      pressTimerRef.current = setTimeout(() => {
        if (isPressing.current) {
          startEndSessionPhase()
        }
      }, CLEAR_CART_DELAY)
    }
  }, [cart.length, scaleAnim, opacityAnim, endSessionProgress, clearAllTimers])

  const startEndSessionPhase = useCallback(() => {
    if (!isPressing.current) return

    // Show hint and start progress animation
    setShowEndSessionHint(true)
    setEndSessionCountdown(2)

    // Subtle haptic to indicate new stage
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // Progress bar animation
    Animated.timing(endSessionProgress, {
      toValue: 1,
      duration: END_SESSION_DELAY - CLEAR_CART_DELAY,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start()

    // Countdown updates
    countdownIntervalRef.current = setInterval(() => {
      if (!isPressing.current) return
      setEndSessionCountdown(prev => {
        if (prev === null || prev <= 1) return prev
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        return prev - 1
      })
    }, 700)

    // End session timer
    endSessionTimerRef.current = setTimeout(() => {
      if (!isPressing.current) return

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      clearAllTimers()
      isPressing.current = false
      setShowEndSessionHint(false)
      setEndSessionCountdown(null)

      if (onEndSession) {
        onEndSession()
      }
    }, END_SESSION_DELAY - CLEAR_CART_DELAY)
  }, [endSessionProgress, clearAllTimers, onEndSession])

  const handlePressOut = useCallback(() => {
    isPressing.current = false
    clearAllTimers()

    // Reset UI state
    setShowEndSessionHint(false)
    setEndSessionCountdown(null)

    // Reset animations
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 20,
        useNativeDriver: true,
      }),
      Animated.timing(endSessionProgress, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start()
  }, [clearAllTimers, scaleAnim, endSessionProgress])

  // ========================================
  // RENDER - Scanned Order takes precedence
  // ========================================
  if (scannedOrder) {
    return (
      <View style={[styles.cartCard, { paddingTop: insets.top }]}>
        <POSScannedOrderCard />
      </View>
    )
  }

  return (
    <View style={[styles.cartCard, { paddingTop: insets.top }]}>
      {/* Cart Items - Staged long press: clear cart → end session */}
      <Pressable
        style={styles.cartItemsContainer}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="none"
        accessibilityLabel={cart.length > 0 ? `Cart with ${itemCount} items, subtotal ${subtotal.toFixed(2)} dollars` : 'Empty cart'}
        accessibilityHint="Long press to clear cart, keep holding to end session"
      >
        <Animated.View
          style={[
            styles.cartItemsAnimated,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <ScrollView
            style={styles.cartItems}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            scrollIndicatorInsets={{ right: 2, bottom: layout.dockHeight }}
            contentContainerStyle={{ paddingBottom: layout.dockHeight }}
          >
            {cart.length === 0 ? (
              <View style={styles.emptyCart} accessibilityRole="text" accessibilityLabel="Cart is empty. Add items to get started.">
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
        </Animated.View>

        {/* End Session Hint Overlay */}
        {showEndSessionHint && (
          <View style={styles.endSessionOverlay} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <View style={styles.endSessionHintContainer}>
              <Text style={styles.endSessionHintText} accessibilityLabel="Keep holding to end session">Keep holding to end session</Text>
              <View style={styles.endSessionProgressContainer}>
                <Animated.View
                  style={[
                    styles.endSessionProgressBar,
                    {
                      width: endSessionProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}
      </Pressable>

      {cart.length > 0 && (
        <>
          <View style={styles.cartDivider} />

          {/* Totals and Checkout */}
          <POSTotalsSection />
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  cartCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)', // Match product card glass tint
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
  },
  cartHeader: {
    paddingHorizontal: 8,
    paddingTop: 0,  // No extra padding - safe area is enough
    paddingBottom: 8,
    gap: 8,
  },
  cartItemsContainer: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cartItemsAnimated: {
    flex: 1,
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
    height: 0.33, // Match modal border thickness
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },
  // End Session Overlay - Appears during extended hold
  endSessionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  endSessionHintContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  endSessionHintText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    textAlign: 'center',
  },
  endSessionProgressContainer: {
    width: 160,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  endSessionProgressBar: {
    height: '100%',
    backgroundColor: 'rgba(255,100,100,0.8)',
    borderRadius: 2,
  },
})
