/**
 * Payment Processors Management Store (Settings)
 * Apple Pattern: Business logic in store (not in components)
 *
 * Note: This is different from payment-processor.store.ts (POS runtime)
 * This store handles CRUD operations for payment processor configuration
 *
 * ZERO PROP DRILLING ✅
 * - Settings screens read processors from this store
 * - All CRUD operations happen in actions
 * - No hook dependencies, pure Zustand
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { Sentry } from '@/utils/sentry'
import type { PaymentProcessor, ProcessorFormData } from '@/types/payment-processors'

interface PaymentProcessorsSettingsState {
  // Data
  processors: PaymentProcessor[]
  isLoading: boolean
  error: string | null

  // Actions
  loadProcessors: (vendorId: string) => Promise<void>
  createProcessor: (vendorId: string, data: ProcessorFormData) => Promise<{ success: boolean; error?: string }>
  updateProcessor: (id: string, data: Partial<ProcessorFormData>) => Promise<{ success: boolean; error?: string }>
  deleteProcessor: (id: string) => Promise<{ success: boolean; error?: string }>
  testConnection: (id: string) => Promise<{ success: boolean; message?: string; error?: string }>
  setAsDefault: (id: string, vendorId: string) => Promise<{ success: boolean; error?: string }>
  toggleProcessorStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>

  reset: () => void
}

const initialState = {
  processors: [],
  isLoading: false,
  error: null,
}

export const usePaymentProcessorsSettingsStore = create<PaymentProcessorsSettingsState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Load all payment processors for a vendor
       */
      loadProcessors: async (vendorId: string) => {
        set({ isLoading: true, error: null })

        try {
          logger.debug('[PaymentProcessorsSettings] Loading processors for vendor:', vendorId)

          const { data, error } = await supabase
            .from('payment_processors')
            .select('*')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false })

          if (error) throw error

          set({ processors: data || [], isLoading: false })
          logger.debug('[PaymentProcessorsSettings] Loaded processors:', data?.length)
        } catch (error: any) {
          const errorMsg = error.message || 'Failed to load payment processors'
          logger.error('[PaymentProcessorsSettings] Load error:', error)

          Sentry.captureException(error, {
            level: 'error',
            tags: { operation: 'load_processors' },
          })

          set({ error: errorMsg, isLoading: false })
        }
      },

      /**
       * Create a new payment processor
       */
      createProcessor: async (vendorId: string, data: ProcessorFormData) => {
        try {
          logger.debug('[PaymentProcessorsSettings] Creating processor:', data)

          const { error } = await supabase
            .from('payment_processors')
            .insert({
              vendor_id: vendorId,
              processor_type: data.processor_type,
              processor_name: data.name,
              is_active: data.is_active,
              is_primary: data.is_primary,
              location_id: data.location_id || null,
              config: data.config || {},
            })

          if (error) throw error

          // Reload processors to get the new one
          await get().loadProcessors(vendorId)

          logger.debug('[PaymentProcessorsSettings] Processor created successfully')
          return { success: true }
        } catch (error: any) {
          const errorMsg = error.message || 'Failed to create processor'
          logger.error('[PaymentProcessorsSettings] Create error:', error)

          Sentry.captureException(error, {
            level: 'error',
            tags: { operation: 'create_processor' },
          })

          return { success: false, error: errorMsg }
        }
      },

      /**
       * Update an existing payment processor
       */
      updateProcessor: async (id: string, data: Partial<ProcessorFormData>) => {
        try {
          logger.debug('[PaymentProcessorsSettings] Updating processor:', id, data)

          const updateData: any = {}
          if (data.processor_type) updateData.processor_type = data.processor_type
          if (data.name) updateData.processor_name = data.name
          if (data.is_active !== undefined) updateData.is_active = data.is_active
          if (data.is_primary !== undefined) updateData.is_primary = data.is_primary
          if (data.location_id !== undefined) updateData.location_id = data.location_id
          if (data.config) updateData.config = data.config

          const { error } = await supabase
            .from('payment_processors')
            .update(updateData)
            .eq('id', id)

          if (error) throw error

          // Update local state
          set((state) => ({
            processors: state.processors.map((p) =>
              p.id === id ? { ...p, ...updateData } : p
            ),
          }))

          logger.debug('[PaymentProcessorsSettings] Processor updated successfully')
          return { success: true }
        } catch (error: any) {
          const errorMsg = error.message || 'Failed to update processor'
          logger.error('[PaymentProcessorsSettings] Update error:', error)

          Sentry.captureException(error, {
            level: 'error',
            tags: { operation: 'update_processor' },
          })

          return { success: false, error: errorMsg }
        }
      },

      /**
       * Delete a payment processor
       */
      deleteProcessor: async (id: string) => {
        try {
          logger.debug('[PaymentProcessorsSettings] Deleting processor:', id)

          const { error } = await supabase
            .from('payment_processors')
            .delete()
            .eq('id', id)

          if (error) throw error

          // Remove from local state
          set((state) => ({
            processors: state.processors.filter((p) => p.id !== id),
          }))

          logger.debug('[PaymentProcessorsSettings] Processor deleted successfully')
          return { success: true }
        } catch (error: any) {
          const errorMsg = error.message || 'Failed to delete processor'
          logger.error('[PaymentProcessorsSettings] Delete error:', error)

          Sentry.captureException(error, {
            level: 'error',
            tags: { operation: 'delete_processor' },
          })

          return { success: false, error: errorMsg }
        }
      },

      /**
       * Test connection to a payment processor
       */
      testConnection: async (id: string) => {
        try {
          logger.debug('[PaymentProcessorsSettings] Testing connection for processor:', id)

          const processor = get().processors.find((p) => p.id === id)
          if (!processor) {
            return { success: false, error: 'Processor not found' }
          }

          // For now, just validate that the processor has required config
          // Real testing would call the actual payment processor API
          const isConfigured = processor.config && Object.keys(processor.config).length > 0

          if (!isConfigured) {
            return {
              success: false,
              error: 'Processor configuration incomplete',
            }
          }

          logger.debug('[PaymentProcessorsSettings] Connection test passed')
          return {
            success: true,
            message: 'Configuration validated successfully',
          }
        } catch (error: any) {
          const errorMsg = error.message || 'Connection test failed'
          logger.error('[PaymentProcessorsSettings] Test connection error:', error)

          Sentry.captureException(error, {
            level: 'error',
            tags: { operation: 'test_connection' },
          })

          return { success: false, error: errorMsg }
        }
      },

      /**
       * Set a processor as the default (primary) processor
       */
      setAsDefault: async (id: string, vendorId: string) => {
        try {
          logger.debug('[PaymentProcessorsSettings] Setting processor as default:', id)

          // First, unset all other processors as primary
          await supabase
            .from('payment_processors')
            .update({ is_primary: false })
            .eq('vendor_id', vendorId)

          // Then set the selected one as primary
          const { error } = await supabase
            .from('payment_processors')
            .update({ is_primary: true })
            .eq('id', id)

          if (error) throw error

          // Update local state
          set((state) => ({
            processors: state.processors.map((p) => ({
              ...p,
              is_primary: p.id === id,
            })),
          }))

          logger.debug('[PaymentProcessorsSettings] Default processor set successfully')
          return { success: true }
        } catch (error: any) {
          const errorMsg = error.message || 'Failed to set default processor'
          logger.error('[PaymentProcessorsSettings] Set default error:', error)

          Sentry.captureException(error, {
            level: 'error',
            tags: { operation: 'set_default_processor' },
          })

          return { success: false, error: errorMsg }
        }
      },

      /**
       * Toggle processor active/inactive status
       */
      toggleProcessorStatus: async (id: string, active: boolean) => {
        try {
          logger.debug('[PaymentProcessorsSettings] Toggling processor status:', id, active)

          const { error } = await supabase
            .from('payment_processors')
            .update({ is_active: active })
            .eq('id', id)

          if (error) throw error

          // Update local state
          set((state) => ({
            processors: state.processors.map((p) =>
              p.id === id ? { ...p, is_active: active } : p
            ),
          }))

          logger.debug('[PaymentProcessorsSettings] Processor status toggled successfully')
          return { success: true }
        } catch (error: any) {
          const errorMsg = error.message || 'Failed to toggle processor status'
          logger.error('[PaymentProcessorsSettings] Toggle status error:', error)

          Sentry.captureException(error, {
            level: 'error',
            tags: { operation: 'toggle_processor_status' },
          })

          return { success: false, error: errorMsg }
        }
      },

      reset: () => set(initialState),
    }),
    { name: 'PaymentProcessorsSettingsStore' }
  )
)

// ============================================================================
// SELECTORS (Apple Engineering Standard)
// ============================================================================

export const usePaymentProcessors = () =>
  usePaymentProcessorsSettingsStore((state) => state.processors)

export const usePaymentProcessorsLoading = () =>
  usePaymentProcessorsSettingsStore((state) => state.isLoading)

export const usePaymentProcessorsError = () =>
  usePaymentProcessorsSettingsStore((state) => state.error)

// Get payment processors state with shallow comparison
export const usePaymentProcessorsState = () =>
  usePaymentProcessorsSettingsStore(
    useShallow((state) => ({
      processors: state.processors,
      isLoading: state.isLoading,
      error: state.error,
    }))
  )

// ============================================================================
// ACTIONS (Export as plain object with getters - Apple Pattern)
// ============================================================================

export const paymentProcessorsActions = {
  get loadProcessors() { return usePaymentProcessorsSettingsStore.getState().loadProcessors },
  get createProcessor() { return usePaymentProcessorsSettingsStore.getState().createProcessor },
  get updateProcessor() { return usePaymentProcessorsSettingsStore.getState().updateProcessor },
  get deleteProcessor() { return usePaymentProcessorsSettingsStore.getState().deleteProcessor },
  get testConnection() { return usePaymentProcessorsSettingsStore.getState().testConnection },
  get setAsDefault() { return usePaymentProcessorsSettingsStore.getState().setAsDefault },
  get toggleProcessorStatus() { return usePaymentProcessorsSettingsStore.getState().toggleProcessorStatus },
  get reset() { return usePaymentProcessorsSettingsStore.getState().reset },
}

// Legacy hook for backward compatibility
export const usePaymentProcessorsActions = () => paymentProcessorsActions
