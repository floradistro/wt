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
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
  fulfillment_status: 'unfulfilled' | 'partial' | 'fulfilled' | 'cancelled'
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  payment_method?: string
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
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
}): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (params?.status) {
    query = query.eq('status', params.status)
  }

  if (params?.customerId) {
    query = query.eq('customer_id', params.customerId)
  }

  if (params?.limit) {
    query = query.limit(params.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`)
  }

  return data || []
}

/**
 * Get single order by ID with items
 */
export async function getOrderById(orderId: string): Promise<Order & { items: OrderItem[] }> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .eq('id', orderId)
    .single()

  if (orderError) {
    throw new Error(`Failed to fetch order: ${orderError.message}`)
  }

  return {
    ...order,
    items: order.order_items || [],
  }
}

/**
 * Create a new order
 */
export async function createOrder(params: CreateOrderParams): Promise<Order> {
  // Start a transaction
  const { items, ...orderData } = params

  // 1. Create the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      ...orderData,
      order_number: await generateOrderNumber(),
      status: orderData.status || 'pending',
      payment_status: orderData.payment_status || 'pending',
      fulfillment_status: 'unfulfilled',
    })
    .select()
    .single()

  if (orderError) {
    throw new Error(`Failed to create order: ${orderError.message}`)
  }

  // 2. Create order items
  const orderItems = items.map((item) => ({
    ...item,
    order_id: order.id,
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

  if (itemsError) {
    // Rollback: delete the order
    await supabase.from('orders').delete().eq('id', order.id)
    throw new Error(`Failed to create order items: ${itemsError.message}`)
  }

  return order
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
    .select('*')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch today's orders: ${error.message}`)
  }

  return data || []
}

/**
 * Search orders
 */
export async function searchOrders(searchTerm: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .or(`order_number.ilike.%${searchTerm}%,transaction_id.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    throw new Error(`Failed to search orders: ${error.message}`)
  }

  return data || []
}

/**
 * Export service object
 */
export const ordersService = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getTodaysOrders,
  searchOrders,
}
