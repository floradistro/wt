/**
 * useLoyalty Hook
 * Simplified loyalty program management
 * Steve Jobs vision: Minimal, essential, beautiful
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

export interface LoyaltyProgram {
  id: string
  vendor_id: string
  name: string
  points_per_dollar: number
  point_value: number
  min_redemption_points: number
  points_expiry_days: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useLoyalty() {
  const { user } = useAuth()
  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProgram = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get vendor ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError
      if (!userData?.vendor_id) throw new Error('No vendor ID found')

      // Fetch loyalty program (should only be one per vendor)
      const { data, error: programError } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('vendor_id', userData.vendor_id)
        .single()

      if (programError && programError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is OK
        throw programError
      }

      setProgram(data || null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load loyalty program'
      logger.error('Failed to load loyalty program', { error: err })
      setError(errorMessage)
      setProgram(null)
    } finally {
      setIsLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    loadProgram()
  }, [loadProgram])

  async function createProgram(programData: {
    name?: string
    points_per_dollar: number
    point_value: number
    min_redemption_points: number
    points_expiry_days: number | null
  }): Promise<{ success: boolean; error?: string; program?: LoyaltyProgram }> {
    try {
      if (!user?.email) throw new Error('Not authenticated')

      // Get vendor ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      // Create loyalty program
      const { data: newProgram, error: insertError } = await supabase
        .from('loyalty_programs')
        .insert({
          name: programData.name || 'Loyalty Rewards',
          points_per_dollar: programData.points_per_dollar,
          point_value: programData.point_value,
          min_redemption_points: programData.min_redemption_points,
          points_expiry_days: programData.points_expiry_days,
          vendor_id: userData.vendor_id,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      await loadProgram()
      return { success: true, program: newProgram }
    } catch (err) {
      logger.error('Failed to create loyalty program', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create loyalty program',
      }
    }
  }

  async function updateProgram(
    updates: Partial<LoyaltyProgram>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!program?.id) throw new Error('No program to update')

      const { error: updateError } = await supabase
        .from('loyalty_programs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', program.id)

      if (updateError) throw updateError

      await loadProgram()
      return { success: true }
    } catch (err) {
      logger.error('Failed to update loyalty program', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update loyalty program',
      }
    }
  }

  async function toggleProgramStatus(
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    return updateProgram({ is_active: isActive })
  }

  return {
    program,
    isLoading,
    error,
    reload: loadProgram,
    createProgram,
    updateProgram,
    toggleProgramStatus,
  }
}
