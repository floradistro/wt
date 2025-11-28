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
  featured_image?: string | null
  created_at: string
  updated_at: string
}

export interface FieldVisibilityConfig {
  shop: boolean
  product_page: boolean
  pos: boolean
  tv_menu: boolean
}
