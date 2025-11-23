/**
 * POSCheckout Component - Apple Engineering Standard
 * Jobs Principle: One focused responsibility - Checkout orchestration
 *
 * ZERO PROP DRILLING ✅
 * All state managed in stores, no prop drilling needed
 *
 * Architecture:
 * - POSCart: Displays cart items and totals (0 props) ✅
 * - POSCheckoutModals: Handles all modal interactions (0 props) ✅
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import { logger } from '@/utils/logger'

// POS Components
import { POSCart } from '../cart/POSCart'
import { POSCheckoutModals } from './POSCheckoutModals'

// Stores (ZERO PROP DRILLING)
import { usePOSSession } from '@/stores/posSession.store'

// ========================================
// ZERO PROP DRILLING COMPONENT ✅
// ========================================
export function POSCheckout() {
  // ========================================
  // STORES
  // ========================================
  const { sessionInfo, vendor, customUserId } = usePOSSession()

  // ========================================
  // RENDER
  // ========================================
  // Apple Principle: Fail fast with clear contract
  if (!sessionInfo || !vendor || !customUserId) {
    logger.warn('POSCheckout: Missing session data from store')
    return null
  }

  return (
    <View style={styles.container}>
      {/* All Modals - ZERO PROPS ✅ */}
      <POSCheckoutModals />

      {/* Cart Display - ZERO PROPS ✅ */}
      <POSCart />
    </View>
  )
}

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
