/**
 * Product Management Types
 * Extended product types for product management screens
 */

import type { Product as BaseProduct, PricingTier } from './pos'

// Re-export base types
export type { Product, PricingTier, ProductField } from './pos'

// Extended types for product management
export interface PricingData {
  mode: 'single' | 'tiered'
  tiers: PricingTier[]
}
