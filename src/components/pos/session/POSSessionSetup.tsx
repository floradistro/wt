/**
 * POSSessionSetup Component - Apple Engineering Standard ✅
 * Jobs Principle: One focused responsibility - Session initialization
 *
 * ZERO PROPS (except user for auth):
 * - Reads/writes directly to posSession.store
 * - Uses checkoutUIActions for modal state
 * - No callbacks needed
 *
 * Handles:
 * - Location selection
 * - Register selection
 * - Cash drawer opening
 * - Session creation
 */

import { useState, useEffect, memo } from 'react'
import { View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { POSLocationSelector } from '../POSLocationSelector'
import { POSRegisterSelector } from '../POSRegisterSelector'
import { OpenCashDrawerModal } from '../OpenCashDrawerModal'
import { checkoutUIActions, useActiveModal, useCheckoutUIStore } from '@/stores/checkout-ui.store'
import { usePOSSession, usePOSLocations, usePOSSessionStore } from '@/stores/posSession.store'
import type { Vendor, Location } from '@/types/pos'
import { logger } from '@/utils/logger'

interface POSSessionSetupProps {
  user: any
}

function POSSessionSetup({ user }: POSSessionSetupProps) {
  // ========================================
  // STORES - Apple Engineering Standard (ZERO PROP DRILLING)
  // ========================================
  const { sessionInfo, vendor, locations, loading } = usePOSSession()
  const activeModal = useActiveModal()
  const storeLocations = usePOSLocations()

  // ========================================
  // LOCAL STATE (UI only - register selection)
  // ========================================
  const [selectedRegister, setSelectedRegister] = useState<{ id: string; name: string } | null>(null)

  // ========================================
  // EFFECTS - Load vendor and locations from store
  // ========================================

  useEffect(() => {
    if (user?.id) {
      // Call store action directly (Apple Standard - no local state needed!)
      usePOSSessionStore.getState().loadVendorAndLocations(user.id)
    }
  }, [user?.id])

  // ========================================
  // HANDLERS - Use store actions (Apple Standard)
  // ========================================
  const handleLocationSelected = async (locationId: string, locationName: string) => {
    logger.debug('🎯 [POSSessionSetup] handleLocationSelected CALLED', { locationId, locationName })

    // Call store action to select location (updates sessionInfo in store)
    await usePOSSessionStore.getState().selectLocation(locationId, locationName)
    logger.debug('✅ [POSSessionSetup] selectLocation completed')

    // Open register selector modal
    logger.debug('🎯 [POSSessionSetup] Opening register selector modal')
    checkoutUIActions.openModal('registerSelector')
  }

  const handleRegisterSelected = async (registerId: string) => {
    try {
      logger.debug('[POSSessionSetup] Register selected:', registerId)

      // Get register name
      const { data: registerData } = await supabase
        .from('pos_registers')
        .select('register_name')
        .eq('id', registerId)
        .single()

      const registerName = registerData?.register_name || 'Register'
      logger.debug('[POSSessionSetup] Register name:', registerName)

      // Call store action to select register (checks for active session)
      const result = await usePOSSessionStore.getState().selectRegister(registerId, registerName)

      if (result && result.needsCashDrawer) {
        // No active session - open cash drawer modal
        logger.debug('[POSSessionSetup] No active session - opening cash drawer modal')
        setSelectedRegister({ id: registerId, name: registerName })
        checkoutUIActions.openModal('cashDrawerOpen')
      } else {
        // Session joined - close modal (sessionInfo updated in store)
        logger.debug('[POSSessionSetup] Session joined')
        checkoutUIActions.closeModal()
      }
    } catch (error) {
      logger.error('[POSSessionSetup] Error handling register selection:', error)
    }
  }

  const handleBackToLocationSelector = () => {
    checkoutUIActions.closeModal()
    // Clear session info from store
    usePOSSessionStore.setState({ sessionInfo: null })
  }

  const handleCashDrawerSubmit = async (openingCash: number, notes: string) => {
    try {
      // Call store action to open cash drawer and create session
      await usePOSSessionStore.getState().openCashDrawer(openingCash, notes)

      // Close modal and clear local state
      checkoutUIActions.closeModal()
      setSelectedRegister(null)

      // Session is now ready - sessionInfo updated in store!
      logger.debug('[POSSessionSetup] Session created successfully')
    } catch (error) {
      logger.error('Error in cash drawer submit:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCashDrawerCancel = () => {
    checkoutUIActions.closeModal()
    setSelectedRegister(null)
  }

  // ========================================
  // RENDER
  // ========================================

  // Helper: Check if modal is open (reactive)
  const isModalOpen = (id: string) => activeModal === id

  // Show location selector if no session info
  if (!sessionInfo && !loading) {
    return (
      <POSLocationSelector
        onLocationSelected={handleLocationSelected}
      />
    )
  }

  // Show register selector if location selected
  if (sessionInfo && isModalOpen('registerSelector')) {
    return (
      <>
        <POSRegisterSelector
          onRegisterSelected={handleRegisterSelected}
          onBackToLocationSelector={handleBackToLocationSelector}
        />

        {/* ALWAYS RENDER MODALS - Never conditionally mount/unmount */}
        <OpenCashDrawerModal
          visible={isModalOpen('cashDrawerOpen')}
          onSubmit={handleCashDrawerSubmit}
          onCancel={handleCashDrawerCancel}
        />
      </>
    )
  }

  // Session is ready - return null (POSScreen will show main interface)
  return null
}

const POSSessionSetupMemo = memo(POSSessionSetup)
export { POSSessionSetupMemo as POSSessionSetup }

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
