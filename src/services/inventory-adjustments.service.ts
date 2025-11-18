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

    return { data: data as InventoryAdjustment[], error: null };
  } catch (error) {
    logger.error('Error in fetchInventoryAdjustments:', error);
    return { data: null, error };
  }
}

/**
 * Create a new inventory adjustment and update inventory quantity
 */
export async function createInventoryAdjustment(
  vendorId: string,
  input: CreateAdjustmentInput
): Promise<{ data: InventoryAdjustment | null; error: any }> {
  try {
    // First, get current inventory quantity
    const { data: inventoryData, error: inventoryError } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', input.product_id)
      .eq('location_id', input.location_id)
      .single();

    if (inventoryError) {
      logger.error('Error fetching current inventory:', inventoryError);
      return { data: null, error: inventoryError };
    }

    const currentQuantity = inventoryData?.quantity || 0;
    const newQuantity = currentQuantity + input.quantity_change;

    if (newQuantity < 0) {
      const error = new Error('Adjustment would result in negative inventory');
      logger.error('Invalid adjustment:', error);
      return { data: null, error };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    // Create the adjustment record
    const { data: adjustmentData, error: adjustmentError } = await supabase
      .from('inventory_adjustments')
      .insert({
        vendor_id: vendorId,
        product_id: input.product_id,
        location_id: input.location_id,
        adjustment_type: input.adjustment_type,
        quantity_before: currentQuantity,
        quantity_after: newQuantity,
        quantity_change: input.quantity_change,
        reason: input.reason,
        notes: input.notes,
        reference_id: input.reference_id,
        reference_type: input.reference_type,
        created_by: user?.id,
      })
      .select(`
        *,
        product:products(id, name, sku),
        location:locations(id, name)
      `)
      .single();

    if (adjustmentError) {
      logger.error('Error creating adjustment:', adjustmentError);
      return { data: null, error: adjustmentError };
    }

    // Update inventory quantity (available_quantity is a generated column)
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        quantity: newQuantity
      })
      .eq('product_id', input.product_id)
      .eq('location_id', input.location_id);

    if (updateError) {
      logger.error('Error updating inventory:', updateError);
      return { data: null, error: updateError };
    }

    // Also update product total_stock if exists
    const { data: allInventory } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', input.product_id);

    if (allInventory) {
      const totalStock = allInventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
      await supabase
        .from('products')
        .update({ stock_quantity: totalStock })
        .eq('id', input.product_id);
    }

    logger.info('Inventory adjustment created successfully:', adjustmentData.id);
    return { data: adjustmentData as InventoryAdjustment, error: null };
  } catch (error) {
    logger.error('Error in createInventoryAdjustment:', error);
    return { data: null, error };
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
