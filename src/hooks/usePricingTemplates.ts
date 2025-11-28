/**
 * Hook to load pricing templates from database
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useAuth } from '@/stores/auth.store'

export type QualityTier = 'exotic' | 'top-shelf' | 'mid-shelf' | 'value'

export interface PriceBreak {
  id: string
  label: string
  quantity: number // Using 'quantity' to match database schema
  unit: string
  default_price: number | null // Using 'default_price' to match database schema
  sort_order: number
}

export interface PricingTemplate {
  id: string
  name: string
  description?: string
  quality_tier?: QualityTier
  default_tiers: PriceBreak[]
}

export const DEFAULT_PRICE_BREAKS: Omit<PriceBreak, 'default_price'>[] = [
  { id: '1g', label: '1 gram', quantity: 1, unit: 'g', sort_order: 1 },
  { id: '3_5g', label: '3.5g (Eighth)', quantity: 3.5, unit: 'g', sort_order: 2 },
  { id: '7g', label: '7g (Quarter)', quantity: 7, unit: 'g', sort_order: 3 },
  { id: '14g', label: '14g (Half Oz)', quantity: 14, unit: 'g', sort_order: 4 },
  { id: '28g', label: '28g (Ounce)', quantity: 28, unit: 'g', sort_order: 5 },
]

interface UsePricingTemplatesOptions {
  categoryId?: string
}

export function usePricingTemplates(options?: UsePricingTemplatesOptions) {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<PricingTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadTemplates = useCallback(async () => {
    if (!user?.email || !options?.categoryId) {
      setTemplates([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (userError || !userData) throw userError || new Error('User record not found')

      const { data, error } = await supabase
        .from('pricing_tier_templates')
        .select('*')
        .eq('category_id', options.categoryId)
        .eq('vendor_id', userData.vendor_id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      setTemplates(data || [])
      logger.info('Loaded pricing templates', {
        categoryId: options.categoryId,
        count: data?.length || 0,
      })
    } catch (error) {
      logger.error('Failed to load pricing templates:', error)
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [user, options?.categoryId])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  return {
    templates,
    isLoading,
    reload: loadTemplates,
  }
}
