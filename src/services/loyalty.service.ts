/**
 * Loyalty Service
 * Apple Engineering: One clear responsibility - Fetch loyalty program settings
 *
 * CLEANED UP: Removed all unused/orphaned functions
 * - Server-side calculations now happen in edge function
 * - Point updates handled by atomic database functions
 * - This service ONLY fetches program configuration
 */

import { supabase } from '@/lib/supabase/client'

export interface LoyaltyProgram {
  id: string
  vendor_id: string
  name: string
  description?: string
  is_active: boolean
  point_value: number // Dollar value per point (e.g., 0.01 = $0.01 per point)
  points_per_dollar: number // Points earned per dollar spent
  min_redemption_points?: number
  points_expiry_days?: number
  created_at: string
  updated_at: string
}

/**
 * Get loyalty program for a vendor
 *
 * This is the ONLY function needed from this service.
 * All other loyalty operations happen server-side in:
 * - Edge function: calculate_loyalty_points_to_earn (server-side calculation)
 * - Edge function: update_customer_loyalty_points_atomic (server-side update)
 * - Database function: adjust_customer_loyalty_points (manual adjustments)
 */
export async function getLoyaltyProgram(vendorId: string): Promise<LoyaltyProgram | null> {
  const { data, error } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load loyalty program: ${error.message}`)
  }

  return data
}

/**
 * Get customer's loyalty points balance
 * Used for displaying current balance in UI
 */
export async function getCustomerLoyaltyBalance(customerId: string): Promise<number> {
  const { data, error} = await supabase
    .from('customers')
    .select('loyalty_points')
    .eq('id', customerId)
    .eq('is_active', true)
    .single()

  if (error) {
    throw new Error(`Failed to get loyalty balance: ${error.message}`)
  }

  return data?.loyalty_points || 0
}

/**
 * Calculate discount amount from points (client-side preview only)
 * Server validates this calculation before applying
 */
export function calculateLoyaltyDiscount(
  pointsToRedeem: number,
  loyaltyProgram: LoyaltyProgram | null
): number {
  if (!loyaltyProgram || !loyaltyProgram.is_active) {
    return 0
  }

  return pointsToRedeem * loyaltyProgram.point_value
}

/**
 * Export service object for easier imports
 */
export const loyaltyService = {
  getLoyaltyProgram,
  getCustomerLoyaltyBalance,
  calculateLoyaltyDiscount,
}
