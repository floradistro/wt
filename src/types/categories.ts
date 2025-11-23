/**
 * Category Management Types
 */

export interface Category {
  id: string
  vendor_id: string
  name: string
  slug: string
  description?: string
  parent_id?: string
  sort_order?: number
  is_active: boolean
  product_count?: number
  created_at: string
  updated_at: string
}

export interface FieldVisibilityConfig {
  field_name: string
  is_visible: boolean
  is_required: boolean
  display_order?: number
}
