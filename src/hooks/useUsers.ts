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

  async function createUser(userData: {
    email: string
    first_name: string
    last_name: string
    phone?: string
    role: string
    employee_id?: string
  }): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      // Call Edge Function using fetch directly to properly handle error responses
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uaednwpxursknmwdeejn.supabase.co'
      const functionUrl = `${SUPABASE_URL}/functions/v1/create-user`

      logger.debug('Calling Edge Function:', functionUrl)

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          role: userData.role,
          employee_id: userData.employee_id,
        }),
      })

      logger.debug('Edge Function response status:', response.status)

      const responseText = await response.text()
      logger.debug('Edge Function response body:', responseText)

      if (!response.ok) {
        // Try to parse error from response
        let errorMsg = `Edge Function error (${response.status})`
        try {
          const errorData = JSON.parse(responseText)
          if (errorData.error) {
            errorMsg = errorData.error
            if (errorData.details) {
              errorMsg += ` (${errorData.details})`
            }
          } else if (errorData.message) {
            errorMsg = errorData.message
          }
        } catch (parseErr) {
          // Response wasn't JSON, use text directly
          if (responseText && responseText.length < 200) {
            errorMsg = responseText
          }
        }
        throw new Error(errorMsg)
      }

      // Parse successful response
      const data = JSON.parse(responseText)

      if (!data.success) {
        const errorMsg = data.error || 'Failed to create user'
        const details = data.details || ''
        logger.error('Edge Function returned error:', { error: errorMsg, details })
        throw new Error(`${errorMsg}${details ? ` (${details})` : ''}`)
      }

      await loadUsers()
      return { success: true, user: data.user }
    } catch (err) {
      logger.error('Failed to create user', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create user',
      }
    }
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
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Call Edge Function to delete user (requires service role for auth deletion)
      const response = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'delete-user',
          userId,
        },
      })

      logger.debug('Delete user Edge Function response:', {
        data: response.data,
        error: response.error,
      })

      // Handle network/invocation errors
      if (response.error) {
        const context = (response.error as any).context

        logger.error('Edge Function error context:', {
          context,
          contextKeys: context ? Object.keys(context) : [],
        })

        // Try to extract the actual error message from the function response
        let errorMsg = 'Failed to call Edge Function'

        if (context) {
          if (context.error) {
            errorMsg = context.error
          } else if (context.message) {
            errorMsg = context.message
          } else if (typeof context === 'string') {
            errorMsg = context
          }
        }

        logger.error('Extracted error message:', errorMsg)
        throw new Error(errorMsg)
      }

      // Handle function response errors
      const data = response.data

      if (!data) {
        throw new Error('No response from Edge Function')
      }

      logger.debug('Edge Function data:', data)

      if (!data.success) {
        const errorMsg = data.error || 'Failed to delete user'
        const details = data.details || ''
        logger.error('Edge Function returned error:', { error: errorMsg, details })
        throw new Error(`${errorMsg}${details ? ` (${details})` : ''}`)
      }

      await loadUsers()
      return { success: true }
    } catch (err) {
      logger.error('Failed to delete user', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      })
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
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Call Edge Function to set password (requires service role)
      const response = await supabase.functions.invoke('manage-user', {
        body: {
          action: 'set-password',
          userId,
          password,
        },
      })

      logger.debug('Set password Edge Function response:', {
        data: response.data,
        error: response.error,
      })

      // Handle network/invocation errors
      if (response.error) {
        const context = (response.error as any).context

        logger.error('Edge Function error context:', {
          context,
          contextKeys: context ? Object.keys(context) : [],
        })

        // Try to extract the actual error message from the function response
        let errorMsg = 'Failed to call Edge Function'

        if (context) {
          if (context.error) {
            errorMsg = context.error
          } else if (context.message) {
            errorMsg = context.message
          } else if (typeof context === 'string') {
            errorMsg = context
          }
        }

        logger.error('Extracted error message:', errorMsg)
        throw new Error(errorMsg)
      }

      // Handle function response errors
      const data = response.data

      if (!data) {
        throw new Error('No response from Edge Function')
      }

      logger.debug('Edge Function data:', data)

      if (!data.success) {
        const errorMsg = data.error || 'Failed to set password'
        const details = data.details || ''
        logger.error('Edge Function returned error:', { error: errorMsg, details })
        throw new Error(`${errorMsg}${details ? ` (${details})` : ''}`)
      }

      return { success: true }
    } catch (err) {
      logger.error('Failed to set password', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      })
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
