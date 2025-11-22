/**
 * POSSessionSetup Component
 * Jobs Principle: One focused responsibility - Session initialization
 * 
 * Handles:
 * - Location selection
 * - Register selection  
 * - Cash drawer opening
 * - Session creation
 */

import { useState, useEffect, memo } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase/client'
import { POSLocationSelector } from '../POSLocationSelector'
import { POSRegisterSelector } from '../POSRegisterSelector'
import { OpenCashDrawerModal } from '../OpenCashDrawerModal'
import { useModalState } from '@/hooks/pos'
import type { Vendor, Location, SessionInfo } from '@/types/pos'
import { logger } from '@/utils/logger'

interface POSSessionSetupProps {
  user: any
  onSessionReady: (sessionInfo: SessionInfo, vendor: Vendor, sessionData: SessionData, customUserId: string) => void
}

interface SessionData {
  sessionNumber: string
  totalSales: number
  totalCash: number
  openingCash: number
}

function POSSessionSetup({ user, onSessionReady }: POSSessionSetupProps) {
  // State
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [selectedRegister, setSelectedRegister] = useState<{ id: string; name: string } | null>(null)
  const [customUserId, setCustomUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals
  const { openModal, closeModal, isModalOpen, activeModal } = useModalState()

  // Load vendor and locations on mount
  useEffect(() => {
    loadVendorAndLocations()
  }, [])

  const loadVendorAndLocations = async () => {
    const startTime = Date.now()
    logger.debug('[POSSessionSetup] 🕐 Starting load...')

    try {
      setLoading(true)

      // User query
      const userStart = Date.now()
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id, vendors(id, store_name, logo_url)')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      const userTime = Date.now() - userStart
      logger.debug(`[POSSessionSetup] ⏱️ User query: ${userTime}ms`)
      logger.debug(`[POSSessionSetup] 🔍 User data:`, JSON.stringify(userData, null, 2))

      if (userError || !userData) {
        logger.error('[POSSessionSetup] ❌ User query failed:', userError)
        throw userError || new Error('User record not found')
      }

      // Extract vendor from join (might be object or array depending on relationship)
      const vendors = userData.vendors
      logger.debug(`[POSSessionSetup] 🔍 Vendors from join:`, JSON.stringify(vendors, null, 2))

      let vendorData: { id: string; store_name: string; logo_url?: string | null } | null = null

      if (vendors) {
        if (Array.isArray(vendors)) {
          vendorData = vendors.length > 0 ? vendors[0] : null
        } else {
          vendorData = vendors as { id: string; store_name: string; logo_url?: string | null }
        }
      }

      // Fallback: If vendor join failed, fetch separately using vendor_id
      if (!vendorData && userData.vendor_id) {
        logger.debug(`[POSSessionSetup] ⚠️ Vendor join failed, fetching separately for vendor_id: ${userData.vendor_id}`)
        const vendorStart = Date.now()
        const { data: vendorFallback, error: vendorError } = await supabase
          .from('vendors')
          .select('id, store_name, logo_url')
          .eq('id', userData.vendor_id)
          .single()

        const vendorTime = Date.now() - vendorStart
        logger.debug(`[POSSessionSetup] ⏱️ Vendor fallback query: ${vendorTime}ms`)

        if (!vendorError && vendorFallback) {
          vendorData = vendorFallback
          logger.debug('[POSSessionSetup] ✅ Vendor loaded via fallback')
        } else {
          logger.error('[POSSessionSetup] ❌ Vendor fallback failed:', vendorError)
        }
      }

      if (!vendorData) {
        logger.error('[POSSessionSetup] ❌ No vendor data found. User object:', userData)
        throw new Error('No vendor found for user')
      }

      logger.debug('[POSSessionSetup] ✅ Vendor loaded:', vendorData)

      // Set vendor with logo if available
      setVendor({
        id: vendorData.id,
        store_name: vendorData.store_name,
        logo_url: vendorData.logo_url ?? null,
      })
      setCustomUserId(userData.id)

      const isAdmin = ['vendor_owner', 'vendor_admin'].includes(userData.role)

      // Load locations immediately
      let locs: Location[] = []

      if (isAdmin) {
        const locStart = Date.now()
        const { data: allLocations, error: allLocationsError } = await supabase
          .from('locations')
          .select('id, name, address_line1, city, state, is_primary')
          .eq('vendor_id', userData.vendor_id)
          .eq('is_active', true)
          .eq('pos_enabled', true)
          .order('is_primary', { ascending: false })
          .order('name')
        logger.debug(`[POSSessionSetup] ✅ Locations query took ${Date.now() - locStart}ms`)

        if (allLocationsError) throw allLocationsError
        locs = allLocations || []
      } else {
        const locStart = Date.now()
        const { data: locationsData, error: locationsError } = await supabase
          .from('user_locations')
          .select(`
            location_id,
            locations!inner (
              id,
              name,
              address_line1,
              city,
              state,
              is_primary
            )
          `)
          .eq('user_id', userData.id)
        logger.debug(`[POSSessionSetup] ✅ User locations query took ${Date.now() - locStart}ms`)

        if (locationsError) throw locationsError

        locs = (locationsData || []).map((ul: any) => ul.locations).filter(Boolean)
      }

      setLocations(locs)
      setLoading(false)
      logger.debug(`[POSSessionSetup] 🎉 SCREEN READY - Total time: ${Date.now() - startTime}ms`)

      // Load logo asynchronously after locations are displayed
      const logoStart = Date.now()
      const { data: logoData } = await supabase
        .from('vendors')
        .select('logo_url')
        .eq('id', vendorData.id)
        .single()
      logger.debug(`[POSSessionSetup] 🖼️ Logo query took ${Date.now() - logoStart}ms`)

      if (logoData?.logo_url) {
        setVendor({ ...vendorData, logo_url: logoData.logo_url })
        logger.debug(`[POSSessionSetup] ✅ Logo loaded - Grand total: ${Date.now() - startTime}ms`)
      }
    } catch (error) {
      logger.error('Error loading vendor/locations:', error)
      setLoading(false)
      logger.debug(`[POSSessionSetup] ❌ Error after ${Date.now() - startTime}ms`)
    }
  }

  const handleLocationSelected = async (locationId: string, locationName: string) => {
    try {
      const { data: location } = await supabase
        .from('locations')
        .select('settings')
        .eq('id', locationId)
        .single()

      const taxConfig = location?.settings?.tax_config || {}
      const taxRate = taxConfig.sales_tax_rate || 0.08
      const taxName = taxConfig.tax_name || undefined

      setSessionInfo({
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
        taxRate,
        taxName,
      })
      openModal('registerSelector')
    } catch (error) {
      logger.error('Error loading location tax config:', error)
      setSessionInfo({
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
        taxRate: 0.08,
      })
      openModal('registerSelector')
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

      // CRITICAL FIX: Add 24-hour cutoff to prevent stale sessions from blocking cash drawer modal
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data: activeSession } = await supabase
        .from('pos_sessions')
        .select('id, session_number')
        .eq('register_id', registerId)
        .eq('status', 'open')
        .gte('opened_at', twentyFourHoursAgo.toISOString())  // ✅ Only sessions from last 24 hours
        .maybeSingle()  // Use maybeSingle() instead of single() to handle no results gracefully

      logger.debug('[POSSessionSetup] Active session:', activeSession)

      if (activeSession) {
        // Session already exists
        logger.debug('[POSSessionSetup] Using existing session')
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        
        const finalSessionInfo = {
          ...sessionInfo!,
          registerId,
          registerName,
          sessionId: activeSession.id,
        }

        const sessionData: SessionData = {
          sessionNumber: activeSession.session_number,
          totalSales: 0,
          totalCash: 0,
          openingCash: 0,
        }

        closeModal()
        logger.debug('[POSSessionSetup] Calling onSessionReady with:', { finalSessionInfo, vendor, sessionData, customUserId })
        onSessionReady(finalSessionInfo, vendor!, sessionData, customUserId!)
      } else {
        // Need to open cash drawer
        logger.debug('[POSSessionSetup] No active session - opening cash drawer modal')
        setSelectedRegister({ id: registerId, name: registerName })
        openModal('cashDrawerOpen')
        logger.debug('[POSSessionSetup] Modal opened - cashDrawerOpen')
      }
    } catch (error) {
      logger.error('[POSSessionSetup] Error handling register selection:', error)
    }
  }

  const handleBackToLocationSelector = () => {
    closeModal()
    setSessionInfo(null)
  }

  const handleCashDrawerSubmit = async (openingCash: number, _notes: string) => {
    if (!selectedRegister || !sessionInfo || !customUserId || !vendor) return

    try {
      const { data, error } = await supabase.rpc('get_or_create_session', {
        p_location_id: sessionInfo.locationId,
        p_opening_cash: openingCash,
        p_register_id: selectedRegister.id,
        p_user_id: customUserId,
        p_vendor_id: vendor.id,
      })

      if (error) throw error

      // Handle array response (Supabase RPC sometimes wraps in array)
      const sessionData = Array.isArray(data) ? data[0] : data

      if (!sessionData?.id) {
        throw new Error('Session created but no ID returned')
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      const finalSessionInfo: SessionInfo = {
        ...sessionInfo!,
        registerId: selectedRegister.id,
        registerName: selectedRegister.name,
        sessionId: sessionData.id,
      }

      const sessionDataForParent: SessionData = {
        sessionNumber: sessionData.session_number || 'Unknown',
        totalSales: 0,
        totalCash: 0,
        openingCash,
      }

      closeModal()
      setSelectedRegister(null)

      // Notify parent that session is ready
      onSessionReady(finalSessionInfo, vendor, sessionDataForParent, customUserId!)
    } catch (error) {
      logger.error('Error in cash drawer submit:', error)
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
    // Show location selector if no session info
    if (!sessionInfo && !loading) {
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
    if (sessionInfo && isModalOpen('registerSelector')) {
      return (
        <POSRegisterSelector
          locationId={sessionInfo.locationId}
          locationName={sessionInfo.locationName}
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
