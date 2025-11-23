/**
 * Suppliers Management Store - Supplier CRUD Operations
 * Apple Pattern: Business logic in store (not in components)
 *
 * Migrated from useSuppliers hook to Zustand store for zero prop drilling
 * All supplier management operations accessible via store actions
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

// ============================================================================
// TYPES
// ============================================================================

export interface Supplier {
  id: string
  vendor_id: string
  external_name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SuppliersManagementState {
  // Data
  suppliers: Supplier[]
  isLoading: boolean
  error: string | null

  // Actions
  loadSuppliers: (authUserId: string) => Promise<void>
  createSupplier: (supplierData: {
    external_name: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    address?: string
    notes?: string
  }) => Promise<{ success: boolean; error?: string; supplier?: Supplier }>
  updateSupplier: (supplierId: string, updates: Partial<Supplier>) => Promise<{ success: boolean; error?: string }>
  deleteSupplier: (supplierId: string) => Promise<{ success: boolean; error?: string }>
  toggleSupplierStatus: (supplierId: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>
  reset: () => void
}

const initialState = {
  suppliers: [],
  isLoading: false,
  error: null,
}

// ============================================================================
// STORE
// ============================================================================

export const useSuppliersManagementStore = create<SuppliersManagementState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSuppliers: async (authUserId: string) => {
        set({ isLoading: true, error: null })

        try {
          logger.info('[SuppliersManagementStore] Loading suppliers', { authUserId })

          // Get vendor ID
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('vendor_id')
            .eq('auth_user_id', authUserId)
            .maybeSingle()

          if (userError || !userData) {
            throw new Error('User record not found')
          }
          if (!userData?.vendor_id) throw new Error('No vendor ID found')

          // Fetch all suppliers (including inactive for management)
          const { data, error: suppliersError } = await supabase
            .from('suppliers')
            .select('*')
            .eq('vendor_id', userData.vendor_id)
            .order('external_name')

          if (suppliersError) throw suppliersError

          set({ suppliers: data || [], isLoading: false })
          logger.info('[SuppliersManagementStore] Suppliers loaded successfully', { count: data?.length || 0 })
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load suppliers'
          logger.error('[SuppliersManagementStore] Failed to load suppliers', { error: err })
          set({ error: errorMessage, suppliers: [], isLoading: false })
        }
      },

      createSupplier: async (supplierData) => {
        try {
          // Get auth session
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.user?.id) throw new Error('Not authenticated')

          // Get vendor ID
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('vendor_id')
            .eq('auth_user_id', session.user.id)
            .maybeSingle()

          if (userError || !userData) {
            throw new Error('User record not found')
          }

          // Create supplier
          const { data: newSupplier, error: insertError } = await supabase
            .from('suppliers')
            .insert({
              external_name: supplierData.external_name,
              contact_name: supplierData.contact_name || null,
              contact_email: supplierData.contact_email || null,
              contact_phone: supplierData.contact_phone || null,
              address: supplierData.address || null,
              notes: supplierData.notes || null,
              vendor_id: userData.vendor_id,
              is_active: true,
            })
            .select()
            .single()

          if (insertError) throw insertError

          // Reload suppliers after create
          await get().loadSuppliers(session.user.id)

          return { success: true, supplier: newSupplier }
        } catch (err) {
          logger.error('[SuppliersManagementStore] Failed to create supplier', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to create supplier',
          }
        }
      },

      updateSupplier: async (supplierId, updates) => {
        try {
          const { error: updateError } = await supabase
            .from('suppliers')
            .update(updates)
            .eq('id', supplierId)

          if (updateError) throw updateError

          // Reload suppliers after update
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user?.id) {
            await get().loadSuppliers(session.user.id)
          }

          return { success: true }
        } catch (err) {
          logger.error('[SuppliersManagementStore] Failed to update supplier', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update supplier',
          }
        }
      },

      deleteSupplier: async (supplierId) => {
        try {
          // Hard delete - permanently remove from database
          const { error: deleteError } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', supplierId)

          if (deleteError) throw deleteError

          // Reload suppliers after delete
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user?.id) {
            await get().loadSuppliers(session.user.id)
          }

          return { success: true }
        } catch (err) {
          logger.error('[SuppliersManagementStore] Failed to delete supplier', { error: err })
          return {
            success: false,
            error: err instanceof Error ? err.message : 'Failed to delete supplier',
          }
        }
      },

      toggleSupplierStatus: async (supplierId, isActive) => {
        return get().updateSupplier(supplierId, { is_active: isActive })
      },

      reset: () => set(initialState),
    }),
    { name: 'SuppliersManagementStore' }
  )
)

// ============================================================================
// FOCUSED SELECTORS (with useShallow to prevent infinite loops)
// ============================================================================

/**
 * Get all suppliers
 */
export const useSuppliers = () =>
  useSuppliersManagementStore((state) => state.suppliers)

/**
 * Get active suppliers only
 */
export const useActiveSuppliers = () =>
  useSuppliersManagementStore((state) => state.suppliers.filter((s) => s.is_active))

/**
 * Get loading state
 */
export const useSuppliersLoading = () =>
  useSuppliersManagementStore((state) => state.isLoading)

/**
 * Get error state
 */
export const useSuppliersError = () =>
  useSuppliersManagementStore((state) => state.error)

/**
 * Get all supplier management actions
 * CRITICAL: Uses useShallow to prevent infinite loops
 */
export const useSuppliersActions = () =>
  useSuppliersManagementStore(
    useShallow((state) => ({
      loadSuppliers: state.loadSuppliers,
      createSupplier: state.createSupplier,
      updateSupplier: state.updateSupplier,
      deleteSupplier: state.deleteSupplier,
      toggleSupplierStatus: state.toggleSupplierStatus,
    }))
  )

/**
 * Get a specific supplier by ID
 */
export const useSupplierById = (supplierId: string) =>
  useSuppliersManagementStore((state) => state.suppliers.find((s) => s.id === supplierId))
