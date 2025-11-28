/**
 * SaleSuccessModal - Apple-quality transaction completion
 *
 * Steve Jobs would say:
 * "The moment of sale completion is the customer's emotional peak.
 *  Make it beautiful. Make it memorable. Make them feel good about spending money."
 *
 * Inspired by:
 * - Apple Pay success animation
 * - Apple Watch activity completion
 * - iOS native payment confirmation
 */

import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Modal, Animated, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { playSaleCompletionSound } from '@/lib/id-scanner/audio'
import type { SaleCompletionData } from './payment'

interface SaleSuccessModalProps {
  visible: boolean
  completionData: SaleCompletionData | null
  onDismiss: () => void
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export function SaleSuccessModal({
  visible,
  completionData,
  onDismiss,
}: SaleSuccessModalProps) {
  // ============================================================================
  // ANIMATIONS - Apple-quality springs and timings
  // ============================================================================
  const checkmarkScale = useRef(new Animated.Value(0)).current
  const checkmarkRotate = useRef(new Animated.Value(0)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentTranslateY = useRef(new Animated.Value(20)).current
  const ringScale = useRef(new Animated.Value(0.3)).current
  const ringOpacity = useRef(new Animated.Value(0)).current

  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (visible && completionData) {
      // Reset all animations
      checkmarkScale.setValue(0)
      checkmarkRotate.setValue(0)
      contentOpacity.setValue(0)
      contentTranslateY.setValue(20)
      ringScale.setValue(0.3)
      ringOpacity.setValue(0)
      setShowContent(false)

      // ========================================
      // ANIMATION SEQUENCE (Apple choreography)
      // ========================================

      // Step 1: Ring pulse (0-300ms)
      Animated.sequence([
        Animated.parallel([
          Animated.spring(ringScale, {
            toValue: 1.2,
            tension: 50,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.3,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(ringScale, {
            toValue: 1,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start()

      // Step 2: Checkmark bounce with rotation (200-600ms)
      setTimeout(() => {
        // Success haptic (like Apple Pay)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Satisfying success sound (subtle but rewarding)
        playSaleCompletionSound()

        Animated.parallel([
          Animated.spring(checkmarkScale, {
            toValue: 1,
            tension: 40,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(checkmarkRotate, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start()
      }, 200)

      // Step 3: Content fade in (600-900ms)
      setTimeout(() => {
        setShowContent(true)
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(contentTranslateY, {
            toValue: 0,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start()
      }, 600)

      // Step 4: Auto-dismiss with fade out (1.8s total - faster)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(checkmarkScale, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDismiss()
        })
      }, 1800)
    }
  }, [visible, completionData])

  if (!visible || !completionData) return null

  const checkmarkRotation = checkmarkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-180deg', '0deg'],
  })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <BlurView intensity={30} style={styles.backdrop}>
        <View style={styles.container}>
          {/* ======================================== */}
          {/* SUCCESS ICON - Apple-style checkmark */}
          {/* ======================================== */}
          <View style={styles.iconContainer}>
            {/* Pulsing ring behind checkmark */}
            <Animated.View
              style={[
                styles.successRing,
                {
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity,
                },
              ]}
            />

            {/* Checkmark icon */}
            <Animated.View
              style={{
                transform: [
                  { scale: checkmarkScale },
                  { rotate: checkmarkRotation },
                ],
              }}
            >
              <View style={styles.checkmarkCircle}>
                <Ionicons
                  name="checkmark"
                  size={64}
                  color="#FFFFFF"
                />
              </View>
            </Animated.View>
          </View>

          {/* ======================================== */}
          {/* TRANSACTION DETAILS */}
          {/* ======================================== */}
          {showContent && (
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: contentOpacity,
                  transform: [{ translateY: contentTranslateY }],
                },
              ]}
            >
              {/* Payment Confirmed */}
              <Text style={styles.title}>Payment Complete</Text>

              {/* Transaction Amount - PROMINENT */}
              <View style={styles.amountContainer}>
                <Text style={styles.amountCurrency}>$</Text>
                <Text style={styles.amountValue}>
                  {completionData.total.toFixed(2)}
                </Text>
              </View>

              {/* Payment Method Badge */}
              <View style={styles.methodBadge}>
                <Ionicons
                  name={
                    completionData.paymentMethod === 'cash'
                      ? 'cash-outline'
                      : 'card-outline'
                  }
                  size={16}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={styles.methodText}>
                  {completionData.paymentMethod === 'cash' ? 'Cash' : 'Card'}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Transaction Details */}
              <View style={styles.detailsContainer}>
                {/* Order Number */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Order</Text>
                  <Text style={styles.detailValue}>
                    #{completionData.orderNumber}
                  </Text>
                </View>

                {/* Change Given (Cash only) */}
                {completionData.paymentMethod === 'cash' &&
                 completionData.changeGiven !== undefined &&
                 completionData.changeGiven > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Change</Text>
                    <Text style={[styles.detailValue, styles.changeValue]}>
                      ${completionData.changeGiven.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Loyalty Points */}
                {completionData.loyaltyPointsAdded !== undefined &&
                 completionData.loyaltyPointsAdded > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Points Earned</Text>
                    <View style={styles.pointsContainer}>
                      <Ionicons
                        name="star"
                        size={14}
                        color="#fbbf24"
                      />
                      <Text style={[styles.detailValue, styles.pointsValue]}>
                        +{completionData.loyaltyPointsAdded}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Success indicator */}
              <View style={styles.successIndicator}>
                <View style={styles.successDot} />
                <Text style={styles.successText}>Transaction recorded</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </BlurView>
    </Modal>
  )
}

// ============================================================================
// STYLES - Apple design language
// ============================================================================
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    // iOS-style shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },

  // ========================================
  // Icon Container
  // ========================================
  iconContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#10b981',
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    // Soft glow
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },

  // ========================================
  // Content
  // ========================================
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    letterSpacing: -0.5,
  },

  // ========================================
  // Amount Display - Most Prominent
  // ========================================
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  amountCurrency: {
    fontSize: 32,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },

  // ========================================
  // Payment Method Badge
  // ========================================
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    gap: 6,
  },
  methodText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.2,
  },

  // ========================================
  // Divider
  // ========================================
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },

  // ========================================
  // Transaction Details
  // ========================================
  detailsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  changeValue: {
    color: '#10b981',
    fontWeight: '700',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsValue: {
    color: '#fbbf24',
    fontWeight: '700',
  },

  // ========================================
  // Success Indicator
  // ========================================
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  successText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -0.1,
  },
})
