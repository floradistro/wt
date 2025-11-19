/**
 * User Lookup Utility
 * Handles looking up user records by auth_user_id
 *
 * IMPORTANT: Only queries by auth_user_id to comply with RLS policies
 * Email-based queries will fail due to RLS: (auth_user_id = auth.uid())
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { User } from '@supabase/supabase-js'

export interface UserRecord {
  id: string
  email: string
  auth_user_id: string | null
  vendor_id: string
  role: string
  first_name: string
  last_name: string
}

/**
 * Get user record from database by auth user
 * Returns null if not found (instead of throwing)
 *
 * @param authUser - The authenticated user from Supabase auth
 * @returns UserRecord or null if not found
 */
export async function getUserRecord(authUser: User): Promise<UserRecord | null> {
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, auth_user_id, vendor_id, role, first_name, last_name')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()

    if (userError || !userData) {
      logger.error('[getUserRecord] User not found by auth_user_id', {
        authUserId: authUser.id,
        email: authUser.email,
        error: userError
      })
      return null
    }

    logger.debug('[getUserRecord] Found user by auth_user_id', {
      userId: userData.id,
      email: userData.email
    })

    return userData
  } catch (error) {
    logger.error('[getUserRecord] Unexpected error', { error })
    return null
  }
}

/**
 * Get user record and throw if not found
 * Use this when the user MUST exist
 */
export async function getUserRecordOrThrow(authUser: User): Promise<UserRecord> {
  const userRecord = await getUserRecord(authUser)

  if (!userRecord) {
    throw new Error(`User record not found for ${authUser.email}. Please contact support.`)
  }

  return userRecord
}
