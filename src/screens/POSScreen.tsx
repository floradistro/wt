/**
 * POSScreen - Context Architecture
 * Jobs Principle: Focus - Coordinates child components with zero prop drilling
 *
 * Architecture:
 * - AppAuthContext: vendor, locations (environmental auth data)
 * - POSSessionContext: session, register, apiConfig (session data)
 * - Zustand stores: transient UI state (cart, checkout, payment)
 *
 * Components:
 * - POSSessionSetup: Location/register selection, session init
 * - POSProductBrowser: Product display, search, filters
 * - POSCheckout: Cart, customer, payment processing
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { startPaymentProcessorMonitoring, stopPaymentProcessorMonitoring } from '@/stores/payment-processor.store'
import { useDockOffset } from '@/navigation/DockOffsetContext'
import { layout } from '@/theme/layout'

// Context - Zero prop drilling!
import { usePOSSession } from '@/contexts/POSSessionContext'

// New Refactored Components
import {
  POSSessionSetup,
  POSProductBrowser,
  POSCheckout,
} from '@/components/pos'

// Design System
import { colors } from '@/theme'

/**
 * POSScreen Component (Context Architecture)
 * Jobs Principle: Simplified orchestrator - zero prop drilling
 */
function POSScreenComponent() {
  const { setFullWidth } = useDockOffset()

  // Context - Session data (no prop drilling!)
  const { session } = usePOSSession()

  // ========================================
  // LOCAL STATE (Minimal!)
  // ========================================
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  // Update dock centering based on session state
  useEffect(() => {
    // Setup mode = full width screen, main mode = has cart
    setFullWidth(!session?.sessionId)
  }, [session?.sessionId, setFullWidth])

  // Payment processor monitoring
  useEffect(() => {
    if (session?.locationId && session?.registerId) {
      stopPaymentProcessorMonitoring()
      startPaymentProcessorMonitoring(session.locationId, session.registerId)
    }

    return () => {
      stopPaymentProcessorMonitoring()
    }
  }, [session?.locationId, session?.registerId])


  // ========================================
  // RENDER
  // ========================================

  // PHASE 1: Session setup (location/register/cash drawer)
  // CRITICAL: Only show main POS when session is FULLY ready (has sessionId)
  if (!session?.sessionId) {
    return <POSSessionSetup />
  }

  // PHASE 2: Main POS interface (products + checkout)
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.mainLayout, { opacity: fadeAnim }]}>
        {/* Left Column - Checkout (same container as NavSidebar) */}
        <View style={styles.leftColumn}>
          <LiquidGlassView
            effect="regular"
            colorScheme="dark"
            style={[styles.cartContainer, !isLiquidGlassSupported && styles.cartContainerFallback]}
          >
            <POSCheckout />
          </LiquidGlassView>
        </View>

        {/* Right Column - Products */}
        <View style={styles.rightColumn}>
          <POSProductBrowser />
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

// Export memoized version for performance
export const POSScreen = memo(POSScreenComponent)
POSScreen.displayName = 'POSScreen'

// ========================================
// STYLES - Minimal layout styles
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftColumn: {
    width: layout.sidebarWidth, // Match nav sidebar exactly (375px)
    backgroundColor: '#000',
  },
  cartContainer: {
    flex: 1,
    marginLeft: 8, // Ultra-minimal iOS-style padding
    marginRight: 8, // Match left - ultra-minimal
    marginTop: 8, // Match left - ultra-minimal
    marginBottom: 8, // Match left - ultra-minimal
    borderRadius: layout.containerRadius,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cartContainerFallback: {
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  rightColumn: {
    flex: 1,
    position: 'relative',
  },
})
