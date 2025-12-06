/**
 * Payment Processor Types
 */

export type ProcessorType = 'dejavoo' | 'stripe' | 'square' | 'clover' | 'authorizenet'

export interface PaymentProcessor {
  id: string
  vendor_id: string
  location_id?: string | null
  processor_type: ProcessorType
  processor_name: string
  is_active: boolean
  is_default: boolean
  environment: 'sandbox' | 'production'
  // Dejavoo fields
  dejavoo_authkey?: string | null
  dejavoo_tpn?: string | null
  // Authorize.Net fields
  authorizenet_api_login_id?: string | null
  authorizenet_transaction_key?: string | null
  authorizenet_public_client_key?: string | null
  authorizenet_signature_key?: string | null
  is_ecommerce_processor?: boolean
  // Test status
  last_tested_at?: string | null
  last_test_status?: 'success' | 'failed' | null
  last_test_error?: string | null
  // Timestamps
  created_at: string
  updated_at: string
  // Legacy compatibility
  name?: string
  is_primary?: boolean
  config?: Record<string, any>
  settings?: Record<string, any>
}

export interface ProcessorFormData {
  processor_type: ProcessorType
  name: string
  is_active: boolean
  is_primary: boolean
  location_id?: string | null
  config: Record<string, any>
}
