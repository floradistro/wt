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
  sku?: string
  price?: number
  image_url?: string | null
  featured_image?: string | null
  vendor_logo_url?: string | null
  primary_category?: { name: string; slug: string }
  primary_category_id?: string
  inventory_quantity?: number

  // LIVE PRICING TEMPLATE - SINGLE SOURCE OF TRUTH
  pricing_template_id?: string | null
  pricing_template?: {
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
  } | null

  // Legacy fields (deprecated - use pricing_template instead)
  /** @deprecated Use pricing_template instead */
  meta_data?: {
    pricing_mode?: 'single' | 'tiered'
    pricing_tiers?: PricingTier[]
  }
  /** @deprecated Use pricing_template instead */
  pricing_data?: {
    mode?: 'single' | 'tiered'
    tiers?: PricingTier[]
    template_id?: string | null
  }
  /** @deprecated Use pricing_template.default_tiers instead */
  pricing_tiers?: PricingTier[]

  // Product properties
  regular_price?: number
  cost_price?: number
  sale_price?: number | null
  on_sale?: boolean
  stock_quantity?: number
  total_stock?: number
  custom_fields?: Record<string, any>
  category?: string | null
  fields?: ProductField[]
  vendor?: {
    id: string
    store_name: string
    logo_url: string | null
  } | null
  description?: string | null
  short_description?: string | null
  inventory_id?: string
  // Multi-location inventory support
  inventory?: InventoryItem[]
}

export interface ProductVariant {
  product_id: string
  product_name: string
  primary_category_id: string
  parent_product_image: string | null
  variant_template_id: string
  variant_name: string
  variant_slug: string
  variant_icon: string | null
  conversion_ratio: number
  conversion_unit: string
  pricing_template_id: string | null
  featured_image_url: string | null
  indicator_icon_url: string | null
  thumbnail_url: string | null
  share_parent_inventory: boolean
  track_separate_inventory: boolean
  allow_on_demand_conversion: boolean
  is_enabled: boolean
  display_order: number
  template_metadata: Record<string, any> | null
  product_metadata: Record<string, any> | null
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
  // Variant support
  variantTemplateId?: string // ID of the category_variant_template (for variant products)
  variantName?: string // Display name of the variant (e.g., "Pre-Roll")
  conversionRatio?: number // Conversion ratio for inventory deduction (e.g., 0.7g)
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

// =====================================================
// INVENTORY TRANSFER TYPES
// =====================================================

export type TransferStatus =
  | 'draft'           // Being created, can be edited
  | 'approved'        // Approved, holds created, ready to ship
  | 'in_transit'      // Shipped but not yet received
  | 'completed'       // Received at destination
  | 'cancelled'       // Cancelled before completion

export type ItemCondition = 'good' | 'damaged' | 'expired' | 'rejected'

export interface InventoryTransfer {
  id: string
  vendor_id: string
  transfer_number: string

  source_location_id: string
  destination_location_id: string
  source_location?: Location
  destination_location?: Location

  status: TransferStatus

  notes?: string | null
  tracking_number?: string | null

  // Timestamps
  shipped_at?: string | null
  received_at?: string | null
  cancelled_at?: string | null

  // User tracking
  created_by_user_id?: string | null
  approved_by_user_id?: string | null
  received_by_user_id?: string | null
  cancelled_by_user_id?: string | null

  created_at: string
  updated_at: string

  // Relations
  items?: InventoryTransferItem[]
  created_by_user?: User | null
  received_by_user?: User | null
}

export interface InventoryTransferItem {
  id: string
  transfer_id: string
  product_id: string

  quantity: number
  received_quantity: number

  condition?: ItemCondition | null
  condition_notes?: string | null

  created_at: string
  updated_at: string

  // Relations
  product?: Product
}

export interface CreateTransferInput {
  source_location_id: string
  destination_location_id: string
  items: Array<{
    product_id: string
    quantity: number
  }>
  notes?: string
}

export interface ReceiveTransferInput {
  items: Array<{
    item_id: string
    received_quantity: number
    condition: ItemCondition
    notes?: string
  }>
}
