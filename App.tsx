/**
 * App Component - Refactored with Design System
 * Apple-quality login experience matching POS design language
 */

import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import * as SplashScreen from 'expo-splash-screen'
import * as Haptics from 'expo-haptics'

// Initialize Sentry FIRST (before anything else)
import { initializeSentry, Sentry } from './src/utils/sentry'
import { validatePaymentEnvironment, checkForMockPaymentCode } from './src/utils/payment-validation'
import { useAuth, useAuthActions, useAuthStore } from './src/stores/auth.store'
import { supabase } from './src/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { DashboardNavigator } from './src/navigation/DashboardNavigator'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import { AnimatedSplashScreen } from './src/components/AnimatedSplashScreen'
import { Button, TextInput as DSTextInput } from './src/theme'
import { colors, typography, spacing, radius, animation } from './src/theme/tokens'
import { logger } from './src/utils/logger'

// Context Providers - Apple Engineering Standard
import { AppAuthProvider, POSSessionProvider } from './src/contexts'

initializeSentry()

// Validate payment environment on app startup
if (__DEV__) {
  try {
    validatePaymentEnvironment()
    checkForMockPaymentCode()
  } catch (error) {
    console.error('⚠️ Payment Environment Validation Failed:', error)
  }
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  // Auth state from store
  const { user, session, isLoading, error } = useAuth()
  const { login, restoreSession, clearError } = useAuthActions()

  // Animations - Apple spring physics
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const orb1 = useRef(new Animated.Value(0)).current
  const orb2 = useRef(new Animated.Value(0)).current

  // Set up auth state change listener to keep store in sync with auto-refreshed sessions
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      logger.debug('[App] Auth state changed:', { event })

      if (event === 'TOKEN_REFRESHED') {
        logger.info('[App] Session token auto-refreshed')
        useAuthStore.getState().setSession(session)
        useAuthStore.getState().setUser(session?.user ?? null)
      } else if (event === 'SIGNED_OUT') {
        useAuthStore.getState().setSession(null)
        useAuthStore.getState().setUser(null)
      } else if (event === 'SIGNED_IN') {
        useAuthStore.getState().setSession(session)
        useAuthStore.getState().setUser(session?.user ?? null)
      }
    })

    return () => {
      // Cleanup auth listener on unmount
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Restore session with smooth animated splash screen
    const restoreWithDelay = async () => {
      try {
        const startTime = Date.now()
        await restoreSession()
        const elapsed = Date.now() - startTime
        const minimumLoadTime = 2200 // Show animated splash for at least 2.2s

        if (elapsed < minimumLoadTime) {
          await new Promise(resolve => setTimeout(resolve, minimumLoadTime - elapsed))
        }

        // Don't set isRestoringSession false yet - AnimatedSplashScreen will handle it
        // Hide the native splash screen
        await SplashScreen.hideAsync()
      } catch (error) {
        logger.warn('Error during session restore', { error })
        setIsRestoringSession(false)
        await SplashScreen.hideAsync()
      }
    }

    restoreWithDelay()

    // Entrance animation with spring
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        ...animation.timing.easeOut,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        ...animation.spring.gentle,
      }),
    ]).start()

    // Breathing orbs - subtle background motion
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
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(orb2, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  useEffect(() => {
    if (error) {
      Alert.alert('Authentication Error', error, [
        { text: 'OK', onPress: clearError },
      ])
    }
  }, [error])

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter email and password')
      return
    }

    if (!email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      await login(email, password)
    } catch (_err) {
      // Error handled by store
    }
  }

  const orb1Scale = orb1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  })

  const orb2Scale = orb2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  })

  // Show animated splash screen while restoring session
  if (isRestoringSession) {
    return (
      <ErrorBoundary>
        <AnimatedSplashScreen
          onAnimationFinish={() => setIsRestoringSession(false)}
        />
      </ErrorBoundary>
    )
  }

  // If logged in, show dashboard
  if (user && session) {
    return (
      <ErrorBoundary>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        {/* Context Providers - Zero Prop Drilling Architecture */}
        <AppAuthProvider>
          <POSSessionProvider vendorId={user?.user_metadata?.vendor_id || null} authUserId={user?.id || null}>
            <DashboardNavigator />
          </POSSessionProvider>
        </AppAuthProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Animated background orbs - Jobs: Subtle depth */}
          <Animated.View style={[styles.orb1, { transform: [{ scale: orb1Scale }] }]} />
          <Animated.View style={[styles.orb2, { transform: [{ scale: orb2Scale }] }]} />

          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo - Matches POS location selector design */}
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <LiquidGlassView
                  effect="regular"
                  colorScheme="dark"
                  style={[StyleSheet.absoluteFill, !isLiquidGlassSupported && styles.logoCircleFallback]}
                />
                <Image
                  source={require('./assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Header - Using design system typography */}
            <View style={styles.header}>
              <Text style={styles.title}>WHALETOOLS</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitle}>VENDOR PORTAL</Text>
            </View>

            {/* Form - Using design system components */}
            <View style={styles.form}>
              <DSTextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                label="EMAIL ADDRESS"
                keyboardType="email-address"
                style={{ marginBottom: spacing.lg }}
              />

              <DSTextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                label="PASSWORD"
                secureTextEntry
                style={{ marginBottom: spacing.xxxl }}
              />

              {/* Login Button - Using design system Button */}
              <Button
                variant="primary"
                size="large"
                fullWidth
                onPress={handleLogin}
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'AUTHENTICATING...' : 'ACCESS PORTAL'}
              </Button>

              {/* Help Links */}
              <View style={styles.helpLinks}>
                <Text style={styles.helpText}>Need help signing in?</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Need an account? Contact us
              </Text>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  // Animated orbs - subtle background depth
  orb1: {
    position: 'absolute',
    top: 80,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.glass.ultraThin,
    opacity: 0.5,
  },
  orb2: {
    position: 'absolute',
    bottom: -50,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(255,255,255,0.015)',
    opacity: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.massive,
  },
  // Logo - matches slide-up selector style
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.massive,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.round,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.regular,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircleFallback: {
    backgroundColor: colors.glass.thin,
  },
  logo: {
    width: 50,
    height: 50,
  },
  // Header - design system typography
  header: {
    alignItems: 'center',
    marginBottom: spacing.huge,
  },
  title: {
    ...typography.title1,
    fontWeight: '200',
    letterSpacing: 8,
    marginBottom: spacing.sm,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: colors.border.hairline,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.uppercaseLabel,
    color: colors.text.subtle,
    letterSpacing: 4,
  },
  // Form
  form: {
    width: '100%',
  },
  helpLinks: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  helpText: {
    ...typography.caption1,
    color: colors.text.subtle,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.massive,
  },
  footerText: {
    ...typography.caption1,
    color: colors.text.ghost,
  },
})

// Wrap App with Sentry for error tracking
export default Sentry.wrap(App)
