import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/stores/auth.store'
import { logger } from '@/utils/logger'

export interface LocationInventory {
  inventory_id: string
  location_id: string
  location_name: string
  quantity: number
  available_quantity: number
  stock_status: string
}

export interface ProductInventory {
  product_id: string
  product_name: string
  sku: string | null
  category: string | null
  price: number | null
  cost_price: number | null
  total_quantity: number
  locations: LocationInventory[]
}

interface UseInventoryOptions {
  search?: string
  locationId?: string | null
  stockFilter?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  categoryId?: string | null
  hideZero?: boolean
}

export function useInventory(options: UseInventoryOptions = {}) {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<ProductInventory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadInventory = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!user?.email) {
        throw new Error('User not authenticated')
      }

      // Get user's vendor_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('vendor_id')
        .eq('email', user.email)
        .single()

      if (userError) throw userError

      logger.info('Loading inventory', { vendorId: userData.vendor_id, options })

      // Get all products for this vendor
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          price,
          primary_category_id
        `)
        .eq('vendor_id', userData.vendor_id)
        .eq('status', 'published')
        .order('name')

      if (productsError) throw productsError

      // For each product, get inventory across locations
      const inventoryData = await Promise.all(
        (productsData || []).map(async (product) => {
          // Build inventory query
          let invQuery = supabase
            .from('inventory')
            .select(`
              id,
              location_id,
              quantity,
              available_quantity,
              stock_status,
              locations!inner(
                id,
                name
              )
            `)
            .eq('product_id', product.id)

          // Filter by location if specified
          if (options.locationId) {
            invQuery = invQuery.eq('location_id', options.locationId)
          }

          const { data: invData } = await invQuery

          const locations: LocationInventory[] = (invData || []).map((inv: any) => ({
            inventory_id: inv.id,
            location_id: inv.location_id,
            location_name: inv.locations.name,
            quantity: inv.quantity || 0,
            available_quantity: inv.available_quantity || 0,
            stock_status: inv.stock_status || 'out_of_stock',
          }))

          const total_quantity = locations.reduce((sum, loc) => sum + loc.quantity, 0)

          return {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            category: null, // TODO: Join categories
            price: product.price,
            cost_price: null, // TODO: Add cost price to products
            total_quantity,
            locations,
          }
        })
      )

      // Apply filters
      let filteredInventory = inventoryData

      // Search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase()
        filteredInventory = filteredInventory.filter(
          (item) =>
            item.product_name.toLowerCase().includes(searchLower) ||
            (item.sku && item.sku.toLowerCase().includes(searchLower))
        )
      }

      // Stock filter
      if (options.stockFilter && options.stockFilter !== 'all') {
        filteredInventory = filteredInventory.filter((item) => {
          const total = item.total_quantity
          switch (options.stockFilter) {
            case 'in_stock':
              return total > 10
            case 'low_stock':
              return total > 0 && total <= 10
            case 'out_of_stock':
              return total === 0
            default:
              return true
          }
        })
      }

      // Hide zero inventory
      if (options.hideZero) {
        filteredInventory = filteredInventory.filter((item) => item.total_quantity > 0)
      }

      setInventory(filteredInventory)
      logger.info('Inventory loaded', { count: filteredInventory.length })
    } catch (err) {
      logger.error('Failed to load inventory', { error: err })
      setError(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }, [
    user,
    options.search,
    options.locationId,
    options.stockFilter,
    options.categoryId,
    options.hideZero,
  ])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  return {
    inventory,
    isLoading,
    error,
    reload: loadInventory,
  }
}
