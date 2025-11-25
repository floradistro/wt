/**
 * POSSessionSetup Component (REFACTORED - Context Architecture)
 * Jobs Principle: One focused responsibility - Session initialization
 *
 * Uses:
 * - AppAuthContext: vendor, locations (environmental auth data)
 * - POSSessionContext: session management actions
 * - Zustand stores: transient UI state
 *
 * Handles:
 * - Location selection
 * - Register selection
 * - Cash drawer opening
 * - Session creation
 */

import { useState, memo } from 'react'
import { View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { POSLocationSelector } from '../POSLocationSelector'
import { POSRegisterSelector } from '../POSRegisterSelector'
import { OpenCashDrawerModal } from '../OpenCashDrawerModal'
import { useModalState } from '@/hooks/pos'
import { useAppAuth } from '@/contexts/AppAuthContext'
import { usePOSSession } from '@/contexts/POSSessionContext'
import { logger } from '@/utils/logger'

function POSSessionSetup() {
  // Context - Environmental data (no prop drilling!)
  const { vendor, locations } = useAppAuth()
  const { session, selectLocation, selectRegister, joinExistingSession, openCashDrawer } = usePOSSession()

  // Local UI state
  const [selectedRegister, setSelectedRegister] = useState<{ id: string; name: string } | null>(null)

  // Modals
  const { openModal, closeModal, isModalOpen } = useModalState()

  const handleLocationSelected = async (locationId: string, locationName: string) => {
    try {
      await selectLocation(locationId, locationName)
      openModal('registerSelector')
    } catch (error) {
      logger.error('[POSSessionSetup] Error selecting location:', error)
    }
  }

  const handleRegisterSelected = async (registerId: string) => {
    try {
      logger.debug('[POSSessionSetup] Register selected:', registerId)
      const { data: registerData } = await supabase
        .from('pos_registers')
        .select('register_name')
        .eq('id', registerId)
        .single()

      const registerName = registerData?.register_name || 'Register'
      logger.debug('[POSSessionSetup] Register name:', registerName)

      // Check if session already exists or needs cash drawer
      const result = await selectRegister(registerId, registerName)

      if (result && result.needsCashDrawer) {
        // Need to open cash drawer
        logger.debug('[POSSessionSetup] No active session - opening cash drawer modal')
        setSelectedRegister({ id: registerId, name: registerName })
        openModal('cashDrawerOpen')
      } else if (result && result.sessionId) {
        // Existing session found - join it
        logger.debug('[POSSessionSetup] Joining existing session:', result.sessionId)
        await joinExistingSession(result)
        closeModal()
      } else {
        // Unexpected state
        logger.error('[POSSessionSetup] Unexpected result from selectRegister:', result)
        closeModal()
      }
    } catch (error) {
      logger.error('[POSSessionSetup] Error handling register selection:', error)
    }
  }

  const handleBackToLocationSelector = () => {
    closeModal()
  }

  const handleCashDrawerSubmit = async (openingCash: number, notes: string) => {
    if (!selectedRegister) return

    try {
      await openCashDrawer(openingCash, notes)

      closeModal()
      setSelectedRegister(null)

      // Session is now ready - parent will detect via context
      logger.debug('[POSSessionSetup] Session opened successfully')
    } catch (error) {
      logger.error('[POSSessionSetup] Error in cash drawer submit:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleCashDrawerCancel = () => {
    closeModal()
    setSelectedRegister(null)
  }

  /**
   * RENDER STRATEGY - Prevent Modal Unmounting
   *
   * CRITICAL: Always render modals at the top level, regardless of conditional logic.
   * Modals should NEVER be inside conditional branches that could unmount them.
   *
   * WHY: If a modal is conditionally rendered and the condition changes while the modal
   * is open, React will unmount the modal component, causing it to disappear.
   *
   * PATTERN:
   * 1. Render modals at top level with visible={isModalOpen('modalName')}
   * 2. Use conditional rendering for screen content only
   * 3. Modal visibility is controlled by state, not by component mounting
   */

  // Render the appropriate screen content
  const renderScreen = () => {
    logger.debug('[POSSessionSetup] renderScreen:', {
      hasSession: !!session,
      locationsCount: locations.length,
      hasVendor: !!vendor
    })

    // Show location selector if no session
    if (!session?.locationId) {
      logger.debug('[POSSessionSetup] Rendering location selector')
      return (
        <POSLocationSelector
          locations={locations}
          onLocationSelected={handleLocationSelected}
          vendorName={vendor?.store_name || ''}
          vendorLogo={vendor?.logo_url}
        />
      )
    }

    // Show register selector if location selected
    if (session.locationId && isModalOpen('registerSelector')) {
      return (
        <POSRegisterSelector
          locationId={session.locationId}
          locationName={session.locationName}
          vendorLogo={vendor?.logo_url}
          onRegisterSelected={handleRegisterSelected}
          onBackToLocationSelector={handleBackToLocationSelector}
        />
      )
    }

    // Session is ready - return null (parent will handle rendering main POS)
    return null
  }

  return (
    <>
      {renderScreen()}

      {/* ALWAYS RENDER MODALS - Never conditionally mount/unmount */}
      <OpenCashDrawerModal
        visible={isModalOpen('cashDrawerOpen')}
        onSubmit={handleCashDrawerSubmit}
        onCancel={handleCashDrawerCancel}
      />
    </>
  )
}

const POSSessionSetupMemo = memo(POSSessionSetup)
export { POSSessionSetupMemo as POSSessionSetup }

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
