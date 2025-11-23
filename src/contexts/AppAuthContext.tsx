/**
 * AppAuthContext - Environmental Auth Data
 *
 * Apple Principle: Context for rarely-changing environmental data
 *
 * Provides:
 * - user: Current authenticated user
 * - vendor: User's vendor (store info, logo)
 * - locations: Vendor's locations
 *
 * Usage:
 * const { user, vendor, locations } = useAppAuth()
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Vendor, Location } from '@/types/pos'
import { useAuthStore } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// ========================================
// TYPES
// ========================================
interface AppAuthContextValue {
  // State
  user: User | null
  vendor: Vendor | null
  locations: Location[]
  loading: boolean
  error: string | null

  // Actions
  refreshVendorData: () => Promise<void>
}

// ========================================
// CONTEXT
// ========================================
const AppAuthContext = createContext<AppAuthContextValue | undefined>(undefined)

// ========================================
// PROVIDER
// ========================================
interface AppAuthProviderProps {
  children: ReactNode
}

export function AppAuthProvider({ children }: AppAuthProviderProps) {
  const authUser = useAuthStore((state) => state.user)

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load vendor and locations when user changes
   */
  useEffect(() => {
    async function loadVendorData() {
      if (!authUser?.id) {
        // User logged out - clear vendor data
        setVendor(null)
        setLocations([])
        return
      }

      try {
        setLoading(true)
        setError(null)

        logger.info('[AppAuthContext] Loading vendor data for user:', authUser.id)

        // Get user's vendor
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, role, vendor_id, vendors(id, store_name, logo_url)')
          .eq('auth_user_id', authUser.id)
          .maybeSingle()

        if (userError || !userData) {
          throw userError || new Error('User record not found')
        }

        // Extract vendor from join
        const vendorsData = userData.vendors
        let vendorData: Vendor | null = null

        if (vendorsData) {
          if (Array.isArray(vendorsData)) {
            vendorData = vendorsData.length > 0 ? vendorsData[0] as Vendor : null
          } else {
            vendorData = vendorsData as Vendor
          }
        }

        if (!vendorData) {
          throw new Error('No vendor found for user')
        }

        logger.info('[AppAuthContext] Vendor loaded:', {
          vendorId: vendorData.id,
          storeName: vendorData.store_name,
        })

        setVendor(vendorData)

        // Load locations for vendor
        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('*')
          .eq('vendor_id', vendorData.id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .order('name', { ascending: true })

        if (locationsError) {
          logger.error('[AppAuthContext] Failed to load locations:', locationsError)
          setLocations([])
        } else {
          logger.info('[AppAuthContext] Locations loaded:', locationsData?.length || 0)
          setLocations(locationsData || [])
        }
      } catch (err) {
        logger.error('[AppAuthContext] Failed to load vendor data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load vendor data')
        setVendor(null)
        setLocations([])
      } finally {
        setLoading(false)
      }
    }

    loadVendorData()
  }, [authUser?.id])

  /**
   * Manual refresh function
   */
  const refreshVendorData = async () => {
    if (!authUser?.id) return

    try {
      setLoading(true)
      setError(null)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id, vendors(id, store_name, logo_url)')
        .eq('auth_user_id', authUser.id)
        .maybeSingle()

      if (userError || !userData) {
        throw userError || new Error('User record not found')
      }

      const vendorsData = userData.vendors
      let vendorData: Vendor | null = null

      if (vendorsData) {
        if (Array.isArray(vendorsData)) {
          vendorData = vendorsData.length > 0 ? vendorsData[0] as Vendor : null
        } else {
          vendorData = vendorsData as Vendor
        }
      }

      if (vendorData) {
        setVendor(vendorData)

        const { data: locationsData } = await supabase
          .from('locations')
          .select('*')
          .eq('vendor_id', vendorData.id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .order('name', { ascending: true })

        setLocations(locationsData || [])
      }
    } catch (err) {
      logger.error('[AppAuthContext] Refresh failed:', err)
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setLoading(false)
    }
  }

  const value: AppAuthContextValue = {
    user: authUser,
    vendor,
    locations,
    loading,
    error,
    refreshVendorData,
  }

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}

// ========================================
// HOOK
// ========================================
export function useAppAuth() {
  const context = useContext(AppAuthContext)
  if (!context) {
    throw new Error('useAppAuth must be used within AppAuthProvider')
  }
  return context
}
