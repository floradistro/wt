/**
 * POSSessionContext - POS Session Environmental Data
 *
 * Apple Principle: Context for rarely-changing environmental data
 *
 * Provides:
 * - session: Current POS session (location, register, sessionId)
 * - apiConfig: Tax rates, session number, etc.
 * - Actions: selectLocation, selectRegister, openCashDrawer, closeCashDrawer
 *
 * Usage:
 * const { session, apiConfig, selectLocation } = usePOSSession()
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import * as Haptics from 'expo-haptics'
import type { Location } from '@/types/pos'
import { useLoyaltyCampaignsStore, startLoyaltyCampaignsRealtimeMonitoring, stopLoyaltyCampaignsRealtimeMonitoring } from '@/stores/loyalty-campaigns.store'
import { useAppAuth } from './AppAuthContext'

// ========================================
// TYPES
// ========================================

export interface POSSession {
  locationId: string
  locationName: string
  registerId: string
  registerName: string
  sessionId: string
}

export interface POSApiConfig {
  taxRate: number
  taxName?: string
  sessionNumber?: string
  openingCash?: number
  totalSales?: number
  totalCash?: number
}

interface SelectRegisterResult {
  needsCashDrawer: boolean
  registerId?: string
  registerName?: string
  sessionId?: string
  sessionNumber?: string
  openingCash?: number
  totalSales?: number
  totalCash?: number
}

interface POSSessionContextValue {
  // State
  session: POSSession | null
  apiConfig: POSApiConfig | null
  customUserId: string | null
  loading: boolean
  error: string | null

  // Actions
  selectLocation: (locationId: string, locationName: string) => Promise<void>
  selectRegister: (registerId: string, registerName: string) => Promise<SelectRegisterResult | void>
  joinExistingSession: (sessionData: SelectRegisterResult) => Promise<void>
  openCashDrawer: (openingCash: number, notes: string) => Promise<void>
  closeCashDrawer: (closingCash: number, notes: string) => Promise<void>
  clearSession: () => void

  // Persistence
  loadPersistedSession: () => Promise<void>
}

// ========================================
// CONTEXT
// ========================================
const POSSessionContext = createContext<POSSessionContextValue | undefined>(undefined)

// ========================================
// STORAGE KEYS
// ========================================
const STORAGE_KEY_SESSION = '@pos_session'
const STORAGE_KEY_API_CONFIG = '@pos_api_config'
const STORAGE_KEY_USER_ID = '@pos_custom_user_id'

// ========================================
// PROVIDER
// ========================================
interface POSSessionProviderProps {
  children: ReactNode
  authUserId: string | null // From auth.store
}

export function POSSessionProvider({ children, authUserId }: POSSessionProviderProps) {
  // Get vendorId from AppAuthContext (nested inside AppAuthProvider)
  const { vendor } = useAppAuth()
  const vendorId = vendor?.id || null

  // Log when vendorId changes
  useEffect(() => {
    logger.info('[POSSessionContext] vendorId updated from AppAuthContext:', {
      hasVendor: !!vendor,
      vendorId,
      storeName: vendor?.store_name,
    })
  }, [vendorId, vendor])

  const [session, setSession] = useState<POSSession | null>(null)
  const [apiConfig, setApiConfig] = useState<POSApiConfig | null>(null)
  const [customUserId, setCustomUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load custom user ID and campaigns when auth user changes
   */
  useEffect(() => {
    async function loadCustomUserId() {
      if (!authUserId) {
        setCustomUserId(null)
        return
      }

      try {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', authUserId)
          .maybeSingle()

        if (userData?.id) {
          setCustomUserId(userData.id)
          await AsyncStorage.setItem(STORAGE_KEY_USER_ID, userData.id)
        }

        // Load campaigns for POS
        const { loadCampaigns, loadProgram } = useLoyaltyCampaignsStore.getState()
        await Promise.all([
          loadCampaigns(authUserId),
          loadProgram(authUserId)
        ])

        // Start realtime monitoring
        startLoyaltyCampaignsRealtimeMonitoring(authUserId)
      } catch (err) {
        logger.error('[POSSessionContext] Failed to load custom user ID or campaigns:', err)
      }
    }

    loadCustomUserId()

    // Cleanup realtime monitoring on unmount
    return () => {
      stopLoyaltyCampaignsRealtimeMonitoring()
    }
  }, [authUserId])

  /**
   * Load persisted session from AsyncStorage
   */
  const loadPersistedSession = useCallback(async () => {
    try {
      setLoading(true)

      const [sessionJson, apiConfigJson, userIdJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_SESSION),
        AsyncStorage.getItem(STORAGE_KEY_API_CONFIG),
        AsyncStorage.getItem(STORAGE_KEY_USER_ID),
      ])

      if (sessionJson) {
        const persistedSession = JSON.parse(sessionJson) as POSSession

        // Validate session is still active
        if (persistedSession.sessionId) {
          const { data: sessionData } = await supabase
            .from('pos_sessions')
            .select('status')
            .eq('id', persistedSession.sessionId)
            .single()

          if (sessionData?.status === 'open') {
            setSession(persistedSession)
            logger.info('[POSSessionContext] Restored active session:', persistedSession.sessionId)
          } else {
            // Session closed - clear it
            logger.info('[POSSessionContext] Session no longer active, clearing')
            await AsyncStorage.multiRemove([STORAGE_KEY_SESSION, STORAGE_KEY_API_CONFIG])
          }
        }
      }

      if (apiConfigJson) {
        setApiConfig(JSON.parse(apiConfigJson))
      }

      if (userIdJson) {
        setCustomUserId(userIdJson)
      }
    } catch (err) {
      logger.error('[POSSessionContext] Failed to load persisted session:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Select a location and load tax configuration
   */
  const selectLocation = useCallback(async (locationId: string, locationName: string) => {
    try {
      setError(null)

      const { data: location } = await supabase
        .from('locations')
        .select('settings')
        .eq('id', locationId)
        .single()

      const taxConfig = location?.settings?.tax_config || {}
      const taxRate = taxConfig.sales_tax_rate || 0.08
      const taxName = taxConfig.tax_name

      const newSession: POSSession = {
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
      }

      const newApiConfig: POSApiConfig = {
        taxRate,
        taxName,
      }

      setSession(newSession)
      setApiConfig(newApiConfig)

      logger.info('[POSSessionContext] Location selected:', { locationId, locationName, taxRate })
    } catch (err) {
      logger.error('[POSSessionContext] Error selecting location:', err)
      setError(err instanceof Error ? err.message : 'Failed to select location')

      // Fallback with default tax rate
      const newSession: POSSession = {
        locationId,
        locationName,
        registerId: '',
        registerName: '',
        sessionId: '',
      }

      const newApiConfig: POSApiConfig = {
        taxRate: 0.08,
      }

      setSession(newSession)
      setApiConfig(newApiConfig)
    }
  }, [])

  /**
   * Select a register and join/create session
   */
  const selectRegister = useCallback(
    async (registerId: string, registerName: string) => {
      try {
        setError(null)

        // Check for active session
        const { data: activeSession } = await supabase
          .from('pos_sessions')
          .select('id, session_number, opening_cash, total_sales, total_cash')
          .eq('register_id', registerId)
          .eq('status', 'open')
          .single()

        if (activeSession) {
          // Join existing session
          // Update session with register info FIRST
          const updatedSession: POSSession = {
            ...session!,
            registerId,
            registerName,
            sessionId: '', // Will be set by joinExistingSession
          }

          setSession(updatedSession)

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

          logger.info('[POSSessionContext] Found existing session:', activeSession.id)

          return {
            needsCashDrawer: false,
            registerId,
            registerName,
            sessionId: activeSession.id,
            sessionNumber: activeSession.session_number,
            openingCash: activeSession.opening_cash,
            totalSales: activeSession.total_sales || 0,
            totalCash: activeSession.total_cash || 0,
          }
        }

        // No active session - needs cash drawer
        // CRITICAL: Update session with registerId BEFORE opening cash drawer
        const updatedSession: POSSession = {
          ...session!,
          registerId,
          registerName,
          sessionId: '', // Will be set after cash drawer opens
        }

        setSession(updatedSession)

        logger.info('[POSSessionContext] No active session, needs cash drawer. Register set:', { registerId, registerName })
        return { needsCashDrawer: true, registerId, registerName }
      } catch (err) {
        logger.error('[POSSessionContext] Error selecting register:', err)
        setError(err instanceof Error ? err.message : 'Failed to select register')
        throw err
      }
    },
    [session, apiConfig]
  )

  /**
   * Join an existing session (called by POSSessionSetup after user confirms)
   */
  const joinExistingSession = useCallback(
    async (sessionData: SelectRegisterResult) => {
      if (!session || !sessionData.sessionId) {
        throw new Error('Invalid session data')
      }

      try {
        // Ensure registerId and registerName are set (should be from selectRegister)
        if (!session.registerId || !session.registerName) {
          logger.warn('[POSSessionContext] Missing register info when joining session')
        }

        const updatedSession: POSSession = {
          ...session,
          sessionId: sessionData.sessionId,
        }

        const updatedApiConfig: POSApiConfig = {
          ...apiConfig!,
          sessionNumber: sessionData.sessionNumber,
          openingCash: sessionData.openingCash,
          totalSales: sessionData.totalSales || 0,
          totalCash: sessionData.totalCash || 0,
        }

        setSession(updatedSession)
        setApiConfig(updatedApiConfig)

        // Persist to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(updatedSession))
        await AsyncStorage.setItem(STORAGE_KEY_API_CONFIG, JSON.stringify(updatedApiConfig))

        logger.info('[POSSessionContext] ✅ JOINED EXISTING SESSION - Full state:', {
          sessionId: sessionData.sessionId,
          registerId: updatedSession.registerId,
          registerName: updatedSession.registerName,
          locationId: updatedSession.locationId,
          locationName: updatedSession.locationName,
          sessionNumber: updatedApiConfig.sessionNumber,
          openingCash: updatedApiConfig.openingCash,
        })
      } catch (err) {
        logger.error('[POSSessionContext] Error joining session:', err)
        throw err
      }
    },
    [session, apiConfig]
  )

  /**
   * Open cash drawer and create session
   */
  const openCashDrawer = useCallback(
    async (openingCash: number, _notes: string) => {
      if (!session || !customUserId || !vendorId) {
        throw new Error('Session info, user ID, or vendor missing')
      }

      try {
        setLoading(true)
        setError(null)

        logger.info('[POSSessionContext] Opening cash drawer:', {
          locationId: session.locationId,
          registerId: session.registerId,
          openingCash,
        })

        // Call RPC function to create session
        const { data, error } = await supabase.rpc('get_or_create_session', {
          p_location_id: session.locationId,
          p_opening_cash: openingCash,
          p_register_id: session.registerId,
          p_user_id: customUserId,
          p_vendor_id: vendorId,
        })

        if (error) throw error

        logger.debug('[POSSessionContext] RPC response:', { data, dataType: typeof data, dataId: data?.id })

        // Handle array response (Supabase RPC sometimes wraps in array)
        const sessionData = Array.isArray(data) ? data[0] : data

        if (!sessionData?.id) {
          logger.error('[POSSessionContext] Session created but no ID returned:', sessionData)
          throw new Error('Session created but no ID returned')
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        const updatedSession: POSSession = {
          ...session,
          sessionId: sessionData.id,
        }

        const updatedApiConfig: POSApiConfig = {
          ...apiConfig!,
          sessionNumber: sessionData.session_number || 'Unknown',
          openingCash,
          totalSales: 0,
          totalCash: 0,
        }

        setSession(updatedSession)
        setApiConfig(updatedApiConfig)

        // Persist to AsyncStorage
        await AsyncStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(updatedSession))
        await AsyncStorage.setItem(STORAGE_KEY_API_CONFIG, JSON.stringify(updatedApiConfig))

        logger.info('[POSSessionContext] ✅ NEW SESSION CREATED - Full state:', {
          sessionId: sessionData.id,
          registerId: updatedSession.registerId,
          registerName: updatedSession.registerName,
          locationId: updatedSession.locationId,
          locationName: updatedSession.locationName,
          sessionNumber: sessionData.session_number,
          openingCash,
        })
      } catch (err) {
        logger.error('[POSSessionContext] Error opening cash drawer:', err)
        setError(err instanceof Error ? err.message : 'Failed to open cash drawer')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [session, apiConfig, customUserId, vendorId]
  )

  /**
   * Close cash drawer and end session
   */
  const closeCashDrawer = useCallback(
    async (closingCash: number, notes: string) => {
      if (!session?.sessionId) {
        throw new Error('No active session')
      }

      try {
        setLoading(true)
        setError(null)

        logger.info('[POSSessionContext] Closing cash drawer:', {
          sessionId: session.sessionId,
          closingCash,
        })

        // Close session via RPC
        const { data, error } = await supabase.rpc('close_pos_session', {
          p_session_id: session.sessionId,
          p_closing_cash: closingCash,
          p_closing_notes: notes || null,
        })

        if (error) throw error
        if (!data.success) {
          throw new Error(data.error || 'Failed to close session')
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Clear session
        await clearSession()

        logger.info('[POSSessionContext] Session closed successfully')
      } catch (err) {
        logger.error('[POSSessionContext] Error closing cash drawer:', err)
        setError(err instanceof Error ? err.message : 'Failed to close cash drawer')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [session]
  )

  /**
   * Clear session state
   */
  const clearSession = useCallback(async () => {
    setSession(null)
    setApiConfig(null)

    // Clear from AsyncStorage
    await AsyncStorage.multiRemove([STORAGE_KEY_SESSION, STORAGE_KEY_API_CONFIG])

    logger.info('[POSSessionContext] Session cleared')
  }, [])

  const value: POSSessionContextValue = {
    session,
    apiConfig,
    customUserId,
    loading,
    error,
    selectLocation,
    selectRegister,
    joinExistingSession,
    openCashDrawer,
    closeCashDrawer,
    clearSession,
    loadPersistedSession,
  }

  return <POSSessionContext.Provider value={value}>{children}</POSSessionContext.Provider>
}

// ========================================
// HOOK
// ========================================
export function usePOSSession() {
  const context = useContext(POSSessionContext)
  if (!context) {
    throw new Error('usePOSSession must be used within POSSessionProvider')
  }
  return context
}
