/**
 * Supplier Management Types
 */

export interface Supplier {
  id: string
  vendor_id: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}
