/**
 * Data Hook Factory - Apple Engineering Standard
 *
 * Principle: One consistent pattern for all data fetching
 * Benefits:
 * - Consistent error handling
 * - Automatic caching
 * - Loading states
 * - Refetch capabilities
 * - Type safety
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createKeyedCache, CACHE_TTL } from '../lib/cache';

export interface DataHookOptions<T> {
  /** Cache TTL in milliseconds (default: 30s) */
  cacheTtl?: number;
  /** Whether to fetch on mount (default: true) */
  fetchOnMount?: boolean;
  /** Whether to enable caching (default: true) */
  enableCache?: boolean;
  /** Dependencies that trigger refetch when changed */
  dependencies?: any[];
  /** Called when data is successfully loaded */
  onSuccess?: (data: T) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

export interface DataHookResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: (data: T | null) => void;
}

/**
 * Creates a standardized data-fetching hook
 *
 * @example
 * const useSuppliers = createDataHook(
 *   async (supabase) => {
 *     const { data } = await supabase.from('suppliers').select('*');
 *     return data;
 *   },
 *   { cacheTtl: CACHE_TTL.LONG }
 * );
 */
export function createDataHook<T>(
  fetcher: (params?: any) => Promise<T>,
  options: DataHookOptions<T> = {}
): (params?: any) => DataHookResult<T> {
  const {
    cacheTtl = CACHE_TTL.REALTIME,
    fetchOnMount = true,
    enableCache = true,
    onSuccess,
    onError,
  } = options;

  // Create cache for this hook
  const cache = enableCache ? createKeyedCache<T>(cacheTtl) : null;

  return (params?: any): DataHookResult<T> => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(fetchOnMount);
    const [error, setError] = useState<string | null>(null);

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Generate cache key from params
    const cacheKey = params ? JSON.stringify(params) : 'default';

    const load = useCallback(async () => {
      try {
        // Check cache first
        if (cache) {
          const cachedData = cache.get(cacheKey);
          if (cachedData) {
            if (isMountedRef.current) {
              setData(cachedData);
              setLoading(false);
              setError(null);
            }
            return;
          }
        }

        if (isMountedRef.current) {
          setLoading(true);
          setError(null);
        }

        const result = await fetcher(params);

        if (isMountedRef.current) {
          setData(result);
          setError(null);

          // Cache the result
          if (cache) {
            cache.set(cacheKey, result);
          }

          onSuccess?.(result);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

        if (isMountedRef.current) {
          setError(errorMessage);
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }, [cacheKey, params]);

    // Fetch on mount
    useEffect(() => {
      isMountedRef.current = true;

      if (fetchOnMount) {
        load();
      }

      return () => {
        isMountedRef.current = false;
      };
    }, [load, fetchOnMount]);

    return {
      data,
      loading,
      error,
      reload: load,
      setData,
    };
  };
}

/**
 * Creates a data hook with manual control (doesn't fetch on mount)
 */
export function createLazyDataHook<T, P = any>(
  fetcher: (params: P) => Promise<T>,
  options: Omit<DataHookOptions<T>, 'fetchOnMount'> = {}
) {
  return createDataHook(fetcher, {
    ...options,
    fetchOnMount: false,
  });
}

/**
 * Clears all caches for data hooks
 * Useful for logout or global refresh
 */
export const clearAllDataCaches = () => {
  // This will be populated as hooks are created
  // For now, it's a placeholder for future implementation
};
