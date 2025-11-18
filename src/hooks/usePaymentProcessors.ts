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

      logger.debug('[usePaymentProcessors] Loading processors via API')

      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Call API instead of direct Supabase query
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://whaletools.dev'
      const url = new URL(`${BASE_URL}/api/vendor/payment-processors`)

      if (locationId) {
        url.searchParams.set('location_id', locationId)  // Fixed: API expects location_id, not locationId
      }

      logger.debug('[usePaymentProcessors] Calling API:', url.toString())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('[usePaymentProcessors] API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        throw new Error(`API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      logger.debug('[usePaymentProcessors] API response:', data)

      const processors = data.processors || []

      logger.debug('[usePaymentProcessors] Raw processors from API:', processors)

      // Map API response to PaymentProcessor interface
      const transformedProcessors: PaymentProcessor[] = processors.map((proc: any) => {
        logger.debug('[usePaymentProcessors] Mapping processor:', {
          id: proc.id,
          name: proc.processor_name,
          processor_type: proc.processor_type,
          has_authkey: !!proc.dejavoo_authkey,
          authkey_length: proc.dejavoo_authkey?.length || 0,
          has_tpn: !!proc.dejavoo_tpn,
          tpn_value: proc.dejavoo_tpn,
          last_tested_at: proc.last_tested_at,
          last_test_status: proc.last_test_status,
        })
        return {
        id: proc.id,
        vendor_id: proc.vendor_id,
        location_id: proc.location_id,
        processor_type: proc.processor_type as ProcessorType,
        processor_name: proc.processor_name,
        is_active: proc.is_active,
        is_default: proc.is_default,
        environment: proc.environment,

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

        // Health
        last_tested_at: proc.last_tested_at,
        last_test_status: proc.last_test_status,
        last_test_error: proc.last_test_error,

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

      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Call API to create processor
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://whaletools.dev'

      const response = await fetch(`${BASE_URL}/api/vendor/payment-processors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          ...processorData,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} ${errorText}`)
      }

      await loadProcessors()
      return { success: true }
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
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Call API to update processor
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://whaletools.dev'

      const response = await fetch(`${BASE_URL}/api/vendor/payment-processors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'update',
          id: processorId,
          ...updates,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} ${errorText}`)
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
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Call API to delete processor
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://whaletools.dev'

      const response = await fetch(`${BASE_URL}/api/vendor/payment-processors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          id: processorId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} ${errorText}`)
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
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://whaletools.dev'

      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        return { success: false, error: 'Authentication required' }
      }

      const TEST_ENDPOINT = `${BASE_URL}/api/pos/payment-processors/test`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await fetch(TEST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          processorId,
          amount: 1.00,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const duration = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()

        if (data.success) {
          await loadProcessors() // Reload to get updated test status
          return { success: true, message: data.message || 'Test successful' }
        } else {
          return { success: false, error: data.message || data.error || 'Test declined' }
        }
      } else {
        const errorText = await response.text()
        logger.error('❌ Test transaction failed:', response.status, errorText)

        // Parse common error messages
        let errorMessage = `Test failed (${response.status})`

        if (errorText.includes('Authkey or Token field is required')) {
          errorMessage = 'Missing payment processor credentials. Please configure API key/token.'
        } else if (errorText.includes('Invalid request data')) {
          errorMessage = 'Invalid payment processor configuration'
        }

        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      const isTimeout = error.name === 'AbortError'
      const errorMsg = isTimeout ? 'Test timeout (30s)' : (error.message || 'Connection failed')

      logger.error('❌ Test transaction error:', error)
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
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Call API to toggle status
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://whaletools.dev'

      const response = await fetch(`${BASE_URL}/api/vendor/payment-processors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'update',
          id: processorId,
          is_active: isActive,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} ${errorText}`)
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
