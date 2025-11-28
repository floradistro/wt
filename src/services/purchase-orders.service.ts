/**
 * Purchase Orders Service
 *
 * Handles all purchase order operations using Supabase directly.
 * Supports both inbound (supplier -> vendor) and outbound (vendor -> customer) POs.
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

export type PurchaseOrderType = 'inbound' | 'outbound'
export type PurchaseOrderStatus = 'draft' | 'pending' | 'approved' | 'received' | 'partially_received' | 'cancelled'
export type ItemCondition = 'good' | 'damaged' | 'expired' | 'rejected'

export interface PurchaseOrder {
  id: string
  po_number: string
  vendor_id: string
  po_type: PurchaseOrderType
  status: PurchaseOrderStatus
  supplier_id?: string
  supplier_name?: string // From join
  wholesale_customer_id?: string
  customer_name?: string // From join
  location_id?: string
  location_name?: string // From join
  expected_delivery_date?: string
  notes?: string
  subtotal: number
  tax_amount: number // Database column
  shipping_cost: number // Database column
  total_amount: number // Database column
  created_at: string
  updated_at: string
  created_by?: string
  // Computed fields
  items_count?: number
  received_items_count?: number
  // Aliases for compatibility with existing code
  tax?: number
  shipping?: number
  total?: number
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  product_name?: string
  product_sku?: string
  quantity: number
  received_quantity: number
  unit_price: number
  subtotal: number
  condition?: ItemCondition
  quality_notes?: string
  created_at: string
  updated_at: string
}

export interface CreatePurchaseOrderParams {
  po_type: PurchaseOrderType
  supplier_id?: string
  wholesale_customer_id?: string
  location_id?: string
  expected_delivery_date?: string
  notes?: string
  items: {
    product_id: string
    quantity: number
    unit_price: number
  }[]
  tax?: number
  shipping?: number
}

export interface ReceiveItemParams {
  purchase_order_id: string
  item_id: string
  quantity: number
  condition: ItemCondition
  quality_notes?: string
  location_id: string
}

/**
 * Get purchase orders for current vendor
 */
export async function getPurchaseOrders(params?: {
  type?: PurchaseOrderType
  status?: PurchaseOrderStatus
  locationIds?: string[]
  search?: string
}): Promise<PurchaseOrder[]> {
  let query = supabase
    .from('purchase_orders')
    .select(`
      *,
      suppliers (
        id,
        external_name
      ),
      wholesale_customers (
        id,
        external_company_name
      ),
      locations (
        id,
        name
      ),
      purchase_order_items (
        id,
        quantity,
        received_quantity
      )
    `)
    .order('created_at', { ascending: false })

  if (params?.type) {
    query = query.eq('po_type', params.type)
  }

  if (params?.status) {
    query = query.eq('status', params.status)
  }

  if (params?.locationIds && params?.locationIds.length > 0) {
    query = query.in('location_id', params.locationIds)
  }

  if (params?.search) {
    query = query.ilike('po_number', `%${params.search}%`)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Failed to fetch purchase orders', {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw new Error(`Failed to fetch purchase orders: ${error.message}`)
  }

  // Flatten joined data and compute counts
  const pos = (data || []).map((po: any) => {
    const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers
    const customer = Array.isArray(po.wholesale_customers) ? po.wholesale_customers[0] : po.wholesale_customers
    const location = Array.isArray(po.locations) ? po.locations[0] : po.locations
    const items = po.purchase_order_items || []

    return {
      ...po,
      supplier_name: supplier?.external_name || '',
      customer_name: customer?.external_company_name || '',
      location_name: location?.name || '',
      items_count: items.length,
      received_items_count: items.filter((item: any) => (item.received_quantity || 0) >= (item.quantity || 0)).length,
      // Aliases for compatibility (database has tax_amount/shipping_cost/total_amount)
      tax: po.tax_amount,
      shipping: po.shipping_cost,
      total: po.total_amount,
      suppliers: undefined, // Remove nested object
      wholesale_customers: undefined, // Remove nested object
      locations: undefined, // Remove nested object
      purchase_order_items: undefined, // Remove nested object
    }
  })

  return pos
}

/**
 * Get single purchase order by ID with items
 */
export async function getPurchaseOrderById(poId: string): Promise<PurchaseOrder & { items: PurchaseOrderItem[] }> {
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      suppliers (
        id,
        external_name
      ),
      wholesale_customers (
        id,
        external_company_name
      ),
      locations (
        id,
        name
      ),
      purchase_order_items (
        *,
        products (
          name,
          sku
        )
      )
    `)
    .eq('id', poId)
    .single()

  if (poError) {
    logger.error('Failed to fetch purchase order', { error: poError })
    throw new Error(`Failed to fetch purchase order: ${poError.message}`)
  }

  const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers
  const customer = Array.isArray(po.wholesale_customers) ? po.wholesale_customers[0] : po.wholesale_customers
  const location = Array.isArray(po.locations) ? po.locations[0] : po.locations

  // Flatten product data into items
  const items = (po.purchase_order_items || []).map((item: any) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products
    return {
      ...item,
      product_name: product?.name || '',
      product_sku: product?.sku || '',
      products: undefined, // Remove nested object
    }
  })

  return {
    ...po,
    supplier_name: supplier?.external_name || '',
    customer_name: customer?.external_company_name || '',
    location_name: location?.name || '',
    items,
    suppliers: undefined, // Remove nested object
    wholesale_customers: undefined, // Remove nested object
    locations: undefined, // Remove nested object
    purchase_order_items: undefined, // Remove nested object
  }
}

/**
 * Create a new purchase order
 *
 * @param vendorId - Vendor ID creating the PO
 * @param params - PO creation parameters
 * @returns Created purchase order
 * @throws Error if validation fails or database operation fails
 */
export async function createPurchaseOrder(
  vendorId: string,
  params: CreatePurchaseOrderParams
): Promise<PurchaseOrder> {
  const span = logger.startSpan('create_purchase_order', 'purchase_order.create')

  try {
    // Input validation
    if (!vendorId) {
      throw new Error('Vendor ID is required')
    }

    if (!params.po_type || !['inbound', 'outbound'].includes(params.po_type)) {
      throw new Error('Valid PO type is required (inbound or outbound)')
    }

    if (params.po_type === 'inbound' && !params.supplier_id) {
      throw new Error('Supplier is required for inbound POs')
    }

    if (params.po_type === 'outbound' && !params.wholesale_customer_id) {
      throw new Error('Wholesale customer is required for outbound POs')
    }

    if (!params.items || params.items.length === 0) {
      throw new Error('At least one item is required')
    }

    // Validate items
    for (const item of params.items) {
      if (!item.product_id) {
        throw new Error('Product ID is required for all items')
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error('Item quantity must be greater than 0')
      }
      if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
        throw new Error('Item unit price must be 0 or greater')
      }
    }

    // Extract items, tax, shipping from params
    const { items, tax, shipping, ...poData } = params

    const taxAmount = tax || 0
    const shippingCost = shipping || 0

    // Generate idempotency key for safe retries
    const idempotencyKey = `po-${vendorId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

    const itemsJson = JSON.stringify(items)

    logger.info('Creating purchase order', {
      poType: params.po_type,
      itemCount: items.length,
      idempotencyKey,
      itemsJson, // Log the JSON being sent
    })

    // Set Sentry context
    logger.setContext('purchase_order_create', {
      po_type: params.po_type,
      item_count: items.length,
    })

    // Call atomic database function to create PO + items in single transaction
    const { data: result, error: rpcError } = await supabase.rpc('create_purchase_order_atomic', {
      p_vendor_id: vendorId,
      p_po_type: params.po_type,
      p_items: itemsJson, // Function accepts TEXT and parses as JSONB internally
      p_supplier_id: params.supplier_id || null,
      p_wholesale_customer_id: params.wholesale_customer_id || null,
      p_location_id: params.location_id || null,
      p_expected_delivery_date: params.expected_delivery_date || null,
      p_notes: params.notes || null,
      p_tax_amount: taxAmount,
      p_shipping_cost: shippingCost,
      p_idempotency_key: idempotencyKey,
    })

    if (rpcError) {
      logger.error('Failed to create purchase order', {
        error: rpcError,
        errorMessage: rpcError.message,
        errorDetails: rpcError.details,
        errorHint: rpcError.hint,
        errorCode: rpcError.code,
      })
      throw new Error(`Failed to create purchase order: ${rpcError.message}`)
    }

    if (!result || result.length === 0) {
      throw new Error('No result returned from PO creation function')
    }

    const poResult = result[0]

    logger.info('Purchase order created atomically', {
      poId: poResult.po_id,
      poNumber: poResult.po_number,
      itemsCreated: poResult.items_created,
      total: poResult.total_amount,
    })

    // Fetch the full PO record with joined data for return
    const createdPO = await getPurchaseOrderById(poResult.po_id)

    span.finish()

    return createdPO
  } catch (error) {
    span.finish()

    logger.error('Create purchase order exception', {
      error,
      vendorId,
      poType: params?.po_type,
      itemCount: params?.items?.length || 0,
    })

    // Re-throw with context
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(`Failed to create purchase order: ${String(error)}`)
    }
  }
}

/**
 * Update purchase order status
 */
export async function updatePurchaseOrderStatus(
  poId: string,
  status: PurchaseOrderStatus
): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', poId)

  if (error) {
    logger.error('Failed to update purchase order status', { error })
    throw new Error(`Failed to update purchase order status: ${error.message}`)
  }
}

/**
 * Receive items from purchase order
 * Uses a stored procedure for transactional safety - all items receive successfully or none do
 *
 * @param poId - Purchase order ID
 * @param items - Array of items to receive with quantities and conditions
 * @param locationId - Location where items will be added to inventory
 * @throws Error if validation fails or database operation fails
 */
export async function receiveItems(
  poId: string,
  items: { item_id: string; quantity: number; condition: ItemCondition; quality_notes?: string }[],
  locationId: string
): Promise<{
  success: boolean
  itemsProcessed: number
  newStatus: PurchaseOrderStatus
}> {
  const span = logger.startSpan('receive_po_items', 'purchase_order.receive')

  try {
    // Input validation
    if (!poId) {
      throw new Error('Purchase order ID is required')
    }

    if (!locationId) {
      throw new Error('Location ID is required')
    }

    if (!items || items.length === 0) {
      throw new Error('At least one item is required')
    }

    // Validate each item
    for (const item of items) {
      if (!item.item_id) {
        throw new Error('Item ID is required for all items')
      }

      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`Invalid quantity ${item.quantity} for item ${item.item_id}. Must be a number greater than 0`)
      }

      if (!item.condition || !['good', 'damaged', 'expired', 'rejected'].includes(item.condition)) {
        throw new Error(`Invalid condition "${item.condition}" for item ${item.item_id}. Must be one of: good, damaged, expired, rejected`)
      }
    }

    logger.info('Receiving PO items', {
      poId,
      locationId,
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    })

    // Set Sentry context for better error tracking
    logger.setContext('purchase_order', {
      po_id: poId,
      location_id: locationId,
      items_count: items.length,
      items: items.map(item => ({
        item_id: item.item_id,
        quantity: item.quantity,
        condition: item.condition,
      })),
    })

    // Call stored procedure for transactional receive
    const { data, error } = await supabase.rpc('receive_po_items', {
      p_po_id: poId,
      p_location_id: locationId,
      p_items: items,
    })

    if (error) {
      logger.error('Database error receiving PO items', {
        error,
        poId,
        locationId,
        itemCount: items.length,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        errorCode: error.code,
      })

      // Provide user-friendly error messages
      if (error.message?.includes('not found')) {
        throw new Error('Purchase order or item not found. Please refresh and try again.')
      } else if (error.message?.includes('Cannot receive')) {
        throw new Error(error.message) // Already user-friendly from stored proc
      } else if (error.message?.includes('Invalid condition')) {
        throw new Error(error.message) // Already user-friendly from stored proc
      } else {
        throw new Error(`Failed to receive items: ${error.message}`)
      }
    }

    const result = data as { success: boolean; items_processed: number; new_status: PurchaseOrderStatus }

    logger.info('Successfully received PO items', {
      poId,
      itemsProcessed: result.items_processed,
      newStatus: result.new_status,
    })

    span.finish()

    return {
      success: result.success,
      itemsProcessed: result.items_processed,
      newStatus: result.new_status,
    }
  } catch (error) {
    span.finish()

    // Log error with full context
    logger.error('Failed to receive PO items', {
      error,
      poId,
      locationId,
      itemCount: items?.length || 0,
    })

    // Re-throw with context
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(`Failed to receive items: ${String(error)}`)
    }
  }
}

/**
 * Delete purchase order atomically (only if draft/pending)
 * Uses atomic database function for transactional safety
 */
export async function deletePurchaseOrder(poId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_purchase_order_atomic', {
    p_po_id: poId,
  })

  if (error) {
    logger.error('Failed to delete purchase order', { error, poId })
    throw new Error(`Failed to delete purchase order: ${error.message}`)
  }

  logger.info('Purchase order deleted atomically', { poId })
}

/**
 * Generate unique PO number
 */
async function generatePONumber(vendorId?: string): Promise<string> {
  // Format: PO-YYYYMMDD-XXXX
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')

  // Get count of POs today to generate sequential number
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  let query = supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())

  // Optionally filter by vendor
  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  const { count } = await query

  const sequential = String((count || 0) + 1).padStart(4, '0')

  return `PO-${dateStr}-${sequential}`
}

/**
 * Get purchase order statistics
 */
export async function getPurchaseOrderStats(params?: {
  locationIds?: string[]
}): Promise<{
  total: number
  draft: number
  pending: number
  received: number
  totalValue: number
}> {
  let query = supabase
    .from('purchase_orders')
    .select('status, total_amount')

  if (params?.locationIds && params.locationIds.length > 0) {
    query = query.in('location_id', params.locationIds)
  }

  const { data, error } = await query

  if (error) {
    logger.error('Failed to fetch purchase order stats', { error })
    throw new Error(`Failed to fetch purchase order stats: ${error.message}`)
  }

  const stats = {
    total: data?.length || 0,
    draft: data?.filter(po => po.status === 'draft').length || 0,
    pending: data?.filter(po => po.status === 'pending' || po.status === 'approved' || po.status === 'partially_received').length || 0,
    received: data?.filter(po => po.status === 'received').length || 0,
    totalValue: data?.reduce((sum, po) => sum + (po.total_amount || 0), 0) || 0,
  }

  return stats
}

/**
 * Save or update a draft purchase order
 * Drafts can be saved without supplier/location (incomplete state)
 */
export async function saveDraftPurchaseOrder(
  vendorId: string,
  params: {
    id?: string // If provided, updates existing draft
    po_type: PurchaseOrderType
    supplier_id?: string | null
    location_id?: string | null
    notes?: string | null
    items: {
      product_id: string
      quantity: number
      unit_price: number
    }[]
  }
): Promise<PurchaseOrder> {
  try {
    if (!vendorId) {
      throw new Error('Vendor ID is required')
    }

    if (!params.items || params.items.length === 0) {
      throw new Error('At least one item is required for draft')
    }

    // Calculate totals
    const subtotal = params.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
    const tax_amount = 0
    const shipping_cost = 0
    const total_amount = subtotal + tax_amount + shipping_cost

    if (params.id) {
      // Update existing draft
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: params.supplier_id,
          location_id: params.location_id,
          notes: params.notes,
          subtotal,
          tax_amount,
          shipping_cost,
          total_amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('status', 'draft') // Only update drafts
        .select()
        .single()

      if (poError) {
        throw new Error(`Failed to update draft: ${poError.message}`)
      }

      // Delete existing items and recreate
      await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', params.id)

      // Insert new items
      const itemsToInsert = params.items.map(item => ({
        purchase_order_id: params.id!,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
        received_quantity: 0,
      }))

      await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert)

      return po as PurchaseOrder
    } else {
      // Create new draft - generate PO number
      const poNumber = await generatePONumber(vendorId)

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          vendor_id: vendorId,
          po_number: poNumber,
          po_type: params.po_type,
          status: 'draft',
          supplier_id: params.supplier_id,
          location_id: params.location_id,
          notes: params.notes,
          subtotal,
          tax_amount,
          shipping_cost,
          total_amount,
        })
        .select()
        .single()

      if (poError) {
        throw new Error(`Failed to create draft: ${poError.message}`)
      }

      // Insert items
      const itemsToInsert = params.items.map(item => ({
        purchase_order_id: po.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
        received_quantity: 0,
      }))

      await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert)

      logger.info('Draft PO saved', { id: po.id, poNumber, itemCount: params.items.length })

      return po as PurchaseOrder
    }
  } catch (error) {
    logger.error('Failed to save draft PO', { error })
    throw error
  }
}

/**
 * Export service object
 */
export const purchaseOrdersService = {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  receiveItems,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  saveDraftPurchaseOrder,
}
