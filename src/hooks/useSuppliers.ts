/**
 * useSuppliers Hook
 * Fetches suppliers for the current vendor
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

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

export function useSuppliers() {
  const { user } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSuppliers = useCallback(async () => {
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

      // Fetch all suppliers (including inactive for management)
      const { data, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('vendor_id', userData.vendor_id)
        .order('external_name')

      if (suppliersError) throw suppliersError

      setSuppliers(data || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load suppliers'
      logger.error('Failed to load suppliers', { error: err })
      setError(errorMessage)
      setSuppliers([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  async function createSupplier(supplierData: {
    external_name: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    address?: string
    notes?: string
  }): Promise<{ success: boolean; error?: string; supplier?: Supplier }> {
    try {
      if (!user?.email) throw new Error('Not authenticated')

      // Get vendor ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

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

      await loadSuppliers()
      return { success: true, supplier: newSupplier }
    } catch (err) {
      logger.error('Failed to create supplier', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create supplier',
      }
    }
  }

  async function updateSupplier(
    supplierId: string,
    updates: Partial<Supplier>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: updateError } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', supplierId)

      if (updateError) throw updateError

      await loadSuppliers()
      return { success: true }
    } catch (err) {
      logger.error('Failed to update supplier', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update supplier',
      }
    }
  }

  async function deleteSupplier(supplierId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Hard delete - permanently remove from database
      const { error: deleteError } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId)

      if (deleteError) throw deleteError

      await loadSuppliers()
      return { success: true }
    } catch (err) {
      logger.error('Failed to delete supplier', { error: err })
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete supplier',
      }
    }
  }

  async function toggleSupplierStatus(
    supplierId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    return updateSupplier(supplierId, { is_active: isActive })
  }

  return {
    suppliers,
    isLoading,
    error,
    reload: loadSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    toggleSupplierStatus,
  }
}
