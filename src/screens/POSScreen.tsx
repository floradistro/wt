/**
 * POSScreen - Refactored Orchestrator
 * Jobs Principle: Focus - Coordinates child components, holds minimal state
 *
 * THIS FILE: Clean orchestrator (~250 lines)
 * ORIGINAL: 1,200-line monolith
 *
 * Architecture:
 * - POSSessionSetup: Location/register selection, session init
 * - POSProductBrowser: Product display, search, filters
 * - POSCheckout: Cart, customer, payment processing
 * - POSSessionActions: End session, close drawer
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useAuth } from '@/stores/auth.store'
import { startPaymentProcessorMonitoring, stopPaymentProcessorMonitoring } from '@/stores/payment-processor.store'
import { useDockOffset } from '@/navigation/DashboardNavigator'
import { layout } from '@/theme/layout'

// New Refactored Components
import {
  POSSessionSetup,
  POSProductBrowser,
  POSCheckout,
} from '@/components/pos'

// Hooks - Need useCart at top level to share between components
import { useCart } from '@/hooks/pos'

// Design System
import { colors } from '@/theme'

// Types
import type { Vendor, Product, SessionInfo, PricingTier } from '@/types/pos'

/**
 * POSScreen Component (Refactored)
 * Jobs Principle: Simplified orchestrator - delegates to focused child components
 */
function POSScreenComponent() {
  const { user } = useAuth()
  const { setFullWidth } = useDockOffset()

  // ========================================
  // TOP-LEVEL STATE (Minimal!)
  // ========================================
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [customUserId, setCustomUserId] = useState<string | null>(null)
  const [_sessionData, _setSessionData] = useState<{
    sessionNumber: string
    totalSales: number
    totalCash: number
    openingCash: number
  } | null>(null)

  // Products state - needed by both POSProductBrowser and POSCheckout
  const [products, setProducts] = useState<Product[]>([])

  // Cart state - lifted to parent to share between POSProductBrowser and POSCheckout
  // This is the SINGLE source of truth for cart data
  const cartHook = useCart()

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
    setFullWidth(!sessionInfo)
  }, [sessionInfo, setFullWidth])

  // Payment processor monitoring
  useEffect(() => {
    if (sessionInfo?.locationId && sessionInfo?.registerId) {
      stopPaymentProcessorMonitoring()
      startPaymentProcessorMonitoring(sessionInfo.locationId, sessionInfo.registerId)
    }

    return () => {
      stopPaymentProcessorMonitoring()
    }
  }, [sessionInfo?.locationId, sessionInfo?.registerId])

  // ========================================
  // HANDLERS (Cross-component communication)
  // ========================================
  const handleSessionReady = useCallback((
    newSessionInfo: SessionInfo,
    newVendor: Vendor,
    newSessionData: { sessionNumber: string; totalSales: number; totalCash: number; openingCash: number },
    newCustomUserId: string
  ) => {
    setSessionInfo(newSessionInfo)
    setVendor(newVendor)
    _setSessionData(newSessionData)
    setCustomUserId(newCustomUserId)
  }, [])

  const handleSessionEnd = useCallback(() => {
    setSessionInfo(null)
    setVendor(null)
    _setSessionData(null)
    setCustomUserId(null)
    setProducts([])
  }, [])

  const handleProductsLoaded = useCallback((loadedProducts: Product[]) => {
    setProducts(loadedProducts)
  }, [])

  const handleAddToCart = useCallback((product: Product, tier?: PricingTier) => {
    // Call the shared cart hook's addToCart function
    cartHook.addToCart(product, tier)
  }, [cartHook.addToCart])

  // ========================================
  // RENDER
  // ========================================

  // PHASE 1: Session setup (location/register selection)
  if (!sessionInfo) {
    return (
      <POSSessionSetup
        user={user}
        onSessionReady={handleSessionReady}
      />
    )
  }

  // PHASE 2: Main POS interface (products + checkout)
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.mainLayout, { opacity: fadeAnim }]}>
        {/* Left Column - Checkout (same container as NavSidebar) */}
        <View style={styles.leftColumn}>
          {vendor && customUserId && (
            <LiquidGlassView
              effect="regular"
              colorScheme="dark"
              style={[styles.cartContainer, !isLiquidGlassSupported && styles.cartContainerFallback]}
            >
              <POSCheckout
                sessionInfo={sessionInfo}
                vendor={vendor}
                products={products}
                customUserId={customUserId}
                cartHook={cartHook}
                onEndSession={handleSessionEnd}
                onCheckoutComplete={() => {
                  // Optional: Reload products after checkout
                }}
              />
            </LiquidGlassView>
          )}
        </View>

        {/* Right Column - Products */}
        <View style={styles.rightColumn}>
          <POSProductBrowser
            sessionInfo={sessionInfo}
            onAddToCart={handleAddToCart}
            onProductsLoaded={handleProductsLoaded}
          />
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
