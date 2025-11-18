import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

// Simple in-memory cache (30 seconds TTL)
const productsCache = new Map<string, { data: any[]; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds

export interface PricingTier {
  id: string
  label: string
  quantity: number
  unit: string
  price: number
  enabled: boolean
  sort_order: number
}

export interface PricingData {
  mode: 'single' | 'tiered'
  single_price?: number | null
  tiers?: PricingTier[]
  template_id?: string | null
  template_name?: string | null
  updated_at?: string
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  sku: string | null
  type: string
  status: string
  regular_price: number | null
  sale_price: number | null
  price: number | null
  cost_price: number | null
  wholesale_price: number | null
  on_sale: boolean
  featured_image: string | null
  image_gallery: string[]
  stock_quantity: number | null
  stock_status: string
  featured: boolean
  primary_category_id: string | null
  vendor_id: string | null
  created_at: string
  updated_at: string

  // Pricing Data (JSONB)
  pricing_data?: PricingData | null

  // Custom Fields (JSONB)
  custom_fields?: Record<string, any> | null

  // Computed/joined fields
  inventory?: ProductInventory[]
  total_stock?: number
}

export interface ProductInventory {
  location_id: string
  location_name: string
  quantity: number
  available_quantity: number
  stock_status: string
}

interface UseProductsOptions {
  search?: string
  categoryId?: string
  featured?: boolean
  inStock?: boolean
  limit?: number
}

export function useProducts(options: UseProductsOptions = {}) {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    try {
      if (!user?.email) {
        throw new Error('User not authenticated')
      }

      // Check cache first
      const cacheKey = `products-${user.email}-${options.search || ''}-${options.categoryId || ''}`
      const cached = productsCache.get(cacheKey)
      const now = Date.now()

      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        setProducts(cached.data)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      // Get user's vendor_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      logger.info('Loading products', { vendorId: userData.vendor_id, options })

      // Build query
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          description,
          short_description,
          sku,
          type,
          status,
          regular_price,
          sale_price,
          price,
          cost_price,
          wholesale_price,
          on_sale,
          featured_image,
          image_gallery,
          stock_quantity,
          stock_status,
          featured,
          primary_category_id,
          vendor_id,
          pricing_data,
          custom_fields,
          created_at,
          updated_at
        `)
        .eq('vendor_id', userData.vendor_id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })

      // Apply filters
      if (options.search) {
        query = query.ilike('name', `%${options.search}%`)
      }

      if (options.categoryId) {
        query = query.eq('primary_category_id', options.categoryId)
      }

      if (options.featured) {
        query = query.eq('featured', true)
      }

      if (options.inStock) {
        query = query.gt('stock_quantity', 0)
      }

      if (options.limit) {
        query = query.limit(options.limit)
      }

      const { data: productsData, error: productsError } = await query

      if (productsError) throw productsError

      // For each product, get inventory across all locations
      const productsWithInventory = await Promise.all(
        (productsData || []).map(async (product) => {
          const { data: inventoryData } = await supabase
            .from('inventory')
            .select(`
              location_id,
              quantity,
              available_quantity,
              stock_status,
              locations!inner(name)
            `)
            .eq('product_id', product.id)

          const inventory: ProductInventory[] = (inventoryData || []).map((inv: any) => ({
            location_id: inv.location_id,
            location_name: inv.locations.name,
            quantity: inv.quantity,
            available_quantity: inv.available_quantity,
            stock_status: inv.stock_status,
          }))

          const total_stock = inventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0)

          return {
            ...product,
            inventory,
            total_stock,
          }
        })
      )

      // Cache the results
      productsCache.set(cacheKey, {
        data: productsWithInventory,
        timestamp: Date.now()
      })

      setProducts(productsWithInventory)
      logger.info('Products loaded', { count: productsWithInventory.length })
    } catch (err) {
      logger.error('Failed to load products', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }, [user, options.search, options.categoryId, options.featured, options.inStock, options.limit])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const reload = useCallback(() => {
    // Clear cache when manually reloading
    if (user?.email) {
      const cacheKey = `products-${user.email}-${options.search || ''}-${options.categoryId || ''}`
      productsCache.delete(cacheKey)
    }
    return loadProducts()
  }, [user?.email, options.search, options.categoryId, loadProducts])

  return {
    products,
    isLoading,
    error,
    reload,
  }
}
