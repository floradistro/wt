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

import { useEffect, useRef, memo } from 'react'
import { View, StyleSheet, Animated, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { useAuth } from '@/stores/auth.store'
import { usePOSSession } from '@/stores/posSession.store'
import { startPaymentProcessorMonitoring, stopPaymentProcessorMonitoring } from '@/stores/payment-processor.store'
import { customerActions } from '@/stores/customer.store'
import { loyaltyActions, startLoyaltyRealtimeMonitoring, stopLoyaltyRealtimeMonitoring } from '@/stores/loyalty.store'
import { taxActions } from '@/stores/tax.store'
import { startLoyaltyCampaignsRealtimeMonitoring, stopLoyaltyCampaignsRealtimeMonitoring, useLoyaltyCampaignsStore } from '@/stores/loyalty-campaigns.store'
import { useDockOffset } from '@/navigation/DockOffsetContext'
import { layout } from '@/theme/layout'

// New Refactored Components
import {
  POSSessionSetup,
  POSProductBrowser,
  POSCheckout,
} from '@/components/pos'

// Error handling
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Design System
import { colors } from '@/theme'

/**
 * POSScreen Component (Refactored) - Apple Engineering Standard ✅
 * Jobs Principle: Simplified orchestrator - delegates to focused child components
 *
 * ZERO PROP DRILLING:
 * - Reads session from posSession.store
 * - Initializes customer/loyalty stores when session starts
 * - All child components read from stores
 */
function POSScreenComponent() {
  const { user } = useAuth()
  const { setFullWidth } = useDockOffset()

  // ========================================
  // READ FROM STORES (Apple Standard)
  // ========================================
  const { sessionInfo, vendor, customUserId } = usePOSSession()

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current

  // ========================================
  // EFFECTS - Initialize stores when session starts
  // ========================================
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  // Update dock centering based on session state
  useEffect(() => {
    // Setup mode = full width screen, main mode = has cart
    setFullWidth(!sessionInfo)
  }, [sessionInfo, setFullWidth])

  // Initialize customer and loyalty stores when session starts (Apple Standard)
  useEffect(() => {
    if (vendor?.id) {
      // Initialize customer, loyalty stores with vendorId (ZERO PROP DRILLING)
      customerActions.setVendorId(vendor.id)
      loyaltyActions.setVendorId(vendor.id)
      loyaltyActions.loadLoyaltyProgram(vendor.id)

      // Start loyalty realtime monitoring
      startLoyaltyRealtimeMonitoring(vendor.id)

      return () => {
        // Stop loyalty realtime monitoring on cleanup
        stopLoyaltyRealtimeMonitoring()
      }
    }
  }, [vendor?.id])

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

  // CRITICAL: Preload tax config when session starts
  // This prevents 15-30s freeze on first sale caused by 5x components
  // trying to calculate tax without loaded config
  useEffect(() => {
    if (sessionInfo?.locationId) {
      taxActions.loadTaxConfig(sessionInfo.locationId)
    }
  }, [sessionInfo?.locationId])

  // Load campaigns and start realtime monitoring
  useEffect(() => {
    if (user?.id && vendor?.id) {
      // Load campaigns
      useLoyaltyCampaignsStore.getState().loadCampaigns(user.id)

      // Start realtime monitoring for campaigns
      startLoyaltyCampaignsRealtimeMonitoring(user.id)

      return () => {
        // Stop campaigns realtime monitoring on cleanup
        stopLoyaltyCampaignsRealtimeMonitoring()
      }
    }
  }, [user?.id, vendor?.id])

  // ========================================
  // RENDER
  // ========================================

  // PHASE 1: Session setup (location/register/cash drawer)
  // Component reads/writes to posSession.store directly (Apple Standard ✅)
  // Show setup until session is COMPLETE (has sessionId)
  if (!sessionInfo || !sessionInfo.sessionId) {
    return <POSSessionSetup user={user} />
  }

  // PHASE 2: Main POS interface (products + checkout)
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Animated.View style={[styles.mainLayout, { opacity: fadeAnim }]}>
        {/*
          Left Column - Checkout (same container as NavSidebar)
          CRITICAL: ALWAYS RENDER - Never conditional!
          - Always visible (no vendor/customUserId check)
          - Wrapped in ErrorBoundary to catch crashes
          - Fallback to plain View if LiquidGlass fails
          - POSCheckout handles its own loading/empty states
        */}
        <View style={styles.leftColumn}>
          <ErrorBoundary
            fallback={(error, resetError) => (
              <View style={[styles.cartContainer, styles.cartContainerFallback]}>
                <View style={styles.cartErrorFallback}>
                  <Text style={styles.cartErrorIcon}>⚠️</Text>
                  <Text style={styles.cartErrorText}>Cart Error</Text>
                  <Text style={styles.cartErrorMessage}>{error.message}</Text>
                </View>
              </View>
            )}
          >
            {isLiquidGlassSupported ? (
              <LiquidGlassView
                effect="regular"
                colorScheme="dark"
                style={styles.cartContainer}
              >
                <POSCheckout />
              </LiquidGlassView>
            ) : (
              <View style={[styles.cartContainer, styles.cartContainerFallback]}>
                <POSCheckout />
              </View>
            )}
          </ErrorBoundary>
        </View>

        {/* Right Column - Products - ZERO PROPS ✅ */}
        <View style={styles.rightColumn}>
          <ErrorBoundary
            fallback={(error, resetError) => (
              <View style={styles.productsErrorFallback}>
                <Text style={styles.productsErrorIcon}>⚠️</Text>
                <Text style={styles.productsErrorText}>Products Error</Text>
                <Text style={styles.productsErrorMessage}>{error.message}</Text>
              </View>
            )}
          >
            <POSProductBrowser />
          </ErrorBoundary>
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
    width: layout.sidebarWidth, // ✅ Match nav sidebar exactly (320px - iPad Settings standard)
    backgroundColor: '#000',
  },
  // Apple 8px Design System - Cart container spacing
  cartContainer: {
    flex: 1,
    margin: layout.pos.cartMarginAll, // 8px all sides - perfect alignment
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
  // Cart error fallback (if POSCheckout crashes)
  cartErrorFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  cartErrorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cartErrorText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  cartErrorMessage: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,60,60,0.9)',
    letterSpacing: -0.1,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  // Products error fallback (if POSProductBrowser crashes)
  productsErrorFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    backgroundColor: '#000',
  },
  productsErrorIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  productsErrorText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  productsErrorMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,60,60,0.9)',
    letterSpacing: -0.1,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
})
