/**
 * usePricingTemplates Hook
 * Manages pricing tier templates
 * Apple Engineering: Consistent with useProducts pricing pattern
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

export type QualityTier = 'exotic' | 'top-shelf' | 'mid-shelf' | 'value'

export interface PriceBreak {
  id: string // break_id
  label: string
  qty: number
  unit: string
  price: number | null
  sort_order: number
}

export interface PricingTemplate {
  id: string
  vendor_id: string | null
  name: string
  slug: string
  description: string | null
  quality_tier: QualityTier | null
  default_tiers: PriceBreak[]
  applicable_to_categories: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UsePricingTemplatesOptions {
  categoryId?: string | null
  qualityTier?: QualityTier
}

export function usePricingTemplates(options: UsePricingTemplatesOptions = {}) {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<PricingTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!user?.email) {
        throw new Error('User not authenticated')
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      logger.info('Loading pricing templates', { vendorId: userData.vendor_id, options })

      let query = supabase
        .from('pricing_tier_templates')
        .select('*')
        .eq('vendor_id', userData.vendor_id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (options.qualityTier) {
        query = query.eq('quality_tier', options.qualityTier)
      }

      const { data, error: templatesError } = await query

      if (templatesError) throw templatesError

      let processedTemplates = (data || []) as PricingTemplate[]

      // Filter by category if specified
      if (options.categoryId) {
        processedTemplates = processedTemplates.filter(template => {
          if (!template.applicable_to_categories) return false
          return template.applicable_to_categories.includes(options.categoryId!)
        })
      }

      setTemplates(processedTemplates)
      logger.info('Pricing templates loaded', { count: processedTemplates.length })
    } catch (err) {
      logger.error('Failed to load pricing templates', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load pricing templates')
    } finally {
      setIsLoading(false)
    }
  }, [user, options.categoryId, options.qualityTier])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  return {
    templates,
    isLoading,
    error,
    reload: loadTemplates,
  }
}

/**
 * Default price breaks for cannabis products
 * Steve Jobs would approve: sensible defaults
 */
export const DEFAULT_PRICE_BREAKS: Omit<PriceBreak, 'price'>[] = [
  { id: '1g', label: '1 gram', qty: 1, unit: 'g', sort_order: 1 },
  { id: '3_5g', label: '3.5g (⅛oz)', qty: 3.5, unit: 'g', sort_order: 2 },
  { id: '7g', label: '7g (¼oz)', qty: 7, unit: 'g', sort_order: 3 },
  { id: '14g', label: '14g (½oz)', qty: 14, unit: 'g', sort_order: 4 },
  { id: '28g', label: '28g (1oz)', qty: 28, unit: 'g', sort_order: 5 },
]
