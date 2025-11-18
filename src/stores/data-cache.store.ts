/**
 * Global Data Cache Store
 * Pre-loads and caches common data to eliminate per-screen loading delays
 */

import { create } from 'zustand'

interface CacheEntry<T> {
  data: T
  timestamp: number
  loading: boolean
}

interface DataCacheStore {
  // Cache entries
  cache: Map<string, CacheEntry<any>>

  // Cache operations
  get: <T>(key: string) => T | null
  set: <T>(key: string, data: T) => void
  has: (key: string) => boolean
  isStale: (key: string, ttl: number) => boolean
  invalidate: (key: string) => void
  clear: () => void
}

const CACHE_TTL = 30000 // 30 seconds default

export const useDataCache = create<DataCacheStore>((set, get) => ({
  cache: new Map(),

  get: <T,>(key: string): T | null => {
    const entry = get().cache.get(key)
    if (!entry) return null

    // Check if stale
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      return null
    }

    return entry.data
  },

  set: <T,>(key: string, data: T) => {
    set((state) => {
      const newCache = new Map(state.cache)
      newCache.set(key, {
        data,
        timestamp: Date.now(),
        loading: false,
      })
      return { cache: newCache }
    })
  },

  has: (key: string) => {
    const entry = get().cache.get(key)
    if (!entry) return false
    return Date.now() - entry.timestamp <= CACHE_TTL
  },

  isStale: (key: string, ttl: number = CACHE_TTL) => {
    const entry = get().cache.get(key)
    if (!entry) return true
    return Date.now() - entry.timestamp > ttl
  },

  invalidate: (key: string) => {
    set((state) => {
      const newCache = new Map(state.cache)
      newCache.delete(key)
      return { cache: newCache }
    })
  },

  clear: () => {
    set({ cache: new Map() })
  },
}))

// Helper function to create cache-aware data loaders
export function createCachedLoader<T>(
  key: string,
  loader: () => Promise<T>,
  ttl: number = CACHE_TTL
): () => Promise<T> {
  return async () => {
    const cache = useDataCache.getState()

    // Check cache first
    if (!cache.isStale(key, ttl)) {
      const cached = cache.get<T>(key)
      if (cached) return cached
    }

    // Load fresh data
    const data = await loader()
    cache.set(key, data)
    return data
  }
}
