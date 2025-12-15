/**
 * PaymentProcessingAnimation - Unified Processing Animation
 *
 * Apple Pay inspired: Clean spinning ring with pulsing glow
 * Used across all payment views for consistent UX
 */

import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface PaymentProcessingAnimationProps {
  amount: string
  title?: string
  subtitle?: string
  icon?: keyof typeof Ionicons.glyphMap
  showProgress?: boolean
}

export function PaymentProcessingAnimation({
  amount,
  title = 'Processing Payment',
  subtitle = 'Please wait...',
  icon = 'card',
  showProgress = true,
}: PaymentProcessingAnimationProps) {
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const ringRotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )

    // Glow animation
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    )

    // Ring rotation
    const ring = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    // Progress simulation (visual only - 30s to reach 90%)
    const progress = Animated.timing(progressAnim, {
      toValue: 0.9,
      duration: 30000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    })

    pulse.start()
    glow.start()
    ring.start()
    if (showProgress) {
      progress.start()
    }

    return () => {
      pulse.stop()
      glow.stop()
      ring.stop()
      progress.stop()
    }
  }, [showProgress])

  const ringRotationInterpolate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  })

  return (
    <View style={styles.container}>
      {/* Animated Ring */}
      <View style={styles.ringContainer}>
        <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
        <Animated.View
          style={[
            styles.spinnerRing,
            { transform: [{ rotate: ringRotationInterpolate }] },
          ]}
        >
          <View style={styles.spinnerDot} />
        </Animated.View>
        <Animated.View
          style={[styles.centerCircle, { transform: [{ scale: pulseAnim }] }]}
        >
          <Ionicons name={icon} size={32} color="#fff" />
        </Animated.View>
      </View>

      {/* Amount */}
      <Text style={styles.amount}>{amount}</Text>

      {/* Status Text */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Progress Bar */}
      {showProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  ringContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  spinnerRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#10b981',
  },
  spinnerDot: {
    position: 'absolute',
    top: -4,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  centerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
})
