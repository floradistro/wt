/**
 * Customers Service
 *
 * Handles all customer operations using Supabase directly.
 * Use this instead of calling /api/customers
 */

import { supabase } from '@/lib/supabase/client'
import { normalizePhone, normalizeEmail } from '@/utils/data-normalization'
import { logger } from '@/utils/logger'

export interface Customer {
  id: string
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  full_name?: string
  loyalty_points: number
  total_spent: number
  total_orders: number
  vendor_id?: string
  created_at: string
  updated_at: string
}

export interface CustomerWithOrders extends Customer {
  recent_orders?: {
    id: string
    order_number: string
    total_amount: number
    created_at: string
  }[]
}

/**
 * Get all customers
 * Smart search across ALL fields with NO LIMITS
 * Searches: first_name, last_name, middle_name, display_name, email, phone
 * Only returns active customers by default (is_active = true)
 */
export async function getCustomers(params?: {
  limit?: number
  searchTerm?: string
  vendorId?: string
  includeInactive?: boolean
}): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  // Filter active customers only (unless explicitly requested)
  if (!params?.includeInactive) {
    query = query.eq('is_active', true)
  }

  if (params?.vendorId) {
    query = query.eq('vendor_id', params.vendorId)
  }

  if (params?.searchTerm) {
    const term = params.searchTerm.trim()
    // Normalize phone number for better search matching
    const normalizedPhone = normalizePhone(term)

    // Build search conditions
    const searchConditions = [
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
      `middle_name.ilike.%${term}%`,
      `display_name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
    ]

    // Add normalized phone search if applicable
    if (normalizedPhone && normalizedPhone !== term) {
      searchConditions.push(`phone.ilike.%${normalizedPhone}%`)
    }

    query = query.or(searchConditions.join(','))
  }

  // Override Supabase default limit (1000) to get ALL customers from vendor
  query = query.limit(100000)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch customers: ${error.message}`)
  }

  return data || []
}

/**
 * Get customer by ID
 * Only returns active customers by default (is_active = true)
 */
export async function getCustomerById(customerId: string, includeInactive = false): Promise<Customer> {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)

  // Filter active only unless explicitly requested
  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query.single()

  if (error) {
    throw new Error(`Failed to fetch customer: ${error.message}`)
  }

  return data
}

/**
 * Get customer by phone number (for POS lookup)
 * Only returns active customers (is_active = true)
 */
export async function getCustomerByPhone(phone: string, vendorId?: string): Promise<Customer | null> {
  // Normalize phone number using centralized utility
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  let query = supabase
    .from('customers')
    .select('*')
    .eq('phone', normalized)
    .eq('is_active', true) // Only active customers

  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  const { data, error } = await query.single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No customer found
      return null
    }
    throw new Error(`Failed to fetch customer by phone: ${error.message}`)
  }

  return data
}

/**
 * Get customer by email
 * Only returns active customers (is_active = true)
 */
export async function getCustomerByEmail(email: string, vendorId?: string): Promise<Customer | null> {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('is_active', true) // Only active customers

  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  const { data, error } = await query.single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch customer by email: ${error.message}`)
  }

  return data
}

/**
 * Search customers (for POS and Customer Screen)
 * Smart search across ALL fields with NO LIMITS
 * Searches: first_name, last_name, middle_name, display_name, email, phone
 * Phone numbers are normalized (formatting removed) for better matching
 * Only returns active customers (is_active = true)
 */
export async function searchCustomers(
  searchTerm: string,
  _limit?: number,
  vendorId?: string
): Promise<Customer[]> {
  const term = searchTerm.trim()
  if (!term) return []

  // Normalize phone numbers using centralized utility
  const normalizedPhone = normalizePhone(term)
  const isPhoneSearch = /^\d+$/.test(normalizedPhone || term) && (normalizedPhone?.length || term.length) >= 3

  // Build comprehensive search conditions
  const searchConditions = [
    `first_name.ilike.%${term}%`,
    `last_name.ilike.%${term}%`,
    `middle_name.ilike.%${term}%`,
    `display_name.ilike.%${term}%`,
    `email.ilike.%${term}%`,
  ]

  // Add phone search with normalized number for better matching
  if (isPhoneSearch && normalizedPhone) {
    searchConditions.push(`phone.ilike.%${normalizedPhone}%`)
  } else {
    searchConditions.push(`phone.ilike.%${term}%`)
  }

  let query = supabase
    .from('customers')
    .select('*')
    .eq('is_active', true) // Only active customers

  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  query = query
    .or(searchConditions.join(','))
    .order('total_spent', { ascending: false }) // Sort by best customers first
    .limit(100000) // Very high limit to ensure we get ALL customers (Supabase default is only 1000)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to search customers: ${error.message}`)
  }

  return data || []
}

/**
 * Create new customer using atomic database function
 * Features:
 * - Idempotency (retry-safe)
 * - Duplicate detection (checks email/phone)
 * - Automatic walk-in email generation
 * - Data normalization at DB level
 * - Race condition protection
 */
export async function createCustomer(params: {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  date_of_birth?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  vendor_id?: string
  idempotency_key?: string
}): Promise<Customer> {
  // Validate required fields
  if (!params.first_name?.trim() || !params.last_name?.trim()) {
    throw new Error('First name and last name are required')
  }

  if (!params.vendor_id) {
    throw new Error('Vendor ID is required')
  }

  // Call atomic database function
  logger.debug('Calling create_customer_safe RPC', {
    vendorId: params.vendor_id,
    firstName: params.first_name,
    lastName: params.last_name,
    hasEmail: !!params.email,
    hasPhone: !!params.phone,
    hasIdempotencyKey: !!params.idempotency_key,
  })

  const { data, error } = await supabase.rpc('create_customer_safe', {
    p_vendor_id: params.vendor_id,
    p_first_name: params.first_name,
    p_last_name: params.last_name,
    p_email: params.email || null,
    p_phone: params.phone || null,
    p_middle_name: params.middle_name || null,
    p_date_of_birth: params.date_of_birth || null,
    p_street_address: params.street_address || null,
    p_city: params.city || null,
    p_state: params.state || null,
    p_postal_code: params.postal_code || null,
    p_idempotency_key: params.idempotency_key || null,
  })

  logger.debug('create_customer_safe returned', {
    hasData: !!data,
    dataLength: data?.length,
    hasError: !!error,
  })

  if (error) {
    throw new Error(`Failed to create customer: ${error.message}`)
  }

  // Verify function returned data
  if (!data || data.length === 0) {
    throw new Error('Failed to create customer: no data returned')
  }

  const result = data[0]

  logger.debug('Customer creation result', {
    customerId: result.customer_id,
    created: result.created,
    duplicateFound: result.duplicate_found,
    success: result.success,
  })

  // Check if operation succeeded
  if (!result.success) {
    throw new Error('Failed to create customer: operation did not complete')
  }

  // Fetch the full customer record
  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', result.customer_id)
    .eq('is_active', true)
    .single()

  if (fetchError || !customer) {
    throw new Error(`Failed to fetch created customer: ${fetchError?.message || 'Not found'}`)
  }

  logger.debug('Customer fetched successfully', {
    customerId: customer.id,
    email: customer.email,
    phone: customer.phone,
    isWalkIn: customer.email?.includes('@walk-in.local'),
  })

  return customer
}

/**
 * Update customer
 */
export async function updateCustomer(
  customerId: string,
  updates: Partial<Customer>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update customer: ${error.message}`)
  }

  return data
}

/**
 * Update customer loyalty points
 */
export async function updateCustomerLoyaltyPoints(
  customerId: string,
  pointsChange: number
): Promise<void> {
  const { error } = await supabase.rpc('update_customer_loyalty_points', {
    p_customer_id: customerId,
    p_points_change: pointsChange,
  })

  if (error) {
    throw new Error(`Failed to update loyalty points: ${error.message}`)
  }
}

/**
 * Get customer with recent orders
 * Only returns active customers (is_active = true)
 */
export async function getCustomerWithOrders(customerId: string): Promise<CustomerWithOrders> {
  const { data, error } = await supabase
    .from('customers')
    .select(
      `
      *,
      orders!customer_id (
        id,
        order_number,
        total_amount,
        created_at
      )
    `
    )
    .eq('id', customerId)
    .eq('is_active', true) // Only active customers
    .single()

  if (error) {
    throw new Error(`Failed to fetch customer with orders: ${error.message}`)
  }

  return {
    ...data,
    recent_orders: data.orders
      ?.sort((a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5),
  }
}

/**
 * Get top customers by spending
 * Only returns active customers (is_active = true)
 */
export async function getTopCustomers(limit = 10): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true) // Only active customers
    .order('total_spent', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch top customers: ${error.message}`)
  }

  return data || []
}

/**
 * Delete customer (soft delete - marks as inactive)
 * Preserves data integrity by keeping historical records
 * Anonymizes email/phone to free unique constraints for recreation
 * Uses atomic database function with:
 * - Idempotency (safe to retry)
 * - Row-level locking (prevents race conditions)
 * - SECURITY DEFINER (bypasses RLS on audit tables)
 */
export async function deleteCustomer(customerId: string, vendorId?: string): Promise<void> {
  // If vendorId is not provided, get it from the current user context
  if (!vendorId) {
    const { data: userData } = await supabase
      .from('users')
      .select('vendor_id')
      .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    if (!userData?.vendor_id) {
      throw new Error('Failed to determine vendor ID for customer deletion')
    }
    vendorId = userData.vendor_id
  }

  const { data, error } = await supabase.rpc('delete_customer_safe', {
    p_customer_id: customerId,
    p_vendor_id: vendorId,
  })

  if (error) {
    throw new Error(`Failed to delete customer: ${error.message}`)
  }

  // Verify deletion succeeded
  if (!data || data.length === 0 || !data[0].success) {
    throw new Error(`Failed to delete customer: operation did not complete`)
  }
}

/**
 * Export service object
 */
export const customersService = {
  getCustomers,
  getCustomerById,
  getCustomerByPhone,
  getCustomerByEmail,
  searchCustomers,
  createCustomer,
  updateCustomer,
  updateCustomerLoyaltyPoints,
  getCustomerWithOrders,
  getTopCustomers,
  deleteCustomer,
}
