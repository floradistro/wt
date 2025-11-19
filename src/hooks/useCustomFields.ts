/**
 * useCustomFields Hook
 * Manages product custom fields with inheritance logic
 * Apple Engineering: Smart defaults, "it just works"
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'url' | 'email'
export type FieldSource = 'category' | 'parent' | 'global'

export interface CustomField {
  id: string
  field_id: string
  label: string
  type: FieldType
  required: boolean
  placeholder: string | null
  description: string | null
  options: string[] | null
  category_id: string | null
  vendor_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Computed
  inherited?: boolean
  source?: FieldSource
}

interface UseCustomFieldsOptions {
  categoryId?: string | null
  includeInherited?: boolean
}

export function useCustomFields(options: UseCustomFieldsOptions = {}) {
  const { user } = useAuth()
  const [fields, setFields] = useState<CustomField[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFields = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!user?.email) {
        throw new Error('User not authenticated')
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) {
        throw new Error('User record not found')
      }

      logger.info('Loading custom fields', { vendorId: userData.vendor_id, options })

      // Get all fields for vendor (using vendor_product_fields table)
      let query = supabase
        .from('vendor_product_fields')
        .select('*')
        .eq('vendor_id', userData.vendor_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (options.categoryId && !options.includeInherited) {
        // Only fields for this specific category
        query = query.eq('category_id', options.categoryId)
      }

      const { data, error: fieldsError } = await query

      if (fieldsError) throw fieldsError

      let processedFields = (data || []) as CustomField[]

      // Handle inheritance if category specified and includeInherited is true
      if (options.categoryId && options.includeInherited) {
        const categoryFields = processedFields.filter(f => f.category_id === options.categoryId)
        const globalFields = processedFields.filter(f => !f.category_id)

        // Mark category-specific fields
        const categorizedFields = categoryFields.map(f => ({
          ...f,
          inherited: false,
          source: 'category' as FieldSource,
        }))

        // Mark global fields as inherited
        const inheritedFields = globalFields.map(f => ({
          ...f,
          inherited: true,
          source: 'global' as FieldSource,
        }))

        // Combine: category-specific first, then global
        processedFields = [...categorizedFields, ...inheritedFields]
      }

      setFields(processedFields)
      logger.info('Custom fields loaded', { count: processedFields.length })
    } catch (err) {
      logger.error('Failed to load custom fields', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load custom fields')
    } finally {
      setIsLoading(false)
    }
  }, [user, options.categoryId, options.includeInherited])

  useEffect(() => {
    loadFields()
  }, [loadFields])

  return {
    fields,
    isLoading,
    error,
    reload: loadFields,
  }
}

/**
 * Utility: Generate field_id from label
 * Jobs-worthy auto-generation
 */
export function generateFieldId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
