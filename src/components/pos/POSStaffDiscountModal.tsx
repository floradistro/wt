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
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={handleClose}>
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
// STYLES - Apple Design System
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg, // 20px
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.glass.regular,
    borderRadius: radius.lg, // 16px
    borderCurve: 'continuous' as any,
    padding: spacing.lg, // 20px
    gap: spacing.lg, // 20px
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.text.tertiary,
  },
  // Type Selector
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.xs, // 8px
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.md, // 16px
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md, // 12px
    borderCurve: 'continuous' as any,
    borderWidth: 1,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Apple HIG minimum
  },
  typeButtonActive: {
    backgroundColor: colors.semantic.infoBg,
    borderColor: colors.semantic.info,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
  typeButtonTextActive: {
    color: colors.semantic.info,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md, // 12px
    borderCurve: 'continuous' as any,
    borderWidth: 1,
    borderColor: colors.border.regular,
    paddingHorizontal: spacing.md, // 16px
    minHeight: 60,
  },
  inputPrefix: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginRight: spacing.xs, // 8px
  },
  input: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.8,
  },
  helperText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.tertiary,
    letterSpacing: -0.1,
    textAlign: 'center',
    marginTop: -spacing.sm, // -12px (tighten gap)
  },
  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.xs, // 8px
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.md, // 16px
    backgroundColor: colors.glass.regular,
    borderRadius: radius.md, // 12px
    borderCurve: 'continuous' as any,
    borderWidth: 1,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: -0.2,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.md, // 16px
    backgroundColor: colors.semantic.infoBg,
    borderRadius: radius.md, // 12px
    borderCurve: 'continuous' as any,
    borderWidth: 1,
    borderColor: colors.semantic.info,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  applyButtonDisabled: {
    backgroundColor: colors.glass.regular,
    borderColor: colors.border.subtle,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.semantic.info,
    letterSpacing: -0.2,
  },
  applyButtonTextDisabled: {
    color: colors.text.disabled,
  },
})
