import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchSalesHistory,
  getSalesStats,
  SalesRecord,
  SalesStats,
  SalesHistoryFilters,
} from '@/services/sales-history.service';
import { useAuth } from '@/stores/auth.store';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/utils/logger';

export function useSalesHistory(filters?: SalesHistoryFilters) {
  const { user } = useAuth();
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const filtersRef = useRef(filters);

  // Update filters ref when they change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Get vendor ID from user
  useEffect(() => {
    const getVendorId = async () => {
      if (!user?.email) return;

      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('vendor_id')
          .eq('email', user.email)
          .single();

        if (userError) throw userError;
        setVendorId(userData?.vendor_id);
      } catch (err) {
        logger.error('Error fetching vendor ID:', err);
      }
    };

    getVendorId();
  }, [user?.email]);

  const loadSalesHistory = useCallback(async () => {
    if (!vendorId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await fetchSalesHistory(
        vendorId,
        filtersRef.current
      );

      if (fetchError) {
        throw fetchError;
      }

      setSalesRecords(data || []);
    } catch (err) {
      logger.error('Error loading sales history:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  const loadStats = useCallback(async (
    productId?: string,
    startDate?: string,
    endDate?: string
  ) => {
    if (!vendorId) return;

    setLoading(true);

    try {
      const statsData = await getSalesStats(
        vendorId,
        productId,
        startDate,
        endDate
      );
      setStats(statsData);
    } catch (err) {
      logger.error('Error loading sales stats:', err);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  // Only load once when vendorId is set
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (vendorId && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSalesHistory();
    }
  }, [vendorId, loadSalesHistory]);

  return {
    salesRecords,
    loading,
    error,
    stats,
    loadSalesHistory,
    loadStats,
  };
}

// Specialized hook for a specific product's sales
export function useProductSalesHistory(
  productId?: string,
  startDate?: string,
  endDate?: string
) {
  const filters: SalesHistoryFilters = {
    product_id: productId,
    start_date: startDate,
    end_date: endDate,
  };

  const hook = useSalesHistory(filters);
  const statsLoadedRef = useRef(false);

  // Auto-load stats when filters change (only once)
  useEffect(() => {
    if (productId && hook.loadStats && !statsLoadedRef.current) {
      statsLoadedRef.current = true;
      hook.loadStats(productId, startDate, endDate);
    }
  }, [productId, startDate, endDate, hook.loadStats]);

  return hook;
}
