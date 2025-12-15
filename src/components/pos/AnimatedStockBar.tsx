/**
 * AnimatedStockBar - Elegant animated stock level indicator
 * Apple-quality animation with smooth fill and fade effects
 *
 * OPTIMIZED: Uses scaleX transform with native driver for 60fps
 */

import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { useRef, useEffect, memo, useMemo } from 'react'

// Apple-standard spring for snappy animations
const SPRING_CONFIG = {
  tension: 300,
  friction: 26,
  useNativeDriver: true,
}

interface AnimatedStockBarProps {
  value: number
  maxValue?: number
  label: string
  color: string
  lowThreshold?: number
  delay?: number
  variant?: boolean
}

export const AnimatedStockBar = memo(({
  value,
  maxValue = 100,
  label,
  color,
  lowThreshold = 10,
  delay = 0,
  variant = false,
}: AnimatedStockBarProps) => {
  // Animation values - all use native driver now
  const fillScale = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const containerScale = useRef(new Animated.Value(0.98)).current

  // Calculate percentage (min 5% if value > 0 for visibility)
  const percentage = useMemo(() => {
    if (value <= 0) return 0
    return Math.min(100, Math.max(5, (value / Math.max(maxValue, value, 1)) * 100))
  }, [value, maxValue])

  const isLow = value <= lowThreshold && value > 0

  useEffect(() => {
    // Reset animations
    fillScale.setValue(0)
    opacity.setValue(0)
    containerScale.setValue(0.98)

    // Start after delay - all animations use native driver
    const timer = setTimeout(() => {
      Animated.parallel([
        // Fade in - native driver
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Container scale - native driver spring
        Animated.spring(containerScale, {
          toValue: 1,
          ...SPRING_CONFIG,
        }),
        // Fill scale - native driver spring (scaleX from 0 to 1)
        Animated.spring(fillScale, {
          toValue: percentage / 100,
          tension: 200,
          friction: 20,
          useNativeDriver: true,
        }),
      ]).start()
    }, delay)

    return () => clearTimeout(timer)
  }, [value, percentage, delay, fillScale, opacity, containerScale])

  return (
    <Animated.View
      style={[
        variant ? styles.variantContainer : styles.container,
        {
          opacity,
          transform: [{ scale: containerScale }],
        }
      ]}
    >
      {/* Track background */}
      <View style={styles.track}>
        {/* Animated fill - uses scaleX for native driver support */}
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              transform: [
                { scaleX: fillScale },
                { translateX: fillScale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0], // Slide from left as it scales
                }) },
              ],
            },
          ]}
        />
        {/* Subtle shine overlay */}
        <View style={styles.shine} />
      </View>

      {/* Label */}
      <Text
        style={[
          variant ? styles.variantLabel : styles.label,
          { color: isLow ? '#fbbf24' : color },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  )
})

AnimatedStockBar.displayName = 'AnimatedStockBar'

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  variantContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  track: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%', // Full width, controlled by scaleX
    borderRadius: 2,
    transformOrigin: 'left center', // Scale from left edge
  },
  shine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
    minWidth: 80,
  },
  variantLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
    minWidth: 60,
  },
})
