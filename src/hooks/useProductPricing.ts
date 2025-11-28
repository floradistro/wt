/**
 * useProductPricing - SINGLE SOURCE OF TRUTH for Product Pricing
 *
 * Mission Critical: ALL channels MUST show identical pricing
 * - POS
 * - Product Detail
 * - Edit Mode
 * - Cart
 * - Everywhere
 *
 * How it works:
 * 1. Product stores ONLY pricing_template_id
 * 2. This hook fetches the LIVE template
 * 3. Returns tiers directly from template
 * 4. Real-time updates when template changes
 *
 * NO COPYING. NO ORPHANED DATA. ONE SOURCE.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { PricingTier } from '@/types/products'

interface ProductPricing {
  tiers: PricingTier[]
  mode: 'single' | 'tiered'
  templateId: string | null
  templateName: string | null
  loading: boolean
}

interface PricingTemplateFromDB {
  id: string
  name: string
  default_tiers: Array<{
    id: string
    label: string
    quantity: number
    unit: string
    default_price: number
    sort_order: number
  }>
}

/**
 * Get live pricing for a product
 * @param pricingTemplateId - The pricing template ID from product.pricing_template_id
 * @returns Live pricing tiers from template
 */
export function useProductPricing(pricingTemplateId: string | null | undefined): ProductPricing {
  const [pricing, setPricing] = useState<ProductPricing>({
    tiers: [],
    mode: 'single',
    templateId: null,
    templateName: null,
    loading: true,
  })

  useEffect(() => {
    if (!pricingTemplateId) {
      setPricing({
        tiers: [],
        mode: 'single',
        templateId: null,
        templateName: null,
        loading: false,
      })
      return
    }

    let mounted = true

    async function fetchTemplate() {
      try {
        const { data, error } = await supabase
          .from('pricing_tier_templates')
          .select('id, name, default_tiers')
          .eq('id', pricingTemplateId)
          .single()

        if (error) throw error

        if (!mounted) return

        const template = data as PricingTemplateFromDB

        // Transform template tiers to PricingTier format
        const tiers: PricingTier[] = template.default_tiers
          .map((tier) => ({
            id: tier.id,
            label: tier.label,
            quantity: tier.quantity,
            unit: tier.unit,
            price: tier.default_price,
            enabled: true,
            sort_order: tier.sort_order,
          }))
          .sort((a, b) => a.sort_order - b.sort_order)

        setPricing({
          tiers,
          mode: 'tiered',
          templateId: template.id,
          templateName: template.name,
          loading: false,
        })
      } catch (error) {
        logger.error('[useProductPricing] Failed to fetch template', { error, pricingTemplateId })
        if (mounted) {
          setPricing({
            tiers: [],
            mode: 'single',
            templateId: null,
            templateName: null,
            loading: false,
          })
        }
      }
    }

    fetchTemplate()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`pricing_template:${pricingTemplateId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pricing_tier_templates',
          filter: `id=eq.${pricingTemplateId}`,
        },
        (payload) => {
          logger.info('[useProductPricing] Template updated, refreshing', {
            templateId: pricingTemplateId,
          })
          fetchTemplate()
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [pricingTemplateId])

  return pricing
}
