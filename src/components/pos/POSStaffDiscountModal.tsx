/**
 * POSStaffDiscountModal - Staff Discount Entry
 * Apple Engineering: Focused, clean, purposeful
 *
 * DESIGN PRINCIPLES:
 * - Single task: Apply staff discount to cart item
 * - Two modes: Percentage or Fixed Amount
 * - Large touch targets (44pt minimum)
 * - Clear visual hierarchy
 * - Spring animations
 * - Haptic feedback
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, radius } from '@/theme/tokens'
import { BlurView } from 'expo-blur'

// Stores
import { useCheckoutUIStore, checkoutUIActions } from '@/stores/checkout-ui.store'
import { cartActions } from '@/stores/cart.store'

// Apple-standard spring config
const SPRING_CONFIG = {
  tension: 300,
  friction: 26,
  useNativeDriver: true,
}

type DiscountType = 'percentage' | 'amount'

export function POSStaffDiscountModal() {
  // ========================================
  // STATE
  // ========================================
  const activeModal = useCheckoutUIStore((state) => state.activeModal)
  const staffDiscountItemId = useCheckoutUIStore((state) => state.staffDiscountItemId)
  const visible = activeModal === 'staffDiscount' && staffDiscountItemId !== null

  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [value, setValue] = useState('')

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  const inputRef = useRef<TextInput>(null)

  // ========================================
  // EFFECTS - Apple-standard 60fps animations
  // ========================================
  useEffect(() => {
    if (visible) {
      // Reset state and position
      setDiscountType('percentage')
      setValue('')
      fadeAnim.setValue(0)
      slideAnim.setValue(50)

      // Animate in with optimized spring
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          ...SPRING_CONFIG,
        }),
      ]).start(() => {
        // Focus input after animation completes
        inputRef.current?.focus()
      })
    }
  }, [visible, fadeAnim, slideAnim])

  // ========================================
  // HANDLERS
  // ========================================
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    checkoutUIActions.closeModal()
  }, [])

  // Double-tap backdrop to close
  const lastTapRef = useRef<number>(0)
  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      checkoutUIActions.closeModal()
    }
    lastTapRef.current = now
  }, [])

  const handleTypeChange = useCallback((type: DiscountType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setDiscountType(type)
    setValue('')
    inputRef.current?.focus()
  }, [])

  const handleApply = useCallback(() => {
    if (!staffDiscountItemId || !value || parseFloat(value) <= 0) {
      return
    }

    const numValue = parseFloat(value)

    // Validate
    if (discountType === 'percentage' && numValue > 100) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    // Apply discount to cart item
    cartActions.applyStaffDiscount(staffDiscountItemId, discountType, numValue)

    // Success feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Close modal
    checkoutUIActions.closeModal()
  }, [staffDiscountItemId, discountType, value])

  const handleClear = useCallback(() => {
    if (!staffDiscountItemId) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    cartActions.clearStaffDiscount(staffDiscountItemId)
    checkoutUIActions.closeModal()
  }, [staffDiscountItemId])

  // ========================================
  // COMPUTED
  // ========================================
  const isValid = value && parseFloat(value) > 0
  const maxValue = discountType === 'percentage' ? 100 : 9999

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop - double tap to close */}
        <Pressable style={styles.backdrop} onPress={handleDoubleTap}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          </Animated.View>
        </Pressable>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Staff Discount</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Type Selector */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              onPress={() => handleTypeChange('percentage')}
              style={[
                styles.typeButton,
                discountType === 'percentage' && styles.typeButtonActive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  discountType === 'percentage' && styles.typeButtonTextActive,
                ]}
              >
                Percentage
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTypeChange('amount')}
              style={[
                styles.typeButton,
                discountType === 'amount' && styles.typeButtonActive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  discountType === 'amount' && styles.typeButtonTextActive,
                ]}
              >
                Fixed Amount
              </Text>
            </TouchableOpacity>
          </View>

          {/* Value Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputPrefix}>
              {discountType === 'percentage' ? '%' : '$'}
            </Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.text.disabled}
              maxLength={discountType === 'percentage' ? 3 : 6}
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleApply}
            />
          </View>

          {/* Helper Text */}
          <Text style={styles.helperText}>
            {discountType === 'percentage'
              ? 'Enter discount percentage (1-100)'
              : 'Enter discount amount in dollars'}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>Clear Discount</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={[styles.applyButton, !isValid && styles.applyButtonDisabled]}
              activeOpacity={0.7}
              disabled={!isValid}
            >
              <Text style={[styles.applyButtonText, !isValid && styles.applyButtonTextDisabled]}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ========================================
// STYLES - Modern Glass Design
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(20,20,22,0.95)',
    borderRadius: 24,
    borderCurve: 'continuous' as any,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    // Modern shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },
  // Header - Hero style
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeButtonText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  // Type Selector - Modern pill style
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 6,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.2,
  },
  typeButtonTextActive: {
    color: '#10b981',
  },
  // Input - Large hero style
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderCurve: 'continuous' as any,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    minHeight: 80,
  },
  inputPrefix: {
    fontSize: 32,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  helperText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: -0.1,
    textAlign: 'center',
    marginTop: -8,
  },
  // Actions - Modern button style
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderCurve: 'continuous' as any,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.2,
  },
  applyButton: {
    flex: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 16,
    borderCurve: 'continuous' as any,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  applyButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.2,
  },
  applyButtonTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
})
