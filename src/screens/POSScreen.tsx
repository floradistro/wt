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

import { useState, useEffect, useRef, useCallback } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { startPaymentProcessorMonitoring, stopPaymentProcessorMonitoring } from '@/stores/payment-processor.store'
import { useDockOffset } from '@/navigation/DockOffsetContext'
import { layout } from '@/theme/layout'
import { useRealtimeInventory } from '@/hooks/useRealtimeInventory'
import { useRealtimePricing } from '@/hooks/useRealtimePricing'

// Context - Zero prop drilling!
import { usePOSSession } from '@/contexts/POSSessionContext'
import { useAppAuth } from '@/contexts/AppAuthContext'

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
 *
 * NOTE: NOT memoized to ensure proper re-rendering after navigation/hot reload
 */
export function POSScreen({ isActive = true }: { isActive?: boolean }) {
  const { setFullWidth } = useDockOffset()

  // Context - Session data (no prop drilling!)
  const { session } = usePOSSession()
  const { vendor } = useAppAuth()

  // ✅ REAL-TIME INVENTORY: Subscribe to inventory updates for current POS location
  // Critical for POS: When a sale completes, all product cards update instantly
  useRealtimeInventory(session?.locationId)

  // ✅ REAL-TIME PRICING: Subscribe to pricing template updates for vendor
  // Critical for POS: When pricing changes, all product cards update instantly
  useRealtimePricing(vendor?.id)

  // ========================================
  // LOCAL STATE (Minimal!)
  // ========================================
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Force refresh counter - increments when screen becomes visible to force LiquidGlassView re-render
  const [refreshKey, setRefreshKey] = useState(0)
  const wasActiveRef = useRef(isActive)

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    // Reset animation on mount to ensure clean state after hot reload
    fadeAnim.setValue(0)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  // CRITICAL: Force refresh when screen becomes visible again
  // This ensures LiquidGlassView components re-initialize properly after navigation
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      // Screen just became active - force complete refresh of LiquidGlassView components
      setRefreshKey(prev => prev + 1)
    }
    wasActiveRef.current = isActive
  }, [isActive])

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
          <View style={styles.cartContainer}>
            <POSCheckout key={`pos-checkout-${session?.sessionId}-${refreshKey}`} />
          </View>
        </View>

        {/* Right Column - Products */}
        <View style={styles.rightColumn}>
          <POSProductBrowser key={`pos-products-${session?.sessionId}-${refreshKey}`} />
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

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
    backgroundColor: 'rgba(255,255,255,0.05)', // Match product list - borderless
  },
  rightColumn: {
    flex: 1,
    position: 'relative',
  },
})
