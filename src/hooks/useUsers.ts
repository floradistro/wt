import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: 'vendor_owner' | 'vendor_admin' | 'location_manager' | 'pos_staff' | 'inventory_staff' | 'readonly'
  status: 'active' | 'inactive'
  employee_id: string | null
  created_at: string
  updated_at: string
  vendor_id: string
  auth_user_id: string | null
}

export interface UserWithLocations extends User {
  location_count: number
  locations: {
    id: string
    name: string
  }[]
}

export function useUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserWithLocations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setUsers([])
      setIsLoading(false)
      return
    }

    loadUsers()
  }, [user])

  async function loadUsers() {
    try {
      setIsLoading(true)
      setError(null)

      logger.info('Loading users', { userEmail: user!.email })

      // First, get current user data to check permissions and get vendor_id
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('id, role, vendor_id')
        .eq('email', user!.email)
        .single()

      if (userError) {
        logger.error('Failed to fetch current user data', { error: userError })
        throw userError
      }

      // Check if user has permission to manage users (owner or admin)
      const canManageUsers = ['vendor_owner', 'vendor_admin'].includes(currentUser.role)

      if (!canManageUsers) {
        setUsers([])
        setError('You do not have permission to view users')
        return
      }

      // Get all users for this vendor
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          phone,
          role,
          status,
          employee_id,
          created_at,
          updated_at,
          vendor_id,
          auth_user_id
        `)
        .eq('vendor_id', currentUser.vendor_id)
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      // Get location assignments for each user
      const usersWithLocations: UserWithLocations[] = await Promise.all(
        (usersData || []).map(async (u) => {
          const { data: locationData } = await supabase
            .from('user_locations')
            .select(`
              location_id,
              locations!inner (
                id,
                name
              )
            `)
            .eq('user_id', u.id)

          const locations = (locationData || []).map((ld: any) => {
            const loc = Array.isArray(ld.locations) ? ld.locations[0] : ld.locations
            return {
              id: loc.id,
              name: loc.name,
            }
          })

          return {
            ...u,
            location_count: locations.length,
            locations,
          }
        })
      )

      setUsers(usersWithLocations)
      logger.info('Users loaded successfully', { count: usersWithLocations.length })
    } catch (err) {
      logger.error('Failed to load users', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  async function createUser(_userData: {
    email: string
    first_name: string
    last_name: string
    phone?: string
    role: string
    employee_id?: string
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    // NOTE: User creation requires Supabase Admin API which can only be called from backend
    // This needs to be implemented as a Supabase Edge Function or backend API endpoint
    // For now, returning an error to prevent 403 console errors

    return {
      success: false,
      error: 'User creation requires backend implementation. Please create a Supabase Edge Function with service role key.',
    }

    /* TODO: Implement as Edge Function
    try {
      // Get current user's vendor_id
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user!.email)
        .single()

      if (userError) throw userError

      // Create user in auth (Supabase Auth) - REQUIRES SERVICE ROLE KEY
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        email_confirm: true,
        user_metadata: {
          first_name: userData.first_name,
          last_name: userData.last_name,
        },
      })

      if (authError) throw authError

      // Create user record
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone || null,
          role: userData.role,
          employee_id: userData.employee_id || null,
          vendor_id: currentUser.vendor_id,
          auth_user_id: authData.user.id,
          status: 'active',
        })
        .select()
        .single()

      if (insertError) throw insertError

      await loadUsers()
      return { success: true, user: newUser }
    } catch (err) {
      logger.error('Failed to create user', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create user',
      }
    }
    */
  }

  async function updateUser(
    userId: string,
    updates: Partial<User>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)

      if (updateError) throw updateError

      await loadUsers()
      return { success: true }
    } catch (err) {
      logger.error('Failed to update user', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update user',
      }
    }
  }

  async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get auth_user_id before deleting
      const { data: userData } = await supabase
        .from('users')
        .select('auth_user_id')
        .eq('id', userId)
        .single()

      // Delete from users table (cascade will handle user_locations)
      const { error: deleteError } = await supabase.from('users').delete().eq('id', userId)

      if (deleteError) throw deleteError

      // Delete from auth if auth_user_id exists
      if (userData?.auth_user_id) {
        await supabase.auth.admin.deleteUser(userData.auth_user_id)
      }

      await loadUsers()
      return { success: true }
    } catch (err) {
      logger.error('Failed to delete user', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete user',
      }
    }
  }

  async function setUserPassword(
    userId: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get auth_user_id
      const { data: userData } = await supabase
        .from('users')
        .select('auth_user_id')
        .eq('id', userId)
        .single()

      if (!userData?.auth_user_id) {
        throw new Error('User has no auth account')
      }

      // Update password via Supabase Auth Admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userData.auth_user_id,
        { password }
      )

      if (updateError) throw updateError

      return { success: true }
    } catch (err) {
      logger.error('Failed to set password', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to set password',
      }
    }
  }

  async function assignLocations(
    userId: string,
    locationIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Remove all existing assignments
      await supabase.from('user_locations').delete().eq('user_id', userId)

      // Add new assignments
      if (locationIds.length > 0) {
        const assignments = locationIds.map((locationId, index) => ({
          user_id: userId,
          location_id: locationId,
          is_primary_location: index === 0, // First location is primary
          can_sell: true,
          can_manage_inventory: false,
          can_manage: false,
          can_transfer: false,
        }))

        const { error: insertError } = await supabase.from('user_locations').insert(assignments)

        if (insertError) throw insertError
      }

      await loadUsers()
      return { success: true }
    } catch (err) {
      logger.error('Failed to assign locations', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to assign locations',
      }
    }
  }

  async function toggleUserStatus(
    userId: string,
    status: 'active' | 'inactive'
  ): Promise<{ success: boolean; error?: string }> {
    return updateUser(userId, { status })
  }

  return {
    users,
    isLoading,
    error,
    reload: loadUsers,
    createUser,
    updateUser,
    deleteUser,
    setUserPassword,
    assignLocations,
    toggleUserStatus,
  }
}
