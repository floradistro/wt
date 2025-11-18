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
  tax: number
  shipping: number
  total: number
  created_at: string
  updated_at: string
  created_by?: string
  // Computed fields
  items_count?: number
  received_items_count?: number
  // Aliases for compatibility
  tax_amount?: number
  shipping_cost?: number
  total_amount?: number
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
      // Aliases for compatibility
      tax_amount: po.tax,
      shipping_cost: po.shipping,
      total_amount: po.total,
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
 */
export async function createPurchaseOrder(
  vendorId: string,
  params: CreatePurchaseOrderParams
): Promise<PurchaseOrder> {
  try {
    const { items, ...poData } = params

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    const tax = params.tax || 0
    const shipping = params.shipping || 0
    const total = subtotal + tax + shipping

    const poNumber = await generatePONumber()

    const insertData = {
      ...poData,
      vendor_id: vendorId,
      po_number: poNumber,
      status: 'draft' as const,
      subtotal,
      tax,
      shipping,
      total,
    }

    logger.info('Creating purchase order', { insertData })

    // 1. Create the purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert(insertData)
      .select()
      .single()

    if (poError) {
      logger.error('Failed to create purchase order', {
        error: poError,
        message: poError.message,
        details: poError.details,
        hint: poError.hint,
        code: poError.code,
        insertData
      })
      throw new Error(`Failed to create purchase order: ${poError.message}`)
    }

    logger.info('Purchase order created', { poId: po.id })

    // 2. Create purchase order items (only if items exist)
    if (items.length > 0) {
      const poItems = items.map((item) => ({
        purchase_order_id: po.id,
        product_id: item.product_id,
        quantity: item.quantity,
        quantity_received: 0,
        unit_price: item.unit_price,
        line_total: item.quantity * item.unit_price,
      }))

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(poItems)

      if (itemsError) {
        // Rollback: delete the PO
        await supabase.from('purchase_orders').delete().eq('id', po.id)
        logger.error('Failed to create purchase order items', {
          error: itemsError,
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint,
          code: itemsError.code
        })
        throw new Error(`Failed to create purchase order items: ${itemsError.message}`)
      }
    }

    return po
  } catch (error) {
    logger.error('Create purchase order exception', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
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
 * This function updates inventory and marks items as received
 */
export async function receiveItems(
  poId: string,
  items: { item_id: string; quantity: number; condition: ItemCondition; quality_notes?: string }[],
  locationId: string
): Promise<void> {
  try {
    // Update each item's received quantity
    for (const item of items) {
      const { data: poItem, error: fetchError } = await supabase
        .from('purchase_order_items')
        .select('quantity_received, quantity, product_id')
        .eq('id', item.item_id)
        .single()

      if (fetchError) throw fetchError

      const newReceivedQty = (poItem.quantity_received || 0) + item.quantity

      // Update received quantity and condition
      const { error: updateError } = await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: newReceivedQty,
          condition: item.condition,
          quality_notes: item.quality_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.item_id)

      if (updateError) throw updateError

      // Only add to inventory if condition is 'good'
      if (item.condition === 'good') {
        // Update or insert inventory
        const { data: existingInventory } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', poItem.product_id)
          .eq('location_id', locationId)
          .single()

        if (existingInventory) {
          // Update existing inventory
          const { error: invError } = await supabase
            .from('inventory')
            .update({
              quantity: (existingInventory.quantity || 0) + item.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInventory.id)

          if (invError) throw invError
        } else {
          // Create new inventory record
          const { error: invError } = await supabase.from('inventory').insert({
            product_id: poItem.product_id,
            location_id: locationId,
            quantity: item.quantity,
          })

          if (invError) throw invError
        }
      }
    }

    // Check if PO is fully received
    const { data: po } = await supabase
      .from('purchase_orders')
      .select(`
        purchase_order_items (
          quantity,
          quantity_received
        )
      `)
      .eq('id', poId)
      .single()

    if (po) {
      const allItems = po.purchase_order_items || []
      const fullyReceived = allItems.every(
        (item: any) => (item.quantity_received || 0) >= item.quantity
      )

      const partiallyReceived = allItems.some(
        (item: any) => (item.quantity_received || 0) > 0 && (item.quantity_received || 0) < item.quantity
      )

      const newStatus = fullyReceived
        ? 'received'
        : partiallyReceived
        ? 'partially_received'
        : 'pending'

      await updatePurchaseOrderStatus(poId, newStatus)
    }
  } catch (error) {
    logger.error('Failed to receive items', { error })
    throw new Error(`Failed to receive items: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Delete purchase order (only if draft/pending)
 */
export async function deletePurchaseOrder(poId: string): Promise<void> {
  // Delete items first (cascade should handle this, but being explicit)
  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .delete()
    .eq('purchase_order_id', poId)

  if (itemsError) {
    logger.error('Failed to delete purchase order items', { error: itemsError })
    throw new Error(`Failed to delete purchase order items: ${itemsError.message}`)
  }

  // Delete the PO
  const { error: poError } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', poId)

  if (poError) {
    logger.error('Failed to delete purchase order', { error: poError })
    throw new Error(`Failed to delete purchase order: ${poError.message}`)
  }
}

/**
 * Generate unique PO number
 */
async function generatePONumber(): Promise<string> {
  // Format: PO-YYYYMMDD-XXXX
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')

  // Get count of POs today to generate sequential number
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())

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
    .select('status, total')

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
    totalValue: data?.reduce((sum, po) => sum + (po.total || 0), 0) || 0,
  }

  return stats
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
}
