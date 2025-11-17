/**
 * Products Service
 *
 * Handles all product operations using Supabase directly.
 * Use this instead of calling /api/products
 */

import { supabase } from '@/lib/supabase/client'

export interface Product {
  id: string
  name: string
  sku?: string
  barcode?: string
  price: number
  cost?: number
  category_id?: string
  vendor_id?: string
  image_url?: string
  description?: string
  is_active: boolean
  track_inventory: boolean
  created_at: string
  updated_at: string
}

export interface ProductWithInventory extends Product {
  inventory?: {
    quantity: number
    location_id: string
  }[]
}

/**
 * Get all products
 */
export async function getProducts(params?: {
  limit?: number
  categoryId?: string
  isActive?: boolean
  searchTerm?: string
}): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })

  if (params?.categoryId) {
    query = query.eq('category_id', params.categoryId)
  }

  if (params?.isActive !== undefined) {
    query = query.eq('is_active', params.isActive)
  }

  if (params?.searchTerm) {
    query = query.or(
      `name.ilike.%${params.searchTerm}%,sku.ilike.%${params.searchTerm}%,barcode.eq.${params.searchTerm}`
    )
  }

  if (params?.limit) {
    query = query.limit(params.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`)
  }

  return data || []
}

/**
 * Get product by ID
 */
export async function getProductById(productId: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch product: ${error.message}`)
  }

  return data
}

/**
 * Get product by barcode (for POS scanning)
 */
export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No product found
      return null
    }
    throw new Error(`Failed to fetch product by barcode: ${error.message}`)
  }

  return data
}

/**
 * Get product by SKU
 */
export async function getProductBySku(sku: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch product by SKU: ${error.message}`)
  }

  return data
}

/**
 * Get products with inventory for a specific location
 */
export async function getProductsWithInventory(
  locationId: string
): Promise<ProductWithInventory[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      inventory!inner (
        quantity,
        location_id
      )
    `
    )
    .eq('inventory.location_id', locationId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch products with inventory: ${error.message}`)
  }

  return data || []
}

/**
 * Search products (for POS quick search)
 */
export async function searchProducts(searchTerm: string, limit = 20): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(
      `name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,barcode.eq.${searchTerm}`
    )
    .eq('is_active', true)
    .order('name')
    .limit(limit)

  if (error) {
    throw new Error(`Failed to search products: ${error.message}`)
  }

  return data || []
}

/**
 * Get products by category
 */
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch products by category: ${error.message}`)
  }

  return data || []
}

/**
 * Get product inventory for a location
 */
export async function getProductInventory(
  productId: string,
  locationId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('product_id', productId)
    .eq('location_id', locationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No inventory record
      return 0
    }
    throw new Error(`Failed to fetch inventory: ${error.message}`)
  }

  return data?.quantity || 0
}

/**
 * Check if product has sufficient inventory
 */
export async function checkInventoryAvailability(
  productId: string,
  locationId: string,
  quantity: number
): Promise<boolean> {
  const currentInventory = await getProductInventory(productId, locationId)
  return currentInventory >= quantity
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(
  locationId: string,
  threshold = 10
): Promise<ProductWithInventory[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      inventory!inner (
        quantity,
        location_id
      )
    `
    )
    .eq('inventory.location_id', locationId)
    .lte('inventory.quantity', threshold)
    .eq('is_active', true)
    .eq('track_inventory', true)
    .order('inventory.quantity')

  if (error) {
    throw new Error(`Failed to fetch low stock products: ${error.message}`)
  }

  return data || []
}

/**
 * Export service object
 */
export const productsService = {
  getProducts,
  getProductById,
  getProductByBarcode,
  getProductBySku,
  getProductsWithInventory,
  searchProducts,
  getProductsByCategory,
  getProductInventory,
  checkInventoryAvailability,
  getLowStockProducts,
}
