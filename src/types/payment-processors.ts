/**
 * Payment Processor Types
 */

export type ProcessorType = 'pax' | 'stripe' | 'square' | 'clover'

export interface PaymentProcessor {
  id: string
  vendor_id: string
  location_id?: string
  processor_type: ProcessorType
  name: string
  is_active: boolean
  is_primary: boolean
  config: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ProcessorFormData {
  processor_type: ProcessorType
  name: string
  is_active: boolean
  is_primary: boolean
  location_id?: string
  config: Record<string, any>
}
