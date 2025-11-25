/**
 * POS Type Definitions
 * Shared types for all POS components and hooks
 */

export interface Vendor {
  id: string
  store_name: string
  logo_url: string | null
}

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role?: string
  vendors?: Vendor | Vendor[]
}

export interface Customer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  display_name: string | null
  date_of_birth: string | null
  loyalty_points: number
  loyalty_tier: string
  vendor_customer_number: string
}

export interface Location {
  id: string
  name: string
  address_line1?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  tax_rate?: number
  tax_name?: string
  is_primary: boolean
}

export interface PricingTier {
  qty: number
  price: string | number
  weight?: string
  label?: string
  break_id?: string
  sort_order?: number
}

export interface ProductField {
  label: string
  value: string
  type: 'text' | 'number'
}

export interface InventoryItem {
  id: string
  location_id: string
  location_name: string
  quantity: number
  available_quantity: number
  reserved_quantity: number
}

export interface Product {
  id: string
  name: string
  price?: number
  image_url?: string | null
  vendor_logo_url?: string | null
  primary_category?: { name: string; slug: string }
  inventory_quantity?: number
  meta_data?: {
    pricing_mode?: 'single' | 'tiered'
    pricing_tiers?: PricingTier[]
  }
  regular_price?: number
  // Additional properties from POSScreen
  category?: string | null
  fields?: ProductField[]
  vendor?: {
    id: string
    store_name: string
    logo_url: string | null
  } | null
  pricing_tiers?: PricingTier[]
  description?: string | null
  short_description?: string | null
  inventory_id?: string
  // Multi-location inventory support
  inventory?: InventoryItem[]
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number // Number of THIS tier in cart (usually 1)
  tierLabel?: string
  tierQuantity: number // CRITICAL: REQUIRED! Actual quantity to deduct from inventory (e.g., 28 for "28g", 3.5 for "3.5g", 2 for "2 units")
  productName?: string
  productId: string
  inventoryId: string
  availableInventory?: number // STEVE JOBS: Track inventory to prevent overselling
  // Product identification fields
  sku?: string
  productSku?: string
  tierName?: string
  tier?: string
  // Staff discount fields
  manualDiscountType?: 'percentage' | 'amount'
  manualDiscountValue?: number
  adjustedPrice?: number
  originalPrice?: number
}

export interface SessionInfo {
  locationId: string
  locationName: string
  registerId: string
  registerName: string
  sessionId?: string
  taxRate?: number
  taxName?: string
}

export interface LoyaltyProgram {
  id: string
  vendor_id: string
  name: string
  description?: string
  is_active: boolean
  point_value: number
  points_per_dollar: number
  min_redemption_points?: number
  points_expiry_days?: number
  allow_points_on_discounted_items?: boolean
  points_on_tax?: boolean
  tiers?: any
  created_at: string
  updated_at: string
}

export interface PaymentData {
  paymentMethod: 'cash' | 'card'
  cashTendered?: number
  changeGiven?: number
  authorizationCode?: string
  transactionId?: string
  cardType?: string
  cardLast4?: string
}
