/**
 * Customers Service
 *
 * Handles all customer operations using Supabase directly.
 * Use this instead of calling /api/customers
 */

import { supabase } from '@/lib/supabase/client'
import { normalizePhone, normalizeEmail } from '@/utils/data-normalization'

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
 */
export async function getCustomers(params?: {
  limit?: number
  searchTerm?: string
  vendorId?: string
}): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (params?.vendorId) {
    query = query.eq('vendor_id', params.vendorId)
  }

  if (params?.searchTerm) {
    const term = params.searchTerm.trim()
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,middle_name.ilike.%${term}%,display_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    )
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
 */
export async function getCustomerById(customerId: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch customer: ${error.message}`)
  }

  return data
}

/**
 * Get customer by phone number (for POS lookup)
 */
export async function getCustomerByPhone(phone: string, vendorId?: string): Promise<Customer | null> {
  // Normalize phone number using centralized utility
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  let query = supabase
    .from('customers')
    .select('*')
    .eq('phone', normalized)

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
 */
export async function getCustomerByEmail(email: string, vendorId?: string): Promise<Customer | null> {
  let query = supabase
    .from('customers')
    .select('*')
    .eq('email', email.toLowerCase())

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
 * Search customers (for POS)
 * Smart search across ALL fields with NO LIMITS
 * Searches: first_name, last_name, middle_name, display_name, email, phone
 * Phone numbers are normalized (formatting removed) for better matching
 */
export async function searchCustomers(
  searchTerm: string,
  _limit?: number,
  vendorId?: string
): Promise<Customer[]> {
  const term = searchTerm.trim()

  // Normalize phone numbers using centralized utility
  const normalizedPhone = normalizePhone(term) || term
  const isPhoneSearch = /^\d+$/.test(normalizedPhone) && normalizedPhone.length >= 3

  let searchConditions = `first_name.ilike.%${term}%,last_name.ilike.%${term}%,middle_name.ilike.%${term}%,display_name.ilike.%${term}%,email.ilike.%${term}%`

  // Add phone search with normalized number for better matching
  if (isPhoneSearch) {
    searchConditions += `,phone.ilike.%${normalizedPhone}%`
  } else {
    searchConditions += `,phone.ilike.%${term}%`
  }

  let query = supabase
    .from('customers')
    .select('*')

  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  query = query
    .or(searchConditions)
    .order('created_at', { ascending: false })
    .limit(100000) // Very high limit to ensure we get ALL customers (Supabase default is only 1000)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to search customers: ${error.message}`)
  }

  return data || []
}

/**
 * Create new customer
 */
export async function createCustomer(params: {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  vendor_id?: string
}): Promise<Customer> {
  // Normalize data
  const customerData: Partial<Customer> & { loyalty_points: number; total_spent: number; total_orders: number } = {
    ...params,
    loyalty_points: 0,
    total_spent: 0,
    total_orders: 0,
  }

  if (params.email) {
    customerData.email = normalizeEmail(params.email) || undefined
  }

  if (params.phone) {
    // Normalize phone using centralized utility
    customerData.phone = normalizePhone(params.phone) || undefined
  }

  // Generate full_name if not provided
  if (params.first_name && params.last_name) {
    customerData.full_name = `${params.first_name} ${params.last_name}`
  }

  const { data, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create customer: ${error.message}`)
  }

  return data
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
 */
export async function getTopCustomers(limit = 10): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('total_spent', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch top customers: ${error.message}`)
  }

  return data || []
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
}
