/**
 * Vendors Service
 * Database operations for vendor settings management
 */

import { supabase } from '@/lib/supabase/client'
import type { Vendor } from '@/types/pos'
import { logger } from '@/utils/logger'

export interface UpdateVendorInput {
  store_name?: string
  logo_url?: string | null
  ecommerce_url?: string | null
  // Shipping settings
  free_shipping_enabled?: boolean
  free_shipping_threshold?: number | null
  default_shipping_cost?: number | null
}

/**
 * Get a vendor by ID
 */
export async function getVendor(
  vendorId: string
): Promise<{ data: Vendor | null; error: string | null }> {
  try {
    logger.debug('[VendorsService] Fetching vendor:', { vendorId })

    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single()

    if (error) {
      logger.error('[VendorsService] Failed to fetch vendor:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    logger.error('[VendorsService] Get vendor error:', err)
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch vendor',
    }
  }
}

/**
 * Update a vendor's settings
 */
export async function updateVendor(
  vendorId: string,
  updates: UpdateVendorInput
): Promise<{ data: Vendor | null; error: string | null }> {
  try {
    logger.debug('[VendorsService] Updating vendor:', { vendorId, updates })

    const { data, error } = await supabase
      .from('vendors')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select()
      .single()

    if (error) {
      logger.error('[VendorsService] Failed to update vendor:', error)
      return { data: null, error: error.message }
    }

    logger.info('[VendorsService] Vendor updated successfully:', data.id)
    return { data, error: null }
  } catch (err) {
    logger.error('[VendorsService] Update vendor error:', err)
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to update vendor',
    }
  }
}
