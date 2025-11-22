/**
 * Intelligent caching system for data hooks
 * Apple Engineering Principle: Cache aggressively, invalidate intelligently
 */

export interface CacheOptions {
  ttlMs?: number;
  maxSize?: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Creates a simple TTL-based cache for single values
 */
export const createCache = <T>(ttlMs: number = 30000) => {
  let cache: T | null = null;
  let timestamp = 0;

  return {
    get: (): T | null => {
      if (Date.now() - timestamp < ttlMs) {
        return cache;
      }
      return null;
    },
    set: (data: T): void => {
      cache = data;
      timestamp = Date.now();
    },
    clear: (): void => {
      cache = null;
      timestamp = 0;
    },
    isValid: (): boolean => {
      return cache !== null && Date.now() - timestamp < ttlMs;
    },
  };
};

/**
 * Creates a keyed cache for storing multiple values
 * Useful for caching data by vendor ID, location ID, etc.
 */
export const createKeyedCache = <T>(ttlMs: number = 30000, maxSize: number = 100) => {
  const cache = new Map<string, CacheEntry<T>>();

  const cleanupExpired = () => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp >= ttlMs) {
        cache.delete(key);
      }
    }
  };

  const enforceMaxSize = () => {
    if (cache.size > maxSize) {
      // Remove oldest entries
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, cache.size - maxSize);
      toRemove.forEach(([key]) => cache.delete(key));
    }
  };

  return {
    get: (key: string): T | null => {
      cleanupExpired();
      const entry = cache.get(key);
      if (!entry) return null;

      if (Date.now() - entry.timestamp < ttlMs) {
        return entry.data;
      }

      cache.delete(key);
      return null;
    },
    set: (key: string, data: T): void => {
      cache.set(key, { data, timestamp: Date.now() });
      enforceMaxSize();
    },
    clear: (key?: string): void => {
      if (key) {
        cache.delete(key);
      } else {
        cache.clear();
      }
    },
    clearAll: (): void => {
      cache.clear();
    },
    has: (key: string): boolean => {
      const entry = cache.get(key);
      if (!entry) return false;
      return Date.now() - entry.timestamp < ttlMs;
    },
    invalidate: (predicate: (key: string, data: T) => boolean): void => {
      for (const [key, entry] of cache.entries()) {
        if (predicate(key, entry.data)) {
          cache.delete(key);
        }
      }
    },
  };
};

/**
 * Cache TTL constants following Apple's data freshness guidelines
 */
export const CACHE_TTL = {
  /** 10 seconds - Frequently changing data (inventory, cart) */
  INSTANT: 10000,
  /** 30 seconds - Real-time data (products, orders) */
  REALTIME: 30000,
  /** 1 minute - Semi-static data (customers, purchase orders) */
  SHORT: 60000,
  /** 5 minutes - Static data (categories, pricing templates) */
  MEDIUM: 300000,
  /** 15 minutes - Rarely changing data (suppliers, users) */
  LONG: 900000,
  /** 1 hour - Very static data (custom fields, configurations) */
  EXTENDED: 3600000,
} as const;
