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

  // Multi-location fulfillment (from order_locations table)
  fulfillment_locations?: OrderLocation[]
  location_count?: number
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
  // Multi-location support: which location fulfills this item
  location_id?: string
  location_name?: string
  // Per-item fulfillment type (Apple/Best Buy style smart routing)
  order_type?: 'pickup' | 'shipping'
  pickup_location_id?: string
  pickup_location_name?: string
  // Fulfillment tracking per item
  fulfillment_status?: 'pending' | 'fulfilled' | 'cancelled'
  fulfilled_quantity?: number
}

// Multi-location order tracking
export interface OrderLocation {
  id: string
  order_id: string
  location_id: string
  location_name?: string
  item_count: number
  total_quantity: number
  fulfillment_status: 'unfulfilled' | 'partial' | 'fulfilled' | 'shipped'
  notes?: string
  created_at: string
  updated_at: string
  fulfilled_at?: string
  // Per-location shipping info
  tracking_number?: string
  tracking_url?: string
  shipping_carrier?: string
  shipping_service?: string
  shipping_cost?: number
  shipped_at?: string
  shipped_by_user_id?: string
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
    // Multi-location: specify which location fulfills this item
    location_id?: string
  }[]
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  payment_method?: string
  payment_status?: 'pending' | 'paid'
  status?: 'pending' | 'completed'
  // Primary location (for pickup orders or default fulfillment)
  pickup_location_id?: string
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

  // Batch fetch order_locations for all orders (for split order filtering)
  // Only fetch for recent orders to avoid performance issues
  const recentOrders = (data || []).slice(0, 200) // Limit to 200 most recent
  const orderIds = recentOrders.map((o: any) => o.id)
  let orderLocationsMap: Record<string, any[]> = {}

  if (orderIds.length > 0) {
    const { data: locationsData, error: locError } = await supabase
      .from('order_locations')
      .select(`
        id,
        order_id,
        location_id,
        item_count,
        total_quantity,
        fulfillment_status,
        tracking_number,
        tracking_url,
        shipping_carrier,
        shipped_at,
        locations:location_id (name)
      `)
      .in('order_id', orderIds)

    console.log('[getOrders] order_locations fetch:', {
      orderIdsCount: orderIds.length,
      locationsFound: locationsData?.length || 0,
      error: locError?.message,
    })

    if (!locError && locationsData) {
      // Group by order_id
      locationsData.forEach((loc: any) => {
        if (!orderLocationsMap[loc.order_id]) {
          orderLocationsMap[loc.order_id] = []
        }
        orderLocationsMap[loc.order_id].push(loc)
      })
      console.log('[getOrders] orderLocationsMap keys:', Object.keys(orderLocationsMap).length)
    }
  }

  // Flatten customer and location data
  const orders = (data || []).map((order: any) => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers

    // Priority for customer name:
    // 1. Joined customer table (if customer_id exists, use their real name)
    // 2. Direct customer_name on order (only if NOT "Walk-In" or "Guest")
    // 3. metadata.customer_name
    // 4. "Walk-In" fallback for POS, "Guest" for others
    let customerName = order.order_type === 'walk_in' ? 'Walk-In' : 'Guest'

    // If there's a linked customer, ALWAYS use their name
    if (customer && customer.first_name) {
      customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    } else if (order.customer_name && order.customer_name !== 'Guest' && order.customer_name !== 'Walk-In') {
      // Use direct customer_name only if it's a real name (not placeholder)
      customerName = order.customer_name
    } else if (order.metadata?.customer_name && order.metadata.customer_name !== 'Walk-In') {
      customerName = order.metadata.customer_name
    }

    const location = Array.isArray(order.locations) ? order.locations[0] : order.locations
    const locationName = location?.name || 'Online'

    // Map order_locations to fulfillment_locations for filtering
    const orderLocs = orderLocationsMap[order.id] || []
    const fulfillmentLocations = orderLocs.map((loc: any) => {
      // Get location name from joined locations table
      const locationData = Array.isArray(loc.locations) ? loc.locations[0] : loc.locations
      return {
        id: loc.id,
        order_id: order.id,
        location_id: loc.location_id,
        location_name: locationData?.name || 'Unknown',
        item_count: loc.item_count,
        total_quantity: loc.total_quantity,
        fulfillment_status: loc.fulfillment_status,
        tracking_number: loc.tracking_number,
        tracking_url: loc.tracking_url,
        shipping_carrier: loc.shipping_carrier,
        shipped_at: loc.shipped_at,
      }
    })

    return {
      ...order,
      customer_name: customerName,
      customer_email: customer?.email || order.customer_email || '',
      customer_phone: customer?.phone || order.customer_phone || '',
      pickup_location_name: locationName,
      fulfillment_locations: fulfillmentLocations,
      location_count: fulfillmentLocations.length,
      customers: undefined, // Remove nested object
      locations: undefined, // Remove nested object
    }
  })

  return orders
}

/**
 * Get single order by ID with items (including location data)
 */
export async function getOrderById(orderId: string): Promise<Order & { items: OrderItem[] }> {
  // First fetch the order with items and pickup location
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
      ),
      locations:pickup_location_id (
        name
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError) {
    throw new Error(`Failed to fetch order: ${orderError.message}`)
  }

  // Get pickup location name
  const location = Array.isArray(order.locations) ? order.locations[0] : order.locations
  const pickupLocationName = location?.name || null

  // Get unique location IDs from order items
  const locationIds = [...new Set(
    (order.order_items || [])
      .map((item: any) => item.location_id)
      .filter(Boolean)
  )]

  // Fetch location names if there are any location IDs
  let locationMap: Record<string, string> = {}
  if (locationIds.length > 0) {
    const { data: locations } = await supabase
      .from('locations')
      .select('id, name')
      .in('id', locationIds)

    if (locations) {
      locationMap = locations.reduce((acc: Record<string, string>, loc: any) => {
        acc[loc.id] = loc.name
        return acc
      }, {})
    }
  }

  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers
  const customerName = customer
    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Guest'
    : 'Guest'

  // Add location names to items
  const items = (order.order_items || []).map((item: any) => ({
    ...item,
    location_name: item.location_id ? locationMap[item.location_id] || null : null,
  }))

  return {
    ...order,
    customer_name: customerName,
    customer_email: customer?.email || '',
    customer_phone: customer?.phone || '',
    pickup_location_name: pickupLocationName,
    items,
    customers: undefined, // Remove nested object
    locations: undefined, // Remove nested object
  }
}

/**
 * Fulfill order items at a specific location
 * Marks all items at the given location as fulfilled
 *
 * Note: This implementation does direct queries instead of RPC
 * to work without requiring the database migration to be applied.
 */
export async function fulfillItemsAtLocation(
  orderId: string,
  locationId: string
): Promise<{ itemsFulfilled: number; orderFullyFulfilled: boolean; remainingLocations: string[] }> {
  const now = new Date().toISOString()

  // 1. Mark items at this location as fulfilled
  const { data: updatedItems, error: itemsError } = await supabase
    .from('order_items')
    .update({
      fulfillment_status: 'fulfilled',
    })
    .eq('order_id', orderId)
    .eq('location_id', locationId)
    .neq('fulfillment_status', 'fulfilled')
    .select('id')

  if (itemsError) {
    throw new Error(`Failed to fulfill items: ${itemsError.message}`)
  }

  const itemsFulfilled = updatedItems?.length || 0

  // 2. Update order_locations status
  const { error: locError } = await supabase
    .from('order_locations')
    .update({
      fulfillment_status: 'fulfilled',
      fulfilled_at: now,
      updated_at: now,
    })
    .eq('order_id', orderId)
    .eq('location_id', locationId)

  if (locError) {
    console.error('Failed to update order_locations:', locError)
    // Continue - this table might not exist for all orders
  }

  // 3. Check if entire order is fulfilled
  const { data: allItems, error: fetchError } = await supabase
    .from('order_items')
    .select('id, fulfillment_status, location_id')
    .eq('order_id', orderId)

  if (fetchError) {
    throw new Error(`Failed to check order fulfillment: ${fetchError.message}`)
  }

  const totalItems = allItems?.length || 0
  const fulfilledItems = allItems?.filter(item => item.fulfillment_status === 'fulfilled').length || 0
  const orderFullyFulfilled = fulfilledItems === totalItems && totalItems > 0

  // 4. Get remaining unfulfilled locations
  const remainingLocations = Array.from(new Set(
    allItems
      ?.filter(item => item.fulfillment_status !== 'fulfilled' && item.location_id)
      .map(item => item.location_id) || []
  )) as string[]

  // 5. Update order fulfillment status
  if (orderFullyFulfilled) {
    // Get order type to determine next status
    const { data: order } = await supabase
      .from('orders')
      .select('order_type')
      .eq('id', orderId)
      .single()

    const nextStatus = order?.order_type === 'pickup' ? 'ready' : 'ready_to_ship'

    const { error: orderError } = await supabase
      .from('orders')
      .update({
        fulfillment_status: 'fulfilled',
        status: nextStatus,
        updated_at: now,
      })
      .eq('id', orderId)

    if (orderError) {
      console.error('Failed to update order status:', orderError)
    }
  } else if (fulfilledItems > 0) {
    // Partial fulfillment
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        fulfillment_status: 'partial',
        updated_at: now,
      })
      .eq('id', orderId)

    if (orderError) {
      console.error('Failed to update order partial status:', orderError)
    }
  }

  return {
    itemsFulfilled,
    orderFullyFulfilled,
    remainingLocations,
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
 * Ship items from a specific location
 * For multi-location orders, each location ships independently
 *
 * Note: This implementation does direct queries instead of RPC
 * to work without requiring the database migration to be applied.
 */
export async function shipFromLocation(
  orderId: string,
  locationId: string,
  trackingNumber: string,
  carrier: string = 'USPS',
  trackingUrl?: string,
  shippingCost?: number,
  shippedByUserId?: string
): Promise<{
  success: boolean
  locationShipped: boolean
  allLocationsShipped: boolean
  remainingLocationsToShip: string[]
}> {
  const now = new Date().toISOString()

  console.log('[shipFromLocation] Starting...', { orderId, locationId, trackingNumber, carrier })

  // 1. Update order_locations with shipping info
  // Note: Don't include shipped_by_user_id in order_locations - it has FK constraint to users table
  const { data: locData, error: locError } = await supabase
    .from('order_locations')
    .update({
      tracking_number: trackingNumber,
      tracking_url: trackingUrl || null,
      shipping_carrier: carrier,
      shipping_cost: shippingCost || null,
      shipped_at: now,
      fulfillment_status: 'shipped',
      updated_at: now,
    })
    .eq('order_id', orderId)
    .eq('location_id', locationId)
    .select()

  console.log('[shipFromLocation] order_locations update result:', { locData, locError })

  if (locError) {
    console.error('[shipFromLocation] order_locations update failed:', locError)
    // Don't throw - continue to update the order directly
  }

  // If no rows were updated, the order_locations record might not exist
  if (!locData || locData.length === 0) {
    console.warn('[shipFromLocation] No order_locations record found, creating one...')
    // Try to create the record (without shipped_by_user_id due to FK constraint)
    const { error: insertError } = await supabase
      .from('order_locations')
      .insert({
        order_id: orderId,
        location_id: locationId,
        item_count: 1,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl || null,
        shipping_carrier: carrier,
        shipping_cost: shippingCost || null,
        shipped_at: now,
        fulfillment_status: 'shipped',
      })

    if (insertError) {
      console.error('[shipFromLocation] Failed to create order_locations:', insertError)
      // Continue anyway - we can still update the order directly
    }
  }

  // 2. Mark items at this location as fulfilled
  const { error: itemsError } = await supabase
    .from('order_items')
    .update({
      fulfillment_status: 'fulfilled',
    })
    .eq('order_id', orderId)
    .eq('location_id', locationId)
    .neq('fulfillment_status', 'fulfilled')

  if (itemsError) {
    console.error('Failed to update item fulfillment status:', itemsError)
    // Don't throw - continue with the rest
  }

  // 3. Check shipping status across all locations
  const { data: allLocations, error: fetchError } = await supabase
    .from('order_locations')
    .select('location_id, shipped_at')
    .eq('order_id', orderId)

  console.log('[shipFromLocation] Fetched all locations:', { allLocations, fetchError })

  // Handle case where there are no order_locations records (single-location order without routing)
  const totalLocations = allLocations?.length || 0
  const shippedLocations = allLocations?.filter(loc => loc.shipped_at !== null).length || 0
  const unshippedLocationIds = allLocations
    ?.filter(loc => loc.shipped_at === null)
    .map(loc => loc.location_id) || []

  // If no order_locations exist, treat as single-location order - just update the order directly
  const allLocationsShipped = totalLocations === 0 || (shippedLocations === totalLocations && totalLocations > 0)

  console.log('[shipFromLocation] Shipping status:', { totalLocations, shippedLocations, allLocationsShipped })

  // 4. Update order status
  // NOTE: We intentionally don't set shipped_by_user_id because the foreign key
  // constraint requires the user to exist in the users table, but auth users
  // may not have a corresponding users table entry.
  const updateData: any = {
    status: 'shipped',
    fulfillment_status: 'fulfilled',
    shipped_at: now,
    tracking_number: trackingNumber,
    tracking_url: trackingUrl || null,
    shipping_carrier: carrier,
    updated_at: now,
  }

  // Only add shipping cost if provided
  if (shippingCost) {
    updateData.shipping_cost = shippingCost
  }

  if (allLocationsShipped) {
    // All locations shipped (or single location) - mark order as shipped
    const { error: orderError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    console.log('[shipFromLocation] Order update result:', { orderError })

    if (orderError) {
      console.error('[shipFromLocation] Failed to update order status:', orderError)
      throw new Error(`Failed to update order: ${orderError.message}`)
    }
  } else if (shippedLocations > 0) {
    // Partial shipping - update fulfillment status only
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        fulfillment_status: 'partial',
        updated_at: now,
      })
      .eq('id', orderId)

    if (orderError) {
      console.error('[shipFromLocation] Failed to update order partial status:', orderError)
    }
  }

  console.log('[shipFromLocation] Complete!', { success: true, allLocationsShipped })

  return {
    success: true,
    locationShipped: true,
    allLocationsShipped,
    remainingLocationsToShip: unshippedLocationIds,
  }
}

/**
 * Get shipments for an order (for multi-location tracking display)
 */
export async function getOrderShipments(orderId: string): Promise<OrderLocation[]> {
  const { data, error } = await supabase
    .from('order_locations')
    .select(`
      *,
      locations:location_id (name)
    `)
    .eq('order_id', orderId)
    .order('shipped_at', { ascending: true, nullsFirst: false })

  if (error) {
    throw new Error(`Failed to fetch order shipments: ${error.message}`)
  }

  return (data || []).map((loc: any) => ({
    ...loc,
    location_name: loc.locations?.name || 'Unknown',
    locations: undefined,
  }))
}

/**
 * Delete an order and all related data
 * WARNING: This permanently deletes the order. Use with caution.
 * Only use for test orders or cleanup purposes.
 */
export async function deleteOrder(orderId: string): Promise<void> {
  // Delete in correct order to avoid foreign key constraints:
  // 1. order_items (references orders)
  // 2. order_locations (references orders)
  // 3. order_payments (references orders)
  // 4. orders (main table)

  // Delete order items
  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)

  if (itemsError) {
    console.error('Failed to delete order items:', itemsError)
    // Continue - some orders might not have items
  }

  // Delete order locations
  const { error: locError } = await supabase
    .from('order_locations')
    .delete()
    .eq('order_id', orderId)

  if (locError) {
    console.error('Failed to delete order locations:', locError)
    // Continue - some orders might not have locations
  }

  // Delete the order itself
  const { error: orderError } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)

  if (orderError) {
    throw new Error(`Failed to delete order: ${orderError.message}`)
  }
}

/**
 * Bulk delete multiple orders
 * WARNING: This permanently deletes orders. Use with caution.
 */
export async function deleteOrdersBulk(orderIds: string[]): Promise<{ deleted: number; failed: string[] }> {
  const failed: string[] = []
  let deleted = 0

  // Delete in batches to avoid overwhelming the DB
  for (const orderId of orderIds) {
    try {
      await deleteOrder(orderId)
      deleted++
    } catch (error) {
      console.error(`Failed to delete order ${orderId}:`, error)
      failed.push(orderId)
    }
  }

  return { deleted, failed }
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
  fulfillItemsAtLocation,
  shipFromLocation,
  getOrderShipments,
  deleteOrder,
  deleteOrdersBulk,
}
