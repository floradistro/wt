/**
 * Orders Service
 *
 * Handles all order operations using Supabase directly.
 * Use this instead of calling /api/orders
 */

import { supabase } from '@/lib/supabase/client'

export interface Order {
  id: string
  order_number: string
  customer_id?: string
  vendor_id?: string

  // Order Type - The Apple Way: walk_in (POS) | pickup (online→store) | delivery (local) | shipping (USPS)
  order_type: 'walk_in' | 'pickup' | 'delivery' | 'shipping'

  // Status - Context-aware workflow based on order_type
  status: 'pending' | 'confirmed' | 'preparing' | 'packing' | 'packed' | 'ready' | 'out_for_delivery' | 'ready_to_ship' | 'shipped' | 'in_transit' | 'delivered' | 'completed' | 'cancelled'
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
  fulfillment_status: 'unfulfilled' | 'partial' | 'fulfilled' | 'cancelled'

  // Pricing
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  payment_method?: string

  // Timestamps
  created_at: string
  updated_at: string
  completed_at?: string

  // Pickup/Delivery Location
  pickup_location_id?: string
  pickup_location_name?: string

  // Shipping Address (for shipping orders)
  shipping_name?: string
  shipping_address_line1?: string
  shipping_address_line2?: string
  shipping_city?: string
  shipping_state?: string
  shipping_zip?: string
  shipping_country?: string
  shipping_phone?: string

  // Shipping Tracking (for shipping orders)
  tracking_number?: string
  tracking_url?: string
  shipping_label_url?: string
  shipping_carrier?: string
  shipping_service?: string
  postage_paid?: number
  shipping_cost?: number

  // Package Details (for shipping orders)
  package_weight?: number
  package_length?: number
  package_width?: number
  package_height?: number

  // Fulfillment Tracking
  prepared_by_user_id?: string
  prepared_at?: string
  ready_at?: string
  notified_at?: string
  picked_up_at?: string
  shipped_at?: string
  shipped_by_user_id?: string
  estimated_delivery_date?: string
  delivered_at?: string
  delivered_by_user_id?: string
  staff_notes?: string

  // Legacy field (will be migrated to order_type)
  delivery_type?: 'pickup' | 'delivery' | 'instore'

  // Customer info (joined from customers table)
  customer_name?: string
  customer_email?: string
  customer_phone?: string

  // Staff tracking (joined from users table)
  created_by_user?: {
    first_name: string
    last_name: string
  } | null
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  line_total: number
}

export interface CreateOrderParams {
  customer_id?: string
  vendor_id?: string
  items: {
    product_id: string
    quantity: number
    unit_price: number
    subtotal: number
    tax_amount: number
    discount_amount: number
    total: number
  }[]
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  payment_method?: string
  payment_status?: 'pending' | 'paid'
  status?: 'pending' | 'completed'
}

/**
 * Get orders for current vendor/user
 */
export async function getOrders(params?: {
  limit?: number
  status?: string
  customerId?: string
  locationIds?: string[]
}): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select(`
      *,
      customers (
        first_name,
        last_name,
        email,
        phone
      ),
      locations:pickup_location_id (
        name
      ),
      created_by_user:created_by_user_id (
        first_name,
        last_name
      )
    `)
    .order('created_at', { ascending: false })

  if (params?.status) {
    query = query.eq('status', params.status)
  }

  if (params?.customerId) {
    query = query.eq('customer_id', params.customerId)
  }

  if (params?.locationIds && params.locationIds.length > 0) {
    query = query.in('pickup_location_id', params.locationIds)
  }

  if (params?.limit) {
    query = query.limit(params.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`)
  }

  // Flatten customer and location data
  const orders = (data || []).map((order: any) => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const customerName = customer
      ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Guest'
      : 'Guest'

    const location = Array.isArray(order.locations) ? order.locations[0] : order.locations
    const locationName = location?.name || 'Online'

    return {
      ...order,
      customer_name: customerName,
      customer_email: customer?.email || '',
      customer_phone: customer?.phone || '',
      pickup_location_name: locationName,
      customers: undefined, // Remove nested object
      locations: undefined, // Remove nested object
    }
  })

  return orders
}

/**
 * Get single order by ID with items
 */
export async function getOrderById(orderId: string): Promise<Order & { items: OrderItem[] }> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      customers (
        first_name,
        last_name,
        email,
        phone
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError) {
    throw new Error(`Failed to fetch order: ${orderError.message}`)
  }

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const customerName = customer
    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Guest'
    : 'Guest'

  return {
    ...order,
    customer_name: customerName,
    customer_email: customer?.email || '',
    customer_phone: customer?.phone || '',
    items: order.order_items || [],
    customers: undefined, // Remove nested object
  }
}

/**
 * DEPRECATED: Order creation now happens in process-checkout Edge Function
 * This ensures atomic two-phase commit with payment processing
 *
 * @deprecated Use process-checkout Edge Function instead
 */
export async function createOrder(params: CreateOrderParams): Promise<Order> {
  throw new Error(
    'DEPRECATED: createOrder() is no longer supported. ' +
    'All POS sales must use the process-checkout Edge Function for atomic transactions. ' +
    'This ensures payment and order creation happen atomically with proper rollback on failure.'
  )
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: Order['status']
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`)
  }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: Order['payment_status'],
  transactionData?: {
    transactionId: string
    authorizationCode?: string
  }
): Promise<void> {
  const updateData: any = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }

  if (transactionData) {
    updateData.transaction_id = transactionData.transactionId
    if (transactionData.authorizationCode) {
      updateData.payment_method_title = transactionData.authorizationCode
    }
  }

  const { error } = await supabase.from('orders').update(updateData).eq('id', orderId)

  if (error) {
    throw new Error(`Failed to update payment status: ${error.message}`)
  }
}

/**
 * Generate unique order number
 */
async function generateOrderNumber(): Promise<string> {
  // Format: ORD-YYYYMMDD-XXXX
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')

  // Get count of orders today to generate sequential number
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date().setHours(0, 0, 0, 0))

  const sequential = String((count || 0) + 1).padStart(4, '0')

  return `ORD-${dateStr}-${sequential}`
}

/**
 * Get today's orders (for POS)
 */
export async function getTodaysOrders(): Promise<Order[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        first_name,
        last_name,
        email,
        phone
      ),
      locations:pickup_location_id (
        name
      )
    `)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch today's orders: ${error.message}`)
  }

  // Flatten customer and location data
  const orders = (data || []).map((order: any) => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const customerName = customer
      ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Guest'
      : 'Guest'

    const location = Array.isArray(order.locations) ? order.locations[0] : order.locations
    const locationName = location?.name || 'Online'

    return {
      ...order,
      customer_name: customerName,
      customer_email: customer?.email || '',
      customer_phone: customer?.phone || '',
      pickup_location_name: locationName,
      customers: undefined, // Remove nested object
      locations: undefined, // Remove nested object
    }
  })

  return orders
}

/**
 * Search orders
 */
export async function searchOrders(searchTerm: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customers (
        first_name,
        last_name,
        email,
        phone
      ),
      locations:pickup_location_id (
        name
      )
    `)
    .or(`order_number.ilike.%${searchTerm}%,transaction_id.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw new Error(`Failed to search orders: ${error.message}`)
  }

  // Flatten customer and location data
  const orders = (data || []).map((order: any) => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
    const customerName = customer
      ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Guest'
      : 'Guest'

    const location = Array.isArray(order.locations) ? order.locations[0] : order.locations
    const locationName = location?.name || 'Online'

    return {
      ...order,
      customer_name: customerName,
      customer_email: customer?.email || '',
      customer_phone: customer?.phone || '',
      pickup_location_name: locationName,
      customers: undefined, // Remove nested object
      locations: undefined, // Remove nested object
    }
  })

  return orders
}

/**
 * Export service object
 */
export const ordersService = {
  getOrders,
  getOrderById,
  createOrder, // DEPRECATED - throws error directing to Edge Function
  updateOrderStatus,
  updatePaymentStatus,
  getTodaysOrders,
  searchOrders,
}
