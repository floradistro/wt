import { useState, useEffect, useCallback } from 'react';
import {
  fetchInventoryAdjustments,
  createInventoryAdjustment,
  getAdjustmentStats,
  InventoryAdjustment,
  CreateAdjustmentInput,
  AdjustmentFilters,
  AdjustmentType,
} from '@/services/inventory-adjustments.service';
import { useAuth } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/utils/logger';

export function useInventoryAdjustments(filters?: AdjustmentFilters) {
  const { user } = useAuth();
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total_adjustments: number;
    total_increase: number;
    total_decrease: number;
    by_type: Record<AdjustmentType, number>;
  } | null>(null);

  // Get vendor ID from user
  useEffect(() => {
    const getVendorId = async () => {
      if (!user?.email) return;

      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (userError || !userData) {
          throw new Error('User record not found');
        }
        setVendorId(userData?.vendor_id);
      } catch (err) {
        logger.error('Error fetching vendor ID:', err);
      }
    };

    getVendorId();
  }, [user?.email]);

  const loadAdjustments = useCallback(async () => {
    if (!vendorId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await fetchInventoryAdjustments(
        vendorId,
        filters
      );

      if (fetchError) {
        throw fetchError;
      }

      setAdjustments(data || []);
    } catch (err) {
      logger.error('Error loading inventory adjustments:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [vendorId, filters]);

  const loadStats = useCallback(async (
    productId: string,
    startDate?: string,
    endDate?: string
  ) => {
    if (!vendorId) return;

    try {
      const statsData = await getAdjustmentStats(
        vendorId,
        productId,
        startDate,
        endDate
      );
      setStats(statsData);
    } catch (err) {
      logger.error('Error loading adjustment stats:', err);
    }
  }, [vendorId]);

  const createAdjustment = useCallback(async (input: CreateAdjustmentInput) => {
    if (!vendorId) {
      throw new Error('No vendor found');
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: createError } = await createInventoryAdjustment(
        vendorId,
        input
      );

      if (createError) {
        throw createError;
      }

      // Reload adjustments after creation
      await loadAdjustments();

      return data;
    } catch (err) {
      logger.error('Error creating adjustment:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [vendorId, loadAdjustments]);

  useEffect(() => {
    if (vendorId) {
      loadAdjustments();
    }
  }, [vendorId, loadAdjustments]);

  return {
    adjustments,
    loading,
    error,
    stats,
    vendorId,
    loadAdjustments,
    loadStats,
    createAdjustment,
  };
}

// Specialized hook for a specific product
export function useProductAdjustments(productId?: string, locationId?: string) {
  const filters: AdjustmentFilters = {
    product_id: productId,
    location_id: locationId,
  };

  return useInventoryAdjustments(filters);
}
