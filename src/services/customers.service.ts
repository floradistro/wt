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
  // Wallet pass fields
  has_wallet_pass?: boolean
  wallet_pass_created_at?: string
}

export interface CustomerWalletPass {
  id: string
  customer_id: string
  vendor_id?: string
  serial_number: string
  pass_type: 'loyalty' | 'membership' | 'promo'
  device_registered: boolean
  push_token?: string
  created_at: string
  last_updated_at: string
  device_registered_at?: string
}

export interface CustomerWithOrders extends Customer {
  recent_orders?: {
    id: string
    order_number: string
    total_amount: number
    created_at: string
    pickup_location?: {
      name: string
    } | null
    created_by_user?: {
      first_name: string
      last_name: string
    } | null
  }[]
}

/**
 * Get all customers
 * Smart search across ALL fields with NO LIMITS
 * Searches: first_name, last_name, middle_name, display_name, email, phone
 * Only returns active customers by default (is_active = true)
 *
 * ⚠️ CRITICAL: This function uses pagination to fetch ALL customers.
 * Supabase PostgREST has a hard limit of 1000 rows per request.
 * DO NOT remove pagination - it will silently cap results at 1000!
 */
export async function getCustomers(params?: {
  limit?: number
  searchTerm?: string
  vendorId?: string
  includeInactive?: boolean
}): Promise<Customer[]> {
  const PAGE_SIZE = 1000 // Supabase max is 1000 - DO NOT CHANGE
  const MAX_PAGES = 100 // Safety limit: 100,000 customers max
  let allData: Customer[] = []
  let page = 0
  let hasMore = true

  logger.info('[getCustomers] Starting paginated fetch (bypassing Supabase 1000 row limit)')

  // Paginate through all customers - NEVER use a single query for lists
  while (hasMore && page < MAX_PAGES) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

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

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`)
    }

    if (data && data.length > 0) {
      allData = allData.concat(data)
      logger.info(`[getCustomers] Page ${page + 1}: fetched ${data.length} customers (total: ${allData.length})`)

      // ⚠️ SANITY CHECK: Warn if we're hitting the Supabase limit
      if (page === 0 && data.length === PAGE_SIZE) {
        logger.warn('[getCustomers] ⚠️ First page returned exactly 1000 rows - pagination is working correctly')
      }
    }

    // If we got less than PAGE_SIZE, we've reached the end
    if (!data || data.length < PAGE_SIZE) {
      hasMore = false
    }

    // Safety: warn if we're hitting max pages
    if (page >= MAX_PAGES - 1) {
      logger.error(`[getCustomers] 🚨 CRITICAL: Hit max pages limit (${MAX_PAGES}). Some customers may be missing!`)
    }

    // If user requested a limit and we've reached it, stop
    if (params?.limit && allData.length >= params.limit) {
      hasMore = false
    }

    page++
  }

  logger.info('[getCustomers] Total customers fetched:', allData.length)
  return allData
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
 * Smart search across ALL fields
 * Searches: first_name, last_name, middle_name, display_name, email, phone
 * Phone numbers are normalized (formatting removed) for better matching
 * Only returns active customers (is_active = true)
 *
 * NOTE: This uses a single query (no pagination) because search results
 * are filtered and unlikely to exceed 1000. If you're seeing exactly 1000
 * results, this function needs pagination like getCustomers().
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
    .limit(1000) // Explicit limit - search results shouldn't exceed this

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to search customers: ${error.message}`)
  }

  // ⚠️ SANITY CHECK: Warn if we hit exactly 1000 results
  if (data && data.length === 1000) {
    logger.warn('[searchCustomers] ⚠️ Search returned exactly 1000 results - some may be missing!')
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
  pointsChange: number,
  reason: string = 'Manual adjustment'
): Promise<void> {
  const { error } = await supabase.rpc('adjust_customer_loyalty_points', {
    p_customer_id: customerId,
    p_points_change: pointsChange,
    p_reason: reason,
  })

  if (error) {
    throw new Error(`Failed to update loyalty points: ${error.message}`)
  }
}

/**
 * Get customer with their complete order history
 * Only returns active customers (is_active = true)
 *
 * Finds orders by BOTH:
 * 1. customer_id foreign key relationship
 * 2. metadata.customer_name matching the customer's full name (for legacy orders)
 */
export async function getCustomerWithOrders(customerId: string): Promise<CustomerWithOrders> {
  // First, get the customer details
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('is_active', true)
    .single()

  if (customerError) {
    throw new Error(`Failed to fetch customer: ${customerError.message}`)
  }

  // Build the customer's full name for matching legacy orders
  const fullName = customer.full_name ||
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim()

  // Query 1: Orders linked by customer_id (with proper JOINs)
  const { data: linkedOrders, error: linkedError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      created_at,
      pickup_location:pickup_location_id (
        name
      ),
      created_by_user:created_by_user_id (
        first_name,
        last_name
      )
    `)
    .eq('customer_id', customerId)

  if (linkedError) {
    console.warn('Error fetching linked orders:', linkedError)
  }

  // Query 2: Legacy orders matched by metadata.customer_name (where customer_id is null)
  let legacyOrders: typeof linkedOrders = []
  if (fullName) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        created_at,
        pickup_location:pickup_location_id (
          name
        ),
        created_by_user:created_by_user_id (
          first_name,
          last_name
        )
      `)
      .is('customer_id', null)
      .eq('metadata->>customer_name', fullName)

    if (legacyError) {
      console.warn('Error fetching legacy orders:', legacyError)
    } else {
      legacyOrders = legacyData || []
    }
  }

  // Combine and dedupe orders by ID
  const allOrdersMap = new Map<string, (typeof linkedOrders extends (infer T)[] | null ? T : never)>()

  for (const order of (linkedOrders || [])) {
    allOrdersMap.set(order.id, order)
  }
  for (const order of legacyOrders) {
    if (!allOrdersMap.has(order.id)) {
      allOrdersMap.set(order.id, order)
    }
  }

  const allOrders = Array.from(allOrdersMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    ...customer,
    recent_orders: allOrders,
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
 * Get customer's wallet pass
 */
export async function getCustomerWalletPass(
  customerId: string,
  vendorId?: string
): Promise<CustomerWalletPass | null> {
  let query = supabase
    .from('customer_wallet_passes')
    .select('*')
    .eq('customer_id', customerId)
    .eq('voided', false)

  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    logger.error('Failed to get customer wallet pass:', error)
    return null
  }

  return data as CustomerWalletPass | null
}

/**
 * Check if customer has a wallet pass (quick check)
 */
export async function hasWalletPass(
  customerId: string,
  vendorId?: string
): Promise<boolean> {
  let query = supabase
    .from('customer_wallet_passes')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('voided', false)

  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  const { count, error } = await query

  if (error) {
    logger.error('Failed to check wallet pass:', error)
    return false
  }

  return (count || 0) > 0
}

/**
 * Get wallet pass stats for a vendor
 */
export async function getWalletPassStats(vendorId: string): Promise<{
  total_passes: number
  active_passes: number
  push_enabled: number
  new_this_week: number
  new_this_month: number
}> {
  const { data, error } = await supabase
    .from('customer_wallet_pass_stats')
    .select('*')
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (error) {
    logger.error('Failed to get wallet pass stats:', error)
    return {
      total_passes: 0,
      active_passes: 0,
      push_enabled: 0,
      new_this_week: 0,
      new_this_month: 0,
    }
  }

  return data || {
    total_passes: 0,
    active_passes: 0,
    push_enabled: 0,
    new_this_week: 0,
    new_this_month: 0,
  }
}

/**
 * Merge two customers into one
 * - Keeps the "target" customer (the one with better/more data)
 * - Merges contact info (fills in missing fields from source)
 * - Sums loyalty points
 * - Transfers all orders from source to target
 * - Soft-deletes the source customer
 *
 * Uses atomic database function with SECURITY DEFINER to bypass RLS
 *
 * @param targetId - ID of customer to keep (will receive merged data)
 * @param sourceId - ID of customer to merge from (will be deleted)
 * @param vendorId - Vendor ID for security
 */
export async function mergeCustomers(
  targetId: string,
  sourceId: string,
  vendorId: string
): Promise<Customer> {
  logger.info('[mergeCustomers] Starting merge', { targetId, sourceId, vendorId })

  // Call atomic database function
  const { data, error } = await supabase.rpc('merge_customers_safe', {
    p_target_id: targetId,
    p_source_id: sourceId,
    p_vendor_id: vendorId,
  })

  if (error) {
    throw new Error(`Failed to merge customers: ${error.message}`)
  }

  // Verify function returned data
  if (!data || data.length === 0) {
    throw new Error('Failed to merge customers: no data returned')
  }

  const result = data[0]

  if (!result.success) {
    throw new Error('Failed to merge customers: operation did not complete')
  }

  logger.info('[mergeCustomers] Merge complete', {
    targetId: result.target_id,
    sourceId: result.source_id,
    mergedPoints: result.merged_loyalty_points,
    ordersTransferred: result.orders_transferred,
  })

  // Return the updated target customer
  return getCustomerById(targetId)
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
  mergeCustomers,
  // Wallet pass functions
  getCustomerWalletPass,
  hasWalletPass,
  getWalletPassStats,
}
