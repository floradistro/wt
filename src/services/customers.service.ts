/**
 * Customers Service
 *
 * Handles all customer operations using Supabase directly.
 * Use this instead of calling /api/customers
 */

import { supabase } from '@/lib/supabase/client'

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
 */
export async function getCustomers(params?: {
  limit?: number
  searchTerm?: string
}): Promise<Customer[]> {
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (params?.searchTerm) {
    query = query.or(
      `email.ilike.%${params.searchTerm}%,phone.ilike.%${params.searchTerm}%,first_name.ilike.%${params.searchTerm}%,last_name.ilike.%${params.searchTerm}%`
    )
  }

  if (params?.limit) {
    query = query.limit(params.limit)
  }

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
export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  // Normalize phone number (remove spaces, dashes, parentheses)
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', normalizedPhone)
    .single()

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
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email.toLowerCase())
    .single()

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
 */
export async function searchCustomers(searchTerm: string, limit = 20): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(
      `email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`
    )
    .order('created_at', { ascending: false })
    .limit(limit)

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
    customerData.email = params.email.toLowerCase()
  }

  if (params.phone) {
    customerData.phone = params.phone.replace(/[\s\-\(\)]/g, '')
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
