/**
 * User Management Types
 * Shared types for user management, locations, and permissions
 */

export interface UserWithLocations {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  created_at: string
  updated_at: string
  user_locations?: UserLocationAccess[]
}

export interface UserLocationAccess {
  id: string
  user_id: string
  location_id: string
  access_level: string
  can_open_register: boolean
  can_close_register: boolean
  can_manage_inventory: boolean
  created_at: string
  location?: {
    id: string
    name: string
    address_line1?: string
    city?: string
    state?: string
  }
}
