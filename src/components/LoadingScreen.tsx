import { View, Text, StyleSheet, Animated, Image } from 'react-native'
import { useEffect, useRef } from 'react'
import { colors, spacing, radius } from '@/theme/tokens'
import { BlurView } from 'expo-blur'

export function LoadingScreen() {
  // Core animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const logoGlowAnim = useRef(new Animated.Value(0)).current

  // Floating animation
  const floatAnim = useRef(new Animated.Value(0)).current

  // Loading dots
  const dot1 = useRef(new Animated.Value(0)).current
  const dot2 = useRef(new Animated.Value(0)).current
  const dot3 = useRef(new Animated.Value(0)).current

  // Shimmer/glow ring
  const glowRing = useRef(new Animated.Value(0)).current

  // Background orbs
  const orb1 = useRef(new Animated.Value(0)).current
  const orb2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Entrance animation - scale and fade
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start()

    // Gentle floating animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Subtle glow pulse on logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoGlowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Expanding glow ring animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowRing, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(glowRing, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Sequential loading dots
    const animateDots = () => {
      Animated.loop(
        Animated.stagger(200, [
          Animated.sequence([
            Animated.timing(dot1, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot1, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(dot2, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot2, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(dot3, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot3, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start()
    }
    animateDots()

    // Slow breathing orbs in background
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(orb1, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        }),
        Animated.timing(orb2, {
          toValue: 0,
          duration: 10000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  // Interpolations
  const floatTranslate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  })

  const glowOpacity = logoGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  })

  const ringScale = glowRing.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  })

  const ringOpacity = glowRing.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  })

  const orb1Scale = orb1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  })

  const orb2Scale = orb2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  })

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Animated background orbs */}
      <Animated.View
        style={[
          styles.orb1,
          { transform: [{ scale: orb1Scale }] }
        ]}
      />
      <Animated.View
        style={[
          styles.orb2,
          { transform: [{ scale: orb2Scale }] }
        ]}
      />

      {/* Center content */}
      <Animated.View
        style={[
          styles.centerContent,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: floatTranslate }
            ]
          }
        ]}
      >
        {/* Expanding glow ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />

        {/* Glass container with logo */}
        <View style={styles.glassContainer}>
          <View style={styles.glassContainerBg}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          </View>

          {/* Logo with glow effect */}
          <View style={styles.logoContainer}>
            {/* Glow layer */}
            <Animated.View
              style={[
                styles.logoGlow,
                { opacity: glowOpacity }
              ]}
            />

            {/* Logo */}
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* App name with styling */}
          <View style={styles.titleContainer}>
            <Text style={styles.appName}>WHALETOOLS</Text>
            <View style={styles.titleDivider} />
            <Text style={styles.tagline}>VENDOR PORTAL</Text>
          </View>

          {/* Animated loading dots */}
          <View style={styles.loadingIndicator}>
            <Animated.View style={[styles.loadingDot, { opacity: dot1 }]} />
            <Animated.View style={[styles.loadingDot, { opacity: dot2 }]} />
            <Animated.View style={[styles.loadingDot, { opacity: dot3 }]} />
          </View>
        </View>
      </Animated.View>

      {/* Bottom branding */}
      <Animated.View style={[styles.bottomBranding, { opacity: fadeAnim }]}>
        <Text style={styles.version}>Version 1.0.0</Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Animated background orbs
  orb1: {
    position: 'absolute',
    top: -100,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  orb2: {
    position: 'absolute',
    bottom: -120,
    right: -120,
    width: 450,
    height: 450,
    borderRadius: 225,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Expanding glow ring
  glowRing: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
  },
  glassContainer: {
    paddingVertical: spacing.massive,
    paddingHorizontal: spacing.huge,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border.regular,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  glassContainerBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glass.thin,
  },
  logoContainer: {
    width: 140,
    height: 140,
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  logo: {
    width: 120,
    height: 120,
    zIndex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  appName: {
    fontSize: 28,
    fontWeight: '200',
    color: colors.text.primary,
    letterSpacing: 8,
    marginBottom: spacing.sm,
  },
  titleDivider: {
    width: 50,
    height: 1,
    backgroundColor: colors.border.hairline,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.subtle,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  loadingIndicator: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.text.primary,
  },
  bottomBranding: {
    position: 'absolute',
    bottom: spacing.xxxl,
    alignItems: 'center',
  },
  version: {
    fontSize: 11,
    fontWeight: '300',
    color: colors.text.ghost,
    letterSpacing: 1,
  },
})
