/**
 * Locations Service
 * Database operations for location management
 */

import { supabase } from '@/lib/supabase/client'
import type { Location } from '@/types/pos'
import { logger } from '@/utils/logger'

export interface UpdateLocationInput {
  name?: string
  address_line1?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  tax_rate?: number
  tax_name?: string
  is_active?: boolean
}

/**
 * Update a location's information
 */
export async function updateLocation(
  locationId: string,
  updates: UpdateLocationInput
): Promise<{ data: Location | null; error: string | null }> {
  try {
    logger.debug('[LocationsService] Updating location:', { locationId, updates })

    const { data, error } = await supabase
      .from('locations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', locationId)
      .select()
      .single()

    if (error) {
      logger.error('[LocationsService] Failed to update location:', error)
      return { data: null, error: error.message }
    }

    logger.info('[LocationsService] Location updated successfully:', data.id)
    return { data, error: null }
  } catch (err) {
    logger.error('[LocationsService] Update location error:', err)
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to update location',
    }
  }
}

/**
 * Get all locations for a vendor
 * Note: Native app shows ALL locations regardless of is_active status.
 * The is_active field only controls online storefront visibility.
 */
export async function getLocations(
  vendorId: string
): Promise<{ data: Location[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      logger.error('[LocationsService] Failed to fetch locations:', error)
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    logger.error('[LocationsService] Get locations error:', err)
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch locations',
    }
  }
}
