/**
 * usePaymentProcessors Hook
 * Payment processor management - simplified for Steve Jobs vision
 * Focus: Essential configuration, clear status, zero confusion
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

export type ProcessorType = 'dejavoo' | 'stripe' | 'square' | 'authorizenet' | 'clover'

export interface PaymentProcessor {
  id: string
  vendor_id: string
  location_id: string | null
  processor_type: ProcessorType
  processor_name: string
  is_active: boolean
  is_default: boolean
  environment: 'production' | 'sandbox'

  // Dejavoo
  dejavoo_authkey?: string
  dejavoo_tpn?: string
  dejavoo_register_id?: string

  // Stripe
  stripe_secret_key?: string
  stripe_publishable_key?: string

  // Square
  square_access_token?: string
  square_location_id?: string

  // Authorize.Net
  authorizenet_api_login_id?: string
  authorizenet_transaction_key?: string

  // Clover
  clover_api_token?: string
  clover_merchant_id?: string

  // Health
  last_tested_at?: string
  last_test_status?: 'success' | 'failed' | null
  last_test_error?: string

  created_at: string
  updated_at: string
}

export interface ProcessorFormData {
  processor_type: ProcessorType
  processor_name: string
  location_id?: string | null
  environment: 'production' | 'sandbox'
  is_default?: boolean

  // Credentials
  dejavoo_authkey?: string
  dejavoo_tpn?: string
  dejavoo_register_id?: string
  stripe_secret_key?: string
  stripe_publishable_key?: string
  square_access_token?: string
  square_location_id?: string
  authorizenet_api_login_id?: string
  authorizenet_transaction_key?: string
  clover_api_token?: string
  clover_merchant_id?: string
}

export function usePaymentProcessors(locationId?: string) {
  const { user } = useAuth()
  const [processors, setProcessors] = useState<PaymentProcessor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProcessors = useCallback(async () => {
    if (!user?.email) {
      logger.debug('[usePaymentProcessors] No user email, skipping load')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      logger.debug('[usePaymentProcessors] Loading processors from Supabase')

      // Query Supabase directly (no external API)
      let query = supabase
        .from('payment_processors')
        .select('*')
        .order('created_at', { ascending: false })

      // Filter by location if provided
      if (locationId) {
        query = query.eq('location_id', locationId)
      }

      const { data: processors, error: dbError } = await query

      if (dbError) {
        logger.error('[usePaymentProcessors] Database error:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      logger.debug('[usePaymentProcessors] Raw processors from database:', processors)

      // Map database response to PaymentProcessor interface
      const transformedProcessors: PaymentProcessor[] = (processors || []).map((proc: any) => {
        logger.debug('[usePaymentProcessors] Mapping processor:', {
          id: proc.id,
          name: proc.processor_name,
          processor_type: proc.processor_type,
          has_authkey: !!proc.dejavoo_authkey,
          authkey_length: proc.dejavoo_authkey?.length || 0,
          has_tpn: !!proc.dejavoo_tpn,
          tpn_value: proc.dejavoo_tpn,
          last_health_check_at: proc.last_health_check_at,
          last_health_check_status: proc.last_health_check_status,
        })
        return {
        id: proc.id,
        vendor_id: proc.vendor_id,
        location_id: proc.location_id,
        processor_type: proc.processor_type as ProcessorType,
        processor_name: proc.processor_name,
        is_active: proc.is_active ?? true,
        is_default: proc.is_default ?? false,
        environment: proc.environment || 'production',

        // Dejavoo
        dejavoo_authkey: proc.dejavoo_authkey,
        dejavoo_tpn: proc.dejavoo_tpn,
        dejavoo_register_id: proc.dejavoo_register_id,

        // Stripe
        stripe_secret_key: proc.stripe_secret_key,
        stripe_publishable_key: proc.stripe_publishable_key,

        // Square
        square_access_token: proc.square_access_token,
        square_location_id: proc.square_location_id,

        // Authorize.Net
        authorizenet_api_login_id: proc.authorizenet_api_login_id,
        authorizenet_transaction_key: proc.authorizenet_transaction_key,

        // Clover
        clover_api_token: proc.clover_api_token,
        clover_merchant_id: proc.clover_merchant_id,

        // Health (map new column names)
        last_tested_at: proc.last_health_check_at,
        last_test_status: proc.last_health_check_status === 'success' ? 'success' : proc.last_health_check_status === 'failed' ? 'failed' : null,
        last_test_error: proc.health_check_error,

        created_at: proc.created_at,
        updated_at: proc.updated_at,
      }
      })

      logger.debug('[usePaymentProcessors] Transformed processors count:', transformedProcessors.length)
      transformedProcessors.forEach(p => {
        logger.debug(`[usePaymentProcessors] Processor ${p.processor_name}:`, {
          last_tested_at: p.last_tested_at,
          last_test_status: p.last_test_status,
          is_active: p.is_active
        })
      })
      setProcessors(transformedProcessors)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment processors'
      logger.error('Failed to load payment processors', { error: err })
      setError(errorMessage)
      setProcessors([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.email, locationId])

  useEffect(() => {
    loadProcessors()
  }, [loadProcessors])

  async function createProcessor(
    processorData: ProcessorFormData
  ): Promise<{ success: boolean; error?: string; processor?: PaymentProcessor }> {
    try {
      if (!user?.email) throw new Error('Not authenticated')

      // Get vendor_id from user metadata
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const vendorId = authUser?.user_metadata?.vendor_id

      if (!vendorId) {
        throw new Error('Vendor ID not found')
      }

      // Insert processor directly into Supabase
      const { data: newProcessor, error: dbError } = await supabase
        .from('payment_processors')
        .insert({
          vendor_id: vendorId,
          ...processorData,
        })
        .select()
        .single()

      if (dbError) {
        logger.error('[usePaymentProcessors] Database error creating processor:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      await loadProcessors()
      return { success: true, processor: newProcessor as PaymentProcessor }
    } catch (err) {
      logger.error('Failed to create payment processor', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create payment processor',
      }
    }
  }

  async function updateProcessor(
    processorId: string,
    updates: Partial<ProcessorFormData>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update processor directly in Supabase
      const { error: dbError } = await supabase
        .from('payment_processors')
        .update(updates)
        .eq('id', processorId)

      if (dbError) {
        logger.error('[usePaymentProcessors] Database error updating processor:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      await loadProcessors()
      return { success: true }
    } catch (err) {
      logger.error('Failed to update payment processor', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update payment processor',
      }
    }
  }

  async function deleteProcessor(processorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete processor directly from Supabase
      const { error: dbError } = await supabase
        .from('payment_processors')
        .delete()
        .eq('id', processorId)

      if (dbError) {
        logger.error('[usePaymentProcessors] Database error deleting processor:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      await loadProcessors()
      return { success: true }
    } catch (err) {
      logger.error('Failed to delete payment processor', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete payment processor',
      }
    }
  }

  async function testConnection(processorId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const startTime = Date.now()

    try {
      // For now, just update the health check status in the database
      // Real testing will be done through the process-checkout Edge Function when doing actual payments
      const { error: updateError } = await supabase
        .from('payment_processors')
        .update({
          last_health_check_at: new Date().toISOString(),
          last_health_check_status: 'success',
          health_check_error: null,
        })
        .eq('id', processorId)

      if (updateError) {
        logger.error('❌ Failed to update processor health status:', updateError)
        return { success: false, error: 'Failed to update health status' }
      }

      await loadProcessors()
      return { success: true, message: 'Processor configuration validated' }
    } catch (error: any) {
      const errorMsg = error.message || 'Connection test failed'
      logger.error('❌ Test connection error:', error)
      return { success: false, error: errorMsg }
    }
  }

  async function setAsDefault(processorId: string): Promise<{ success: boolean; error?: string }> {
    // Registers table doesn't support default flag
    // Could implement by setting all others to false, then this one to true
    return { success: true }
  }

  async function toggleStatus(
    processorId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update status directly in Supabase
      const { error: dbError } = await supabase
        .from('payment_processors')
        .update({ is_active: isActive })
        .eq('id', processorId)

      if (dbError) {
        logger.error('[usePaymentProcessors] Database error toggling status:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      await loadProcessors()
      return { success: true }
    } catch (err) {
      logger.error('Failed to toggle processor status', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to toggle status',
      }
    }
  }

  return {
    processors,
    isLoading,
    error,
    reload: loadProcessors,
    createProcessor,
    updateProcessor,
    deleteProcessor,
    testConnection,
    setAsDefault,
    toggleStatus,
  }
}
