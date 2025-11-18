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
  type: PurchaseOrderType
  status: PurchaseOrderStatus
  supplier_name?: string
  customer_name?: string
  location_id?: string
  location_name?: string
  expected_delivery_date?: string
  notes?: string
  subtotal: number
  tax_amount: number
  shipping_cost: number
  total_amount: number
  created_at: string
  updated_at: string
  created_by?: string
  // Computed fields
  items_count?: number
  received_items_count?: number
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
  type: PurchaseOrderType
  supplier_name?: string
  customer_name?: string
  location_id?: string
  expected_delivery_date?: string
  notes?: string
  items: {
    product_id: string
    quantity: number
    unit_price: number
  }[]
  tax_amount?: number
  shipping_cost?: number
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
      locations:location_id (
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
    query = query.eq('type', params.type)
  }

  if (params?.status) {
    query = query.eq('status', params.status)
  }

  if (params?.locationIds && params?.locationIds.length > 0) {
    query = query.in('location_id', params.locationIds)
  }

  if (params?.search) {
    query = query.or(
      `po_number.ilike.%${params.search}%,supplier_name.ilike.%${params.search}%,customer_name.ilike.%${params.search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    logger.error('Failed to fetch purchase orders', { error })
    throw new Error(`Failed to fetch purchase orders: ${error.message}`)
  }

  // Flatten location data and compute counts
  const pos = (data || []).map((po: any) => {
    const location = Array.isArray(po.locations) ? po.locations[0] : po.locations
    const items = po.purchase_order_items || []

    return {
      ...po,
      location_name: location?.name || '',
      items_count: items.length,
      received_items_count: items.filter((item: any) => item.received_quantity > 0).length,
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
      locations:location_id (
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
    location_name: location?.name || '',
    items,
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
  const { items, ...poData } = params

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const taxAmount = params.tax_amount || 0
  const shippingCost = params.shipping_cost || 0
  const totalAmount = subtotal + taxAmount + shippingCost

  // 1. Create the purchase order
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      ...poData,
      vendor_id: vendorId,
      po_number: await generatePONumber(),
      status: 'draft',
      subtotal,
      tax_amount: taxAmount,
      shipping_cost: shippingCost,
      total_amount: totalAmount,
    })
    .select()
    .single()

  if (poError) {
    logger.error('Failed to create purchase order', { error: poError })
    throw new Error(`Failed to create purchase order: ${poError.message}`)
  }

  // 2. Create purchase order items
  const poItems = items.map((item) => ({
    purchase_order_id: po.id,
    product_id: item.product_id,
    quantity: item.quantity,
    received_quantity: 0,
    unit_price: item.unit_price,
    subtotal: item.quantity * item.unit_price,
  }))

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(poItems)

  if (itemsError) {
    // Rollback: delete the PO
    await supabase.from('purchase_orders').delete().eq('id', po.id)
    logger.error('Failed to create purchase order items', { error: itemsError })
    throw new Error(`Failed to create purchase order items: ${itemsError.message}`)
  }

  return po
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
        .select('received_quantity, quantity, product_id')
        .eq('id', item.item_id)
        .single()

      if (fetchError) throw fetchError

      const newReceivedQty = (poItem.received_quantity || 0) + item.quantity

      // Update received quantity and condition
      const { error: updateError } = await supabase
        .from('purchase_order_items')
        .update({
          received_quantity: newReceivedQty,
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
          received_quantity
        )
      `)
      .eq('id', poId)
      .single()

    if (po) {
      const allItems = po.purchase_order_items || []
      const fullyReceived = allItems.every(
        (item: any) => item.received_quantity >= item.quantity
      )

      const partiallyReceived = allItems.some(
        (item: any) => item.received_quantity > 0 && item.received_quantity < item.quantity
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
