/**
 * Inventory Transfers Service
 * Handles atomic location-to-location inventory transfers
 */

import { supabase } from '@/lib/supabase/client'
import type {
  InventoryTransfer,
  InventoryTransferItem,
  CreateTransferInput,
  ReceiveTransferInput,
  TransferStatus,
} from '@/types/pos'

// =====================================================
// QUERY FUNCTIONS
// =====================================================

/**
 * Fetch all transfers for a vendor with related data
 */
export async function fetchTransfers(
  vendorId: string,
  filters?: {
    status?: TransferStatus
    source_location_id?: string
    destination_location_id?: string
  }
): Promise<InventoryTransfer[]> {
  let query = supabase
    .from('inventory_transfers')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.source_location_id) {
    query = query.eq('source_location_id', filters.source_location_id)
  }
  if (filters?.destination_location_id) {
    query = query.eq('destination_location_id', filters.destination_location_id)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching transfers:', error)
    throw error
  }

  // Fetch related data separately for now (can optimize later with proper foreign key names)
  if (data && data.length > 0) {
    const transferIds = data.map(t => t.id)

    // Fetch items
    const { data: items } = await supabase
      .from('inventory_transfer_items')
      .select('*')
      .in('transfer_id', transferIds)

    // Fetch locations
    const locationIds = [
      ...new Set([
        ...data.map(t => t.source_location_id),
        ...data.map(t => t.destination_location_id)
      ])
    ]

    const { data: locations } = await supabase
      .from('locations')
      .select('*')
      .in('id', locationIds)

    // Combine data
    return data.map(transfer => ({
      ...transfer,
      items: items?.filter(i => i.transfer_id === transfer.id) || [],
      source_location: locations?.find(l => l.id === transfer.source_location_id),
      destination_location: locations?.find(l => l.id === transfer.destination_location_id)
    })) as InventoryTransfer[]
  }

  return (data || []) as InventoryTransfer[]
}

/**
 * Fetch a single transfer by ID
 */
export async function fetchTransferById(
  transferId: string
): Promise<InventoryTransfer | null> {
  const { data: transfer, error } = await supabase
    .from('inventory_transfers')
    .select('*')
    .eq('id', transferId)
    .single()

  if (error) {
    console.error('Error fetching transfer:', error)
    throw error
  }

  if (!transfer) return null

  // Fetch related data
  const { data: items } = await supabase
    .from('inventory_transfer_items')
    .select('*')
    .eq('transfer_id', transferId)

  const { data: sourceLocation } = await supabase
    .from('locations')
    .select('*')
    .eq('id', transfer.source_location_id)
    .single()

  const { data: destLocation } = await supabase
    .from('locations')
    .select('*')
    .eq('id', transfer.destination_location_id)
    .single()

  // Fetch products for items if needed
  if (items && items.length > 0) {
    const productIds = items.map(i => i.product_id)
    const { data: products } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        featured_image,
        regular_price,
        primary_category_id,
        primary_category:categories!primary_category_id(id, name)
      `)
      .in('id', productIds)

    // Attach products to items
    items.forEach(item => {
      const product = products?.find(p => p.id === item.product_id)
      if (product) {
        item.product = {
          ...product,
          image_url: product.featured_image,
          price: product.regular_price,
        }
      }
    })
  }

  // Fetch user details for created_by_user_id and received_by_user_id
  // Note: created_by_user_id is auth.users.id, we query users table by auth_user_id
  let createdByUser = null
  let receivedByUser = null

  if (transfer.created_by_user_id) {
    console.log('[TransferService] Fetching created_by user:', transfer.created_by_user_id)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('auth_user_id', transfer.created_by_user_id)
      .maybeSingle()
    if (userError) {
      console.error('[TransferService] Error fetching created_by user:', userError)
    } else {
      console.log('[TransferService] Created by user:', user)
      createdByUser = user
    }
  }

  if (transfer.received_by_user_id) {
    console.log('[TransferService] Fetching received_by user:', transfer.received_by_user_id)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('auth_user_id', transfer.received_by_user_id)
      .maybeSingle()
    if (userError) {
      console.error('[TransferService] Error fetching received_by user:', userError)
    } else {
      console.log('[TransferService] Received by user:', user)
      receivedByUser = user
    }
  }

  return {
    ...transfer,
    items: items || [],
    source_location: sourceLocation,
    destination_location: destLocation,
    created_by_user: createdByUser,
    received_by_user: receivedByUser
  } as InventoryTransfer
}

// =====================================================
// MUTATION FUNCTIONS
// =====================================================

/**
 * Create a new transfer in draft status
 */
export async function createTransfer(
  vendorId: string,
  input: CreateTransferInput,
  userId?: string
): Promise<string> {
  // Generate idempotency key
  const idempotencyKey = `transfer_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}`

  const { data, error } = await supabase.rpc('create_inventory_transfer', {
    p_vendor_id: vendorId,
    p_source_location_id: input.source_location_id,
    p_destination_location_id: input.destination_location_id,
    p_items: input.items,
    p_notes: input.notes || null,
    p_created_by_user_id: userId || null,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error('Error creating transfer:', error)
    throw error
  }

  return data as string
}

/**
 * Create and ship transfer atomically (no intermediate draft state)
 */
export async function createAndShipTransfer(
  vendorId: string,
  input: CreateTransferInput,
  trackingNumber?: string,
  userId?: string
): Promise<string> {
  // Generate idempotency key
  const idempotencyKey = `transfer_ship_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}`

  const { data, error } = await supabase.rpc('create_and_ship_transfer', {
    p_vendor_id: vendorId,
    p_source_location_id: input.source_location_id,
    p_destination_location_id: input.destination_location_id,
    p_items: input.items,
    p_notes: input.notes || null,
    p_tracking_number: trackingNumber || null,
    p_created_by_user_id: userId || null,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error('Error creating and shipping transfer:', error)
    throw error
  }

  return data as string
}

/**
 * Approve a transfer (creates inventory holds at source)
 */
export async function approveTransfer(
  transferId: string,
  userId?: string
): Promise<void> {
  const { data, error } = await supabase.rpc('approve_inventory_transfer', {
    p_transfer_id: transferId,
    p_approved_by_user_id: userId || null,
  })

  if (error) {
    console.error('Error approving transfer:', error)
    throw error
  }
}

/**
 * Mark transfer as shipped/in transit
 */
export async function markTransferInTransit(
  transferId: string,
  trackingNumber?: string
): Promise<void> {
  const { data, error } = await supabase.rpc('mark_transfer_in_transit', {
    p_transfer_id: transferId,
    p_tracking_number: trackingNumber || null,
  })

  if (error) {
    console.error('Error marking transfer in transit:', error)
    throw error
  }
}

/**
 * Complete a transfer (atomic deduct from source + add to destination)
 */
export async function completeTransfer(
  transferId: string,
  input: ReceiveTransferInput,
  userId?: string
): Promise<{
  success: boolean
  items_processed: number
  items_good: number
  items_damaged: number
}> {
  const { data, error } = await supabase.rpc('complete_inventory_transfer', {
    p_transfer_id: transferId,
    p_received_items: input.items,
    p_received_by_user_id: userId || null,
  })

  if (error) {
    console.error('Error completing transfer:', error)
    throw error
  }

  return data[0] as {
    success: boolean
    items_processed: number
    items_good: number
    items_damaged: number
  }
}

/**
 * Cancel a transfer (releases holds if any)
 */
export async function cancelTransfer(
  transferId: string,
  reason?: string,
  userId?: string
): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_inventory_transfer', {
    p_transfer_id: transferId,
    p_cancelled_by_user_id: userId || null,
    p_reason: reason || null,
  })

  if (error) {
    console.error('Error cancelling transfer:', error)
    throw error
  }
}

/**
 * Update transfer notes (only allowed in draft status)
 */
export async function updateTransferNotes(
  transferId: string,
  notes: string
): Promise<void> {
  const { error } = await supabase
    .from('inventory_transfers')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', transferId)
    .eq('status', 'draft') // Only allow updating draft transfers

  if (error) {
    console.error('Error updating transfer notes:', error)
    throw error
  }
}

/**
 * Delete a draft transfer
 */
export async function deleteDraftTransfer(transferId: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_transfers')
    .delete()
    .eq('id', transferId)
    .eq('status', 'draft') // Only allow deleting draft transfers

  if (error) {
    console.error('Error deleting transfer:', error)
    throw error
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get transfer status badge color
 */
export function getTransferStatusColor(status: TransferStatus): string {
  switch (status) {
    case 'draft':
      return '#6B7280' // gray
    case 'approved':
      return '#3B82F6' // blue
    case 'in_transit':
      return '#8B5CF6' // purple
    case 'completed':
      return '#10B981' // green
    case 'cancelled':
      return '#EF4444' // red
    default:
      return '#6B7280'
  }
}

/**
 * Get transfer status display label
 */
export function getTransferStatusLabel(status: TransferStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'approved':
      return 'Approved'
    case 'in_transit':
      return 'In Transit'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

/**
 * Check if transfer can be edited
 */
export function canEditTransfer(status: TransferStatus): boolean {
  return status === 'draft'
}

/**
 * Check if transfer can be approved
 */
export function canApproveTransfer(status: TransferStatus): boolean {
  return status === 'draft'
}

/**
 * Check if transfer can be marked in transit
 */
export function canMarkInTransit(status: TransferStatus): boolean {
  return status === 'approved'
}

/**
 * Check if transfer can be received
 */
export function canReceiveTransfer(status: TransferStatus): boolean {
  return status === 'approved' || status === 'in_transit'
}

/**
 * Check if transfer can be cancelled
 */
export function canCancelTransfer(status: TransferStatus): boolean {
  return status !== 'completed' && status !== 'cancelled'
}
