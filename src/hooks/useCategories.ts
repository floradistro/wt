/**
 * useCategories Hook
 * Manages category data with multi-tenant support
 * Apple Engineering: Single responsibility, clean data flow
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  vendor_id: string | null
  parent_id: string | null
  field_visibility: Record<string, FieldVisibilityConfig> | null
  created_at: string
  updated_at: string
  // Computed
  subcategories?: Category[]
  product_count?: number
}

export interface FieldVisibilityConfig {
  shop: boolean
  product_page: boolean
  pos: boolean
  tv_menu: boolean
}

interface UseCategoriesOptions {
  includeGlobal?: boolean
  parentId?: string | null
}

export function useCategories(options: UseCategoriesOptions = {}) {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!user?.email) {
        throw new Error('User not authenticated')
      }

      // Get user's vendor_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) {
        throw new Error('User record not found')
      }

      logger.info('Loading categories', { vendorId: userData.vendor_id, options })

      // Build query - Multi-tenant: vendor-specific OR global
      let query = supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (options.includeGlobal !== false) {
        // Include both vendor's categories AND global ones
        query = query.or(`vendor_id.is.null,vendor_id.eq.${userData.vendor_id}`)
      } else {
        // Only vendor's categories
        query = query.eq('vendor_id', userData.vendor_id)
      }

      if (options.parentId !== undefined) {
        if (options.parentId === null) {
          query = query.is('parent_id', null)
        } else {
          query = query.eq('parent_id', options.parentId)
        }
      }

      const { data, error: categoriesError } = await query

      if (categoriesError) throw categoriesError

      // Get product counts for each category
      const categoriesWithCounts = await Promise.all(
        (data || []).map(async (category) => {
          const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('primary_category_id', category.id)
            .eq('vendor_id', userData.vendor_id)

          return {
            ...category,
            product_count: count || 0,
          }
        })
      )

      setCategories(categoriesWithCounts)
      logger.info('Categories loaded', { count: categoriesWithCounts.length })
    } catch (err) {
      logger.error('Failed to load categories', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }, [user, options.includeGlobal, options.parentId])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  return {
    categories,
    isLoading,
    error,
    reload: loadCategories,
  }
}
