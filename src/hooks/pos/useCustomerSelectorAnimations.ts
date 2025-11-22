/**
 * useCustomerSelectorAnimations Hook
 * Jobs Principle: Manage all animations for customer selector
 *
 * Extracted from POSUnifiedCustomerSelector to improve maintainability
 * Handles:
 * - Sheet animations (bottom position, height)
 * - Preview card animations (opacity, checkmark)
 * - Loading spinner animation
 * - Focus ring animation
 * - Keyboard handling
 */

import { useRef, useEffect } from 'react'
import { Animated, Keyboard, Platform, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Customer } from '@/types/pos'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

const { height } = Dimensions.get('window')

export function useCustomerSelectorAnimations(
  isTypingMode: boolean,
  customersCount: number,
  parsedData: AAMVAData | null,
  matchedCustomer: Customer | null
) {
  const insets = useSafeAreaInsets()

  // ========================================
  // ANIMATED VALUES
  // ========================================
  // Use translateY instead of height for native driver (60fps butter)
  const sheetTranslateY = useRef(new Animated.Value(height - 200)).current
  const previewOpacity = useRef(new Animated.Value(0)).current
  const checkmarkScale = useRef(new Animated.Value(0)).current
  const loadingRotation = useRef(new Animated.Value(0)).current
  const focusRingScale = useRef(new Animated.Value(0)).current
  const focusRingOpacity = useRef(new Animated.Value(0)).current

  // ========================================
  // KEYBOARD STATE
  // ========================================
  const keyboardHeightRef = useRef(0)

  // ========================================
  // KEYBOARD LISTENERS
  // ========================================
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        keyboardHeightRef.current = e.endCoordinates.height
        // Don't animate bottom - sheet stays at bottom: 0 and expands upward
      }
    )

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardHeightRef.current = 0
      }
    )

    return () => {
      keyboardWillShow.remove()
      keyboardWillHide.remove()
    }
  }, [insets.bottom])

  // ========================================
  // PREVIEW CARD ANIMATION
  // ========================================
  useEffect(() => {
    if (parsedData) {
      Animated.spring(previewOpacity, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
        stiffness: 300,
      }).start()
    } else {
      previewOpacity.setValue(0)
    }
  }, [parsedData])

  // ========================================
  // LOADING SPINNER ANIMATION
  // ========================================
  useEffect(() => {
    if (parsedData && !matchedCustomer) {
      // Start continuous rotation for loading
      loadingRotation.setValue(0)
      Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: (t) => t, // Linear
        })
      ).start()
    } else {
      loadingRotation.setValue(0)
    }
  }, [parsedData, matchedCustomer])

  // ========================================
  // CHECKMARK ANIMATION
  // ========================================
  useEffect(() => {
    if (matchedCustomer) {
      Animated.spring(checkmarkScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 12,
        stiffness: 400,
      }).start()
    } else {
      checkmarkScale.setValue(0)
    }
  }, [matchedCustomer])

  // ========================================
  // SHEET SLIDE ANIMATION - Using transform for 60fps
  // ========================================
  useEffect(() => {
    const hasResults = customersCount > 0
    const keyboardHeight = keyboardHeightRef.current

    let targetTranslateY: number
    if (keyboardHeight > 0 || isTypingMode || hasResults) {
      // GO FULL SCREEN - slide all the way up
      targetTranslateY = 0
    } else {
      // COMPACT MODE - slide down so only 200px shows
      targetTranslateY = height - 200
    }

    // NATIVE DRIVER = 60fps smooth animation on UI thread
    Animated.spring(sheetTranslateY, {
      toValue: targetTranslateY,
      useNativeDriver: true, // ✨ BUTTER
      damping: 30,
      stiffness: 300,
      mass: 0.8,
    }).start()
  }, [isTypingMode, customersCount, height, insets.bottom])

  // ========================================
  // FOCUS RING ANIMATION
  // ========================================
  const animateFocusRing = () => {
    focusRingScale.setValue(1.5)
    focusRingOpacity.setValue(1)

    Animated.parallel([
      Animated.spring(focusRingScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 300,
      }),
      Animated.timing(focusRingOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start()
  }

  return {
    // Animated values
    sheetTranslateY,
    previewOpacity,
    checkmarkScale,
    loadingRotation,
    focusRingScale,
    focusRingOpacity,

    // Actions
    animateFocusRing,
  }
}
