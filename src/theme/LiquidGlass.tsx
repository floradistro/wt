/**
 * LiquidGlass Component
 * Jobs Principle: "Replicate the FEELING, not the technology"
 *
 * Simulates Apple's iOS 18.1+ Liquid Glass effect using:
 * - Multiple stacked blur layers (depth)
 * - Subtle gradient overlays (light refraction)
 * - Animated shimmer effects (fluidity)
 * - Vibrancy simulation with rgba layers
 * - Dynamic opacity based on content
 *
 * Result: Feels like real glass without Apple's custom silicon
 */

import { View, StyleSheet, Animated, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { memo, useEffect, useRef, ReactNode } from 'react'
import { colors, blur } from './tokens'

interface LiquidGlassProps {
  children?: ReactNode
  intensity?: 'ultraThin' | 'thin' | 'regular' | 'thick' | 'ultraThick'
  style?: any
  animate?: boolean // Enable subtle shimmer animation
}

/**
 * LiquidGlass - Apple-inspired liquid glass effect
 *
 * JOBS PRINCIPLE: "Make it feel like you're touching real glass"
 *
 * Layer Stack (bottom to top):
 * 1. Base blur (UIVisualEffectView)
 * 2. Vibrancy layer (color sampling simulation)
 * 3. Gradient overlay (light refraction)
 * 4. Shimmer effect (fluidity/movement)
 * 5. Border highlight (depth perception)
 */
function LiquidGlass({
  children,
  intensity = 'regular',
  style,
  animate = false
}: LiquidGlassProps) {
  // Animation for subtle shimmer effect
  const shimmerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (animate) {
      // Subtle breathing animation - like light moving across glass
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      ).start()
    }
  }, [animate])

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.02, 0.05, 0.02],
  })

  // Map intensity to blur values and layer opacities
  const intensityMap = {
    ultraThin: { blur: blur.ultraThin, vibrancy: 0.01, gradient: 0.03 },
    thin: { blur: blur.thin, vibrancy: 0.02, gradient: 0.04 },
    regular: { blur: blur.regular, vibrancy: 0.03, gradient: 0.05 },
    thick: { blur: blur.thick, vibrancy: 0.04, gradient: 0.06 },
    ultraThick: { blur: blur.ultraThick, vibrancy: 0.05, gradient: 0.08 },
  }

  const config = intensityMap[intensity]

  if (Platform.OS !== 'ios') {
    // Android fallback - single layer with gradient
    return (
      <View style={[styles.container, style]}>
        <View style={styles.androidBg} />
        <View style={[styles.vibrancyLayer, { opacity: config.vibrancy * 2 }]} />
        {children}
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      {/* LAYER 1: Base Blur - UIVisualEffectView (Apple's native blur) */}
      <BlurView
        intensity={config.blur}
        tint="systemUltraThinMaterial"
        style={StyleSheet.absoluteFill}
      />

      {/* LAYER 2: Vibrancy Simulation - Mimics color sampling */}
      <View style={[
        styles.vibrancyLayer,
        { backgroundColor: `rgba(255,255,255,${config.vibrancy})` }
      ]} />

      {/* LAYER 3: Light Refraction - Gradient overlay for depth */}
      <View style={styles.gradientContainer}>
        <View style={[
          styles.topGradient,
          { opacity: config.gradient }
        ]} />
      </View>

      {/* LAYER 4: Shimmer Effect - Subtle movement (optional) */}
      {animate && (
        <Animated.View
          style={[
            styles.shimmerLayer,
            { opacity: shimmerOpacity }
          ]}
        />
      )}

      {/* LAYER 5: Border Highlight - Depth perception */}
      <View style={styles.borderHighlight} />

      {/* Content */}
      {children}
    </View>
  )
}

const LiquidGlassMemo = memo(LiquidGlass)
export { LiquidGlassMemo as LiquidGlass }

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.glass.ultraThin, // Fallback base
  },

  // Vibrancy layer - simulates dynamic color sampling
  vibrancyLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  // Gradient container for light refraction effect
  gradientContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },

  // Top-to-bottom gradient - mimics light hitting glass from above
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Shimmer layer - subtle animated light movement
  shimmerLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Border highlight - creates depth perception
  borderHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    pointerEvents: 'none',
  },

  // Android fallback
  androidBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.secondary,
  },
})
