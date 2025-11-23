/**
 * Campaign & Deals Types
 */

export interface Campaign {
  id: string
  vendor_id: string
  name: string
  description?: string
  campaign_type: 'deal' | 'promotion' | 'discount'
  discount_type?: 'percentage' | 'fixed_amount' | 'bogo'
  discount_value?: number
  min_purchase_amount?: number
  max_discount_amount?: number
  applicable_categories?: string[]
  applicable_products?: string[]
  start_date: string
  end_date?: string
  is_active: boolean
  is_stackable: boolean
  priority?: number
  created_at: string
  updated_at: string
}
