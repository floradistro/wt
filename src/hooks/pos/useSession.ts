/**
 * useSession Hook
 * Manages POS session state (location, register, user)
 * Jobs Principle: Encapsulate session complexity
 */

import { useState, useCallback } from 'react'
import type { SessionInfo, Vendor, Location } from '@/types/pos'
import { supabase } from '@/lib/supabase/client'
import * as Haptics from 'expo-haptics'
import { logger } from '@/utils/logger'

interface UseSessionReturn {
  sessionInfo: SessionInfo | null
  vendor: Vendor | null
  locations: Location[]
  customUserId: string | null
  sessionData: {
    sessionNumber: string
    totalSales: number
    totalCash: number
    openingCash: number
  } | null
  loading: boolean
  error: string | null
  loadVendorAndLocations: (authUserId: string) => Promise<void>
  selectLocation: (locationId: string, locationName: string) => Promise<void>
  selectRegister: (registerId: string, registerName: string) => Promise<{ needsCashDrawer: boolean; registerId?: string; registerName?: string } | void>
  openCashDrawer: (openingCash: number, notes: string) => Promise<void>
  closeCashDrawer: (closingCash: number, notes: string) => Promise<void>
  clearSession: () => void
}

export function useSession(): UseSessionReturn {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [customUserId, setCustomUserId] = useState<string | null>(null)
  const [sessionData, setSessionData] = useState<{
    sessionNumber: string
    totalSales: number
    totalCash: number
    openingCash: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load vendor and locations for the user
   */
  const loadVendorAndLocations = useCallback(async (authUserId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Get user's vendor by auth_user_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id, vendors(id, store_name, logo_url)')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      const vendorData = userData.vendors as any
      setVendor(vendorData)
      setCustomUserId(userData.id)

      // Check if user is admin
      const isAdmin = ['vendor_owner', 'vendor_admin'].includes(userData.role)

      let locs: Location[] = []

      if (isAdmin) {
        // Get all active, POS-enabled locations
        const { data: allLocations, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, address_line1, city, state, is_primary')
          .eq('vendor_id', userData.vendor_id)
          .eq('is_active', true)
          .eq('pos_enabled', true)
          .order('is_primary', { ascending: false })
          .order('name')

        if (locationsError) throw locationsError
        locs = allLocations || []
      } else {
        // Get user's assigned locations
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

        if (locationsError) throw locationsError

        locs = (locationsData || []).map((ul: any) => ul.locations).filter(Boolean)
      }

      setLocations(locs)
    } catch (err) {
      logger.error('Error loading vendor/locations:', err)
      setError(err instanceof Error ? err.message : 'Failed to load vendor/locations')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Select a location and load tax configuration
   */
  const selectLocation = useCallback(async (locationId: string, locationName: string) => {
    try {
      const { data: location } = await supabase
        .from('locations')
        .select('settings')
        .eq('id', locationId)
        .single()

      const taxConfig = location?.settings?.tax_config || {}
      const taxRate = taxConfig.sales_tax_rate || 0.08
      const taxName = taxConfig.tax_name

      setSessionInfo({
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
        taxRate,
        taxName,
      })
    } catch (err) {
      logger.error('Error loading location tax config:', err)
      // Fallback with default tax rate
      setSessionInfo({
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
        taxRate: 0.08,
      })
    }
  }, [])

  /**
   * Select a register and join/create session
   */
  const selectRegister = useCallback(
    async (registerId: string, registerName: string) => {
      try {
        // Check for active session
        const { data: activeSession } = await supabase
          .from('pos_sessions')
          .select('id, session_number')
          .eq('register_id', registerId)
          .eq('status', 'open')
          .single()

        if (activeSession) {
          // Join existing session
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          setSessionInfo((prev) => ({
            ...prev!,
            registerId,
            registerName,
            sessionId: activeSession.id,
          }))
          return { needsCashDrawer: false }
        }

        // No active session - needs cash drawer
        return { needsCashDrawer: true, registerId, registerName }
      } catch (err) {
        logger.error('Error selecting register:', err)
        throw err
      }
    },
    []
  )

  /**
   * Open cash drawer and create session
   */
  const openCashDrawer = useCallback(
    async (openingCash: number, _notes: string) => {
      if (!sessionInfo || !customUserId || !vendor) {
        throw new Error('Session info, user ID, or vendor missing')
      }

      try {
        // Call RPC function to create session
        const { data, error } = await supabase.rpc('get_or_create_session', {
          p_location_id: sessionInfo.locationId,
          p_opening_cash: openingCash,
          p_register_id: sessionInfo.registerId,
          p_user_id: customUserId,
          p_vendor_id: vendor.id,
        })

        if (error) throw error

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        setSessionInfo((prev) => ({
          ...prev!,
          sessionId: data.id,
        }))

        setSessionData({
          sessionNumber: data.session_number || 'Unknown',
          totalSales: 0,
          totalCash: 0,
          openingCash,
        })
      } catch (err) {
        logger.error('Error opening cash drawer:', err)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        throw err
      }
    },
    [sessionInfo, customUserId, vendor]
  )

  /**
   * Close cash drawer and end session
   */
  const closeCashDrawer = useCallback(
    async (closingCash: number, notes: string) => {
      if (!sessionInfo?.sessionId) {
        throw new Error('No active session')
      }

      try {
        // Close session via RPC
        const { data, error } = await supabase.rpc('close_pos_session', {
          p_session_id: sessionInfo.sessionId,
          p_closing_cash: closingCash,
          p_closing_notes: notes || null,
        })

        if (error) throw error
        if (!data.success) {
          throw new Error(data.error || 'Failed to close session')
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Clear session
        clearSession()
      } catch (err) {
        logger.error('Error closing cash drawer:', err)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        throw err
      }
    },
    [sessionInfo]
  )

  /**
   * Clear session state
   */
  const clearSession = useCallback(() => {
    setSessionInfo(null)
    setSessionData(null)
  }, [])

  return {
    sessionInfo,
    vendor,
    locations,
    customUserId,
    sessionData,
    loading,
    error,
    loadVendorAndLocations,
    selectLocation,
    selectRegister,
    openCashDrawer,
    closeCashDrawer,
    clearSession,
  }
}
