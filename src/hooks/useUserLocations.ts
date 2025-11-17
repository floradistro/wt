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

      logger.info('Loading user locations', { userEmail: user!.email })

      // First, get user data to check if they're admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id')
        .eq('email', user!.email)
        .single()

      if (userError) {
        logger.error('Failed to fetch user data', { error: userError, email: user!.email })
        throw userError
      }

      logger.info('User data fetched', { role: userData.role, vendorId: userData.vendor_id })

      // Check if user is admin (owner or admin role)
      const isAdmin = ['vendor_owner', 'vendor_admin'].includes(userData.role)

      let formattedLocations: UserLocationAccess[] = []

      if (isAdmin) {
        // Admin users see ALL locations for their vendor
        const { data: allLocations, error: locationsError } = await supabase
          .from('locations')
          .select('id, name, address_line1, city, state, is_primary')
          .eq('vendor_id', userData.vendor_id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .order('name')

        if (locationsError) throw locationsError

        formattedLocations = (allLocations || []).map((loc) => ({
          location: loc,
          role: 'owner' as const, // Admins have full access
        }))
      } else {
        // Regular users see only their assigned locations
        const { data: userLocationsData, error: locationsError } = await supabase
          .from('user_locations')
          .select(`
            role,
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
          .order('locations.is_primary', { ascending: false })

        if (locationsError) throw locationsError

        formattedLocations = (userLocationsData || []).map((ul: any) => ({
          location: ul.locations,
          role: ul.role || 'staff',
        }))
      }

      setLocations(formattedLocations)
    } catch (err) {
      logger.error('Failed to load user locations', { error: err })
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
