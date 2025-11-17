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

import { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/stores/auth.store'
import { startPaymentProcessorMonitoring, stopPaymentProcessorMonitoring } from '@/stores/payment-processor.store'

// New Refactored Components
import {
  POSSessionSetup,
  POSSessionActions,
  POSProductBrowser,
  POSCheckout,
} from '@/components/pos'

// Hooks - Need useCart at top level to share between components
import { useCart } from '@/hooks/pos'

// Design System
import { colors, spacing, device } from '@/theme'

// Types
import type { Vendor, Product, SessionInfo, PricingTier } from '@/types/pos'

const isTablet = device.isTablet

/**
 * POSScreen Component (Refactored)
 * Jobs Principle: Simplified orchestrator - delegates to focused child components
 */
export function POSScreen() {
  const { user } = useAuth()

  // ========================================
  // TOP-LEVEL STATE (Minimal!)
  // ========================================
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [customUserId, setCustomUserId] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<{
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
  const handleSessionReady = (
    newSessionInfo: SessionInfo,
    newVendor: Vendor,
    newSessionData: { sessionNumber: string; totalSales: number; totalCash: number; openingCash: number },
    newCustomUserId: string
  ) => {
    setSessionInfo(newSessionInfo)
    setVendor(newVendor)
    setSessionData(newSessionData)
    setCustomUserId(newCustomUserId)
  }

  const handleSessionEnd = () => {
    setSessionInfo(null)
    setVendor(null)
    setSessionData(null)
    setCustomUserId(null)
    setProducts([])
  }

  const handleProductsLoaded = (loadedProducts: Product[]) => {
    setProducts(loadedProducts)
  }

  const handleAddToCart = (product: Product, tier?: PricingTier) => {
    // Call the shared cart hook's addToCart function
    cartHook.addToCart(product, tier)
  }

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
        {/* Left Column - Products */}
        <View style={styles.leftColumn}>
          <POSProductBrowser
            sessionInfo={sessionInfo}
            onAddToCart={handleAddToCart}
            onProductsLoaded={handleProductsLoaded}
          />
        </View>

        {/* Right Column - Checkout */}
        <View style={styles.rightColumn}>
          {vendor && customUserId && (
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
          )}
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
    gap: spacing.md,
  },
  leftColumn: {
    flex: 1,
    position: 'relative',
  },
  rightColumn: {
    width: isTablet ? 380 : 320,
  },
})
