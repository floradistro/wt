import { View, StyleSheet, Animated, Image, Dimensions } from 'react-native'
import { useEffect, useRef } from 'react'
import { colors } from '@/theme/tokens'

const { width, height } = Dimensions.get('window')

interface AnimatedSplashScreenProps {
  onAnimationFinish?: () => void
}

export function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.5)).current
  const floatAnim = useRef(new Animated.Value(0)).current
  const waterSplashAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  // Ripple/water animations (simulating whale surfacing)
  const ripple1 = useRef(new Animated.Value(0)).current
  const ripple2 = useRef(new Animated.Value(0)).current
  const ripple3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Main entrance animation sequence - whale surfacing effect
    Animated.sequence([
      // Fade in background
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Whale emerges from water with spring bounce
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        // Water splash effect
        Animated.timing(waterSplashAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Animation finished - transition to app
      setTimeout(() => {
        onAnimationFinish?.()
      }, 600)
    })

    // Gentle floating animation (like whale bobbing in water)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Subtle glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.2,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Water ripple effects (staggered for natural look)
    const startRipples = () => {
      Animated.loop(
        Animated.stagger(500, [
          Animated.sequence([
            Animated.timing(ripple1, {
              toValue: 1,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(ripple1, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(ripple2, {
              toValue: 1,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(ripple2, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(ripple3, {
              toValue: 1,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(ripple3, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start()
    }

    setTimeout(startRipples, 600)
  }, [])

  // Interpolations
  const floatTranslate = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  })

  const waterSplashOpacity = waterSplashAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 0],
  })

  const waterSplashScale = waterSplashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.5],
  })

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  })

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.1],
  })

  const getRippleStyle = (ripple: Animated.Value) => {
    const scale = ripple.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2.8],
    })

    const opacity = ripple.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.5, 0.25, 0],
    })

    return {
      transform: [{ scale }],
      opacity,
    }
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Ocean-like gradient background */}
      <View style={styles.oceanBackground}>
        <View style={[styles.oceanGradient, styles.oceanTop]} />
        <View style={[styles.oceanGradient, styles.oceanBottom]} />
      </View>

      {/* Center whale with water effects */}
      <View style={styles.centerContent}>
        {/* Water ripples (expanding circles) */}
        <Animated.View style={[styles.waterRipple, getRippleStyle(ripple1)]} />
        <Animated.View style={[styles.waterRipple, getRippleStyle(ripple2)]} />
        <Animated.View style={[styles.waterRipple, getRippleStyle(ripple3)]} />

        {/* Soft glow behind whale */}
        <Animated.View
          style={[
            styles.whaleGlow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Water splash particles on entry */}
        <Animated.View
          style={[
            styles.waterSplash,
            {
              opacity: waterSplashOpacity,
              transform: [{ scale: waterSplashScale }],
            },
          ]}
        >
          {[...Array(12)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.splashDrop,
                {
                  transform: [
                    { rotate: `${i * 30}deg` },
                    { translateY: -80 },
                  ],
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* Whale logo with floating animation */}
        <Animated.View
          style={[
            styles.whaleContainer,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: floatTranslate },
              ],
            },
          ]}
        >
          <Image
            source={require('../../assets/whale.png')}
            style={styles.whaleLogo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
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
  oceanBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  oceanGradient: {
    position: 'absolute',
    width: width * 2,
    height: height * 0.6,
    borderRadius: width,
  },
  oceanTop: {
    top: -height * 0.3,
    left: -width * 0.5,
    backgroundColor: 'rgba(30, 144, 255, 0.03)', // Subtle ocean blue
  },
  oceanBottom: {
    bottom: -height * 0.3,
    right: -width * 0.5,
    backgroundColor: 'rgba(0, 191, 255, 0.02)', // Lighter ocean blue
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 350,
    height: 350,
  },
  waterRipple: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'transparent',
  },
  whaleGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 50,
  },
  waterSplash: {
    position: 'absolute',
    width: 300,
    height: 300,
  },
  splashDrop: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(135, 206, 250, 0.7)', // Light blue water droplets
    top: '50%',
    left: '50%',
    marginTop: -3,
    marginLeft: -3,
  },
  whaleContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  whaleLogo: {
    width: 180,
    height: 180,
  },
})
