import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

export interface Location {
  id: string
  name: string
  address_line1: string | null
  city: string | null
  state: string | null
  postal_code?: string | null
  phone?: string | null
  tax_rate?: number | null
  tax_name?: string | null
  is_primary: boolean
}

export interface UserLocationAccess {
  location: Location
  role: 'owner' | 'manager' | 'staff'
}

export function useUserLocations() {
  const { user } = useAuth()
  const [locations, setLocations] = useState<UserLocationAccess[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setLocations([])
      setIsLoading(false)
      return
    }

    loadLocations()
  }, [user])

  async function loadLocations() {
    try {
      setIsLoading(true)
      setError(null)

      logger.info('[useUserLocations] Loading user locations', {
        userEmail: user!.email,
        authUserId: user!.id
      })

      // Get user data by auth_user_id
      const { data: userData, error: authIdError } = await supabase
        .from('users')
        .select('id, role, vendor_id, email')
        .eq('auth_user_id', user!.id)
        .maybeSingle()

      if (authIdError || !userData) {
        logger.error('[useUserLocations] Failed to fetch user data by auth_user_id', {
          authUserId: user!.id,
          email: user!.email,
          error: authIdError
        })
        throw new Error(`Could not find user record. Please contact support. (Auth ID: ${user!.id})`)
      }

      logger.info('[useUserLocations] User data fetched', {
        userId: userData.id,
        role: userData.role,
        vendorId: userData.vendor_id,
        email: userData.email
      })

      // Check if user is admin (owner, admin, or vendor_admin role)
      const isAdmin = ['vendor_owner', 'vendor_admin', 'admin'].includes(userData.role)

      logger.info('[useUserLocations] Admin check', {
        role: userData.role,
        isAdmin,
        vendorId: userData.vendor_id
      })

      let formattedLocations: UserLocationAccess[] = []

      if (isAdmin) {
        // Admin users see ALL locations for their vendor
        logger.info('[useUserLocations] User is admin, loading all locations for vendor', {
          vendorId: userData.vendor_id
        })

        const { data: allLocations, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, address_line1, city, state, is_primary')
          .eq('vendor_id', userData.vendor_id)
          .eq('is_active', true)
          .order('name')

        if (locationsError) {
          logger.error('[useUserLocations] Failed to load admin locations', {
            error: locationsError,
            vendorId: userData.vendor_id
          })
          throw locationsError
        }

        logger.info('[useUserLocations] Admin locations loaded', {
          count: allLocations?.length || 0,
          locations: allLocations?.map(l => ({ id: l.id, name: l.name }))
        })

        formattedLocations = (allLocations || []).map((loc) => ({
          location: loc,
          role: 'owner' as const, // Admins have full access
        }))

        // Sort client-side: primary locations first
        formattedLocations.sort((a, b) => {
          if (a.location.is_primary && !b.location.is_primary) return -1
          if (!a.location.is_primary && b.location.is_primary) return 1
          return a.location.name.localeCompare(b.location.name)
        })
      } else {
        // Regular users see only their assigned locations
        logger.info('[useUserLocations] User is NOT admin, loading assigned locations', {
          userId: userData.id
        })

        const { data: userLocationsData, error: locationsError } = await supabase
          .from('user_locations')
          .select(`
            can_manage,
            can_sell,
            can_manage_inventory,
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
          .eq('locations.is_active', true)

        if (locationsError) {
          logger.error('[useUserLocations] Failed to load user assigned locations', {
            error: locationsError,
            userId: userData.id
          })
          throw locationsError
        }

        logger.info('[useUserLocations] User assigned locations loaded', {
          count: userLocationsData?.length || 0,
          data: userLocationsData
        })

        formattedLocations = (userLocationsData || []).map((ul: any) => {
          // Derive role from permissions
          const role = ul.can_manage ? 'manager' : 'staff'

          // Handle both array and single object from join
          const location = Array.isArray(ul.locations) ? ul.locations[0] : ul.locations

          return {
            location,
            role: role as 'owner' | 'manager' | 'staff',
          }
        })

        // Sort client-side: primary locations first
        formattedLocations.sort((a, b) => {
          if (a.location.is_primary && !b.location.is_primary) return -1
          if (!a.location.is_primary && b.location.is_primary) return 1
          return a.location.name.localeCompare(b.location.name)
        })
      }

      logger.info('[useUserLocations] Final formatted locations', {
        count: formattedLocations.length,
        locations: formattedLocations.map(fl => ({
          id: fl.location.id,
          name: fl.location.name,
          role: fl.role
        }))
      })

      setLocations(formattedLocations)
    } catch (err) {
      logger.error('[useUserLocations] Failed to load user locations', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    locations,
    isLoading,
    error,
    reload: loadLocations,
  }
}
