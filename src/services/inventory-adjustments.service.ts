import { supabase } from '@/lib/supabase/client';
import { logger } from '@/utils/logger';

export type AdjustmentType =
  | 'count_correction'
  | 'damage'
  | 'shrinkage'
  | 'theft'
  | 'expired'
  | 'received'
  | 'return'
  | 'other';

export interface InventoryAdjustment {
  id: string;
  product_id: string;
  location_id: string;
  adjustment_type: AdjustmentType;
  quantity_before: number;
  quantity_after: number;
  quantity_change: number;
  reason: string;
  notes?: string;
  reference_id?: string;
  reference_type?: string;
  created_by?: string;
  created_at: string;
  vendor_id: string;
  // Joined data
  product?: {
    id: string;
    name: string;
    sku?: string;
  };
  location?: {
    id: string;
    name: string;
  };
  created_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface CreateAdjustmentInput {
  product_id: string;
  location_id: string;
  adjustment_type: AdjustmentType;
  quantity_change: number;
  reason: string;
  notes?: string;
  reference_id?: string;
  reference_type?: string;
}

export interface AdjustmentFilters {
  product_id?: string;
  location_id?: string;
  adjustment_type?: AdjustmentType;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch inventory adjustments with optional filters
 */
export async function fetchInventoryAdjustments(
  vendorId: string,
  filters: AdjustmentFilters = {}
): Promise<{ data: InventoryAdjustment[] | null; error: any }> {
  try {
    let query = supabase
      .from('inventory_adjustments')
      .select(`
        *,
        product:products(id, name, sku),
        location:locations(id, name)
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (filters.product_id) {
      query = query.eq('product_id', filters.product_id);
    }

    if (filters.location_id) {
      query = query.eq('location_id', filters.location_id);
    }

    if (filters.adjustment_type) {
      query = query.eq('adjustment_type', filters.adjustment_type);
    }

    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching inventory adjustments:', error);
      return { data: null, error };
    }

    // Fetch user data separately for adjustments that have created_by
    // NOTE: created_by stores auth.uid() (auth_user_id), not users.id
    // The users table RLS policy only allows: auth_user_id = auth.uid()
    // So we query by auth_user_id to find the matching user records
    if (data && data.length > 0) {
      const authUserIds = [...new Set(data.map(adj => adj.created_by).filter(Boolean))] as string[]

      if (authUserIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, auth_user_id')
          .in('auth_user_id', authUserIds)

        if (!usersError && users) {
          // Map users by auth_user_id to adjustments
          logger.info('Users found for adjustments:', JSON.stringify(users, null, 2))
          const usersMap = new Map(users.map(u => [u.auth_user_id, u]))
          data.forEach(adj => {
            if (adj.created_by) {
              adj.created_by_user = usersMap.get(adj.created_by)
              logger.info(`Mapped user for adjustment ${adj.id}:`, JSON.stringify(adj.created_by_user, null, 2))
            }
          })
        } else if (usersError) {
          logger.error('Error fetching users for adjustments:', usersError)
        }
      }
    }

    return { data: data as InventoryAdjustment[], error: null };
  } catch (error) {
    logger.error('Error in fetchInventoryAdjustments:', error);
    return { data: null, error };
  }
}

/**
 * Create a new inventory adjustment and update inventory quantity
 * Uses atomic database function to prevent race conditions and ensure consistency
 */
export async function createInventoryAdjustment(
  vendorId: string,
  input: CreateAdjustmentInput
): Promise<{
  data: InventoryAdjustment | null;
  error: any;
  metadata?: {
    quantity_before: number;
    quantity_after: number;
    product_total_stock: number;
  }
}> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Generate idempotency key for safe retries
    const idempotencyKey = `adj-${input.product_id}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Build params object - only include reference_id if it's a valid UUID
    const rpcParams: Record<string, any> = {
      p_vendor_id: vendorId,
      p_product_id: input.product_id,
      p_location_id: input.location_id,
      p_adjustment_type: input.adjustment_type,
      p_quantity_change: input.quantity_change,
      p_reason: input.reason,
      p_notes: input.notes || null,
      p_reference_type: input.reference_type || null,
      p_created_by: user?.id || null,
      p_idempotency_key: idempotencyKey,
    };

    // Only pass reference_id if it's a valid UUID string
    if (input.reference_id && input.reference_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      rpcParams.p_reference_id = input.reference_id;
    }

    logger.info('RPC params:', JSON.stringify(rpcParams, null, 2));

    // Call atomic database function
    const { data: result, error: rpcError } = await supabase.rpc(
      'process_inventory_adjustment',
      rpcParams
    );

    if (rpcError) {
      logger.error('Error creating adjustment:', rpcError);
      logger.error('RPC Error Details:', JSON.stringify({
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
      }, null, 2));
      return { data: null, error: rpcError };
    }

    if (!result || result.length === 0) {
      const error = new Error('No result returned from adjustment function');
      logger.error('Invalid adjustment result:', error);
      return { data: null, error };
    }

    const adjustmentResult = result[0];

    // Fetch the full adjustment record with joined data for UI
    const { data: adjustmentData, error: fetchError } = await supabase
      .from('inventory_adjustments')
      .select(`
        *,
        product:products(id, name, sku),
        location:locations(id, name)
      `)
      .eq('id', adjustmentResult.adjustment_id)
      .single();

    if (fetchError) {
      logger.error('Error fetching adjustment details:', fetchError);
      return { data: null, error: fetchError };
    }

    logger.info('Inventory adjustment created successfully:', adjustmentResult.adjustment_id, {
      quantity_before: adjustmentResult.quantity_before,
      quantity_after: adjustmentResult.quantity_after,
      product_total_stock: adjustmentResult.product_total_stock,
    });

    return {
      data: adjustmentData as InventoryAdjustment,
      error: null,
      metadata: {
        quantity_before: adjustmentResult.quantity_before,
        quantity_after: adjustmentResult.quantity_after,
        product_total_stock: adjustmentResult.product_total_stock,
      }
    };
  } catch (error) {
    logger.error('Error in createInventoryAdjustment:', error);
    return { data: null, error };
  }
}

/**
 * Create multiple inventory adjustments atomically in a single transaction
 * Much faster than creating adjustments one by one - perfect for audits
 */
export async function createBulkInventoryAdjustments(
  vendorId: string,
  adjustments: CreateAdjustmentInput[],
  batchIdempotencyKey?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Generate batch idempotency key if not provided
    const idempotencyKey = batchIdempotencyKey || `bulk-${vendorId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Format adjustments for the bulk function
    const formattedAdjustments = adjustments.map(adj => ({
      product_id: adj.product_id,
      location_id: adj.location_id,
      adjustment_type: adj.adjustment_type,
      quantity_change: adj.quantity_change,
      reason: adj.reason,
      notes: adj.notes || null,
      created_by: user?.id || null, // Track which staff member made the adjustment
      idempotency_key: `${idempotencyKey}-${adj.product_id}-${adj.location_id}`,
    }));

    logger.info('Creating bulk inventory adjustments', {
      count: adjustments.length,
      batchId: idempotencyKey,
    });

    // Call bulk RPC function
    const { data: results, error: rpcError } = await supabase.rpc(
      'process_bulk_inventory_adjustments',
      {
        p_vendor_id: vendorId,
        p_adjustments: formattedAdjustments, // Don't stringify - let PostgREST handle JSON conversion
        p_idempotency_key: idempotencyKey,
      }
    );

    if (rpcError) {
      logger.error('Error in bulk adjustment RPC:', rpcError);
      logger.error('RPC Error Details:', JSON.stringify({
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
      }, null, 2));
      return { data: null, error: rpcError, results: [] };
    }

    // Count successes and failures
    const successCount = results?.filter((r: any) => r.success).length || 0;
    const failureCount = results?.filter((r: any) => !r.success).length || 0;
    const failures = results?.filter((r: any) => !r.success) || [];

    logger.info('Bulk inventory adjustments completed', {
      total: adjustments.length,
      succeeded: successCount,
      failed: failureCount,
      batchId: idempotencyKey,
    });

    // Log individual failures for debugging
    if (failures.length > 0) {
      logger.error('Bulk adjustment failures:', JSON.stringify(failures.map((f: any) => ({
        product_id: f.product_id,
        error: f.error_message,
      })), null, 2));
    }

    return {
      data: {
        batchId: idempotencyKey,
        total: adjustments.length,
        succeeded: successCount,
        failed: failureCount,
      },
      error: null,
      results: results || [],
    };
  } catch (error) {
    logger.error('Error in createBulkInventoryAdjustments:', error);
    return { data: null, error, results: [] };
  }
}

/**
 * Get adjustment statistics for a product
 */
export async function getAdjustmentStats(
  vendorId: string,
  productId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  total_adjustments: number;
  total_increase: number;
  total_decrease: number;
  by_type: Record<AdjustmentType, number>;
}> {
  try {
    let query = supabase
      .from('inventory_adjustments')
      .select('adjustment_type, quantity_change')
      .eq('vendor_id', vendorId)
      .eq('product_id', productId);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;

    if (error || !data) {
      return {
        total_adjustments: 0,
        total_increase: 0,
        total_decrease: 0,
        by_type: {} as Record<AdjustmentType, number>
      };
    }

    const stats = data.reduce((acc, adj) => {
      acc.total_adjustments += 1;
      if (adj.quantity_change > 0) {
        acc.total_increase += adj.quantity_change;
      } else {
        acc.total_decrease += Math.abs(adj.quantity_change);
      }
      const type = adj.adjustment_type as AdjustmentType;
      acc.by_type[type] = (acc.by_type[type] || 0) + 1;
      return acc;
    }, {
      total_adjustments: 0,
      total_increase: 0,
      total_decrease: 0,
      by_type: {} as Record<AdjustmentType, number>
    });

    return stats;
  } catch (error) {
    logger.error('Error in getAdjustmentStats:', error);
    return {
      total_adjustments: 0,
      total_increase: 0,
      total_decrease: 0,
      by_type: {} as Record<AdjustmentType, number>
    };
  }
}
