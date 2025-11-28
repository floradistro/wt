/**
 * Product Transformation Utilities
 * Pure functions for transforming raw inventory data into Product types
 */

import type { Product, PricingTier, ProductField } from '@/types/pos'

/**
 * Transform raw products data from Supabase into Product format (ALL PRODUCTS)
 * Products-first query with nested inventory - shows full catalog
 * Jobs Principle: Pure function, testable, single responsibility
 */
export function transformProductsData(productsData: any[], locationId?: string): Product[] {
  if (!productsData || !Array.isArray(productsData)) {
    return []
  }

  return productsData
    .map((product) => transformSingleProduct(product, locationId))
    .sort((a, b) => a.name.localeCompare(b.name)) // Alphabetical sort
}

/**
 * Transform raw inventory data from Supabase into Product format (IN-STOCK ONLY)
 * Inventory-first query with nested products - legacy approach
 * Jobs Principle: Pure function, testable, single responsibility
 * @deprecated Use transformProductsData for full catalog view
 */
export function transformInventoryToProducts(inventoryData: any[]): Product[] {
  if (!inventoryData || !Array.isArray(inventoryData)) {
    return []
  }

  return inventoryData
    .filter((inv) => inv?.products) // Only include items with product data
    .map((inv) => transformSingleInventoryItem(inv))
    .sort((a, b) => a.name.localeCompare(b.name)) // Alphabetical sort
}

/**
 * Transform a single product (with nested inventory) into a Product
 * Handles products-first query structure
 */
function transformSingleProduct(productData: any, locationId?: string): Product {
  // Extract category
  const category = extractCategory(productData)

  // Extract vendor info
  const vendor = productData.vendors
    ? {
        id: productData.vendors.id,
        store_name: productData.vendors.store_name,
        logo_url: productData.vendors.logo_url,
      }
    : null

  // Parse custom fields from JSONB object
  const customFields = productData.custom_fields || {}
  const fields: ProductField[] = Object.entries(customFields).map(([key, value]) => ({
    label: key,
    value: String(value || ''),
    type: typeof value === 'number' ? 'number' : 'text',
  }))

  // Get inventory data (array from nested inventory relation)
  // Filter by location if specified
  const allInventory = productData.inventory || []
  const inventoryArray = locationId
    ? allInventory.filter((inv: any) => inv.location_id === locationId)
    : allInventory

  const firstInventory = inventoryArray[0] // Get first inventory record if exists

  // Calculate total stock for this location only
  const totalStock = inventoryArray.reduce((sum: number, inv: any) =>
    sum + (inv?.total_quantity || 0), 0)

  const availableQuantity = inventoryArray.reduce((sum: number, inv: any) =>
    sum + (inv?.available_quantity || 0), 0)

  // Transform inventory array to proper format
  const inventory = inventoryArray.map((inv: any) => ({
    id: inv.id,
    location_id: inv.location_id,
    location_name: inv.locations?.name || 'Unknown',
    quantity: inv.total_quantity || 0,
    available_quantity: inv.available_quantity || 0,
    reserved_quantity: inv.held_quantity || 0,
  }))

  return {
    id: productData.id,
    name: productData.name,
    sku: productData.sku,
    price: productData.regular_price || 0,
    regular_price: productData.regular_price || 0,
    cost_price: productData.cost_price || 0,
    sale_price: productData.sale_price || null,
    on_sale: productData.on_sale || false,
    stock_quantity: totalStock,
    total_stock: totalStock,
    image_url: productData.featured_image,
    featured_image: productData.featured_image,
    vendor_logo_url: vendor?.logo_url || null,
    category,
    primary_category_id: productData.primary_category_id,
    description: productData.description || null,
    short_description: productData.short_description || null,
    custom_fields: productData.custom_fields || {},
    pricing_data: productData.pricing_data || {},
    inventory_quantity: availableQuantity,
    inventory_id: firstInventory?.id || null,
    vendor,
    fields,

    // LIVE PRICING TEMPLATE - SINGLE SOURCE OF TRUTH
    pricing_template_id: productData.pricing_template_id || null,
    pricing_template: productData.pricing_template || null,

    // Multi-location inventory support
    inventory,
  }
}

/**
 * Transform a single inventory item into a Product
 * @deprecated Use transformSingleProduct for products-first structure
 */
function transformSingleInventoryItem(inv: any): Product {
  const productData = inv.products

  // LIVE PRICING TEMPLATE - Pass through, don't copy
  const pricingData = productData.pricing_data || {}

  // Extract category
  const category = extractCategory(productData)

  // Extract vendor info
  const vendor = productData.vendors
    ? {
        id: productData.vendors.id,
        store_name: productData.vendors.store_name,
        logo_url: productData.vendors.logo_url,
      }
    : null

  // Parse custom fields from JSONB object
  const customFields = productData.custom_fields || {}
  const fields: ProductField[] = Object.entries(customFields).map(([key, value]) => ({
    label: key,
    value: String(value || ''),
    type: typeof value === 'number' ? 'number' : 'text',
  }))

  return {
    id: productData.id,
    name: productData.name,
    sku: productData.sku,
    price: productData.regular_price || 0,
    regular_price: productData.regular_price || 0,
    cost_price: productData.cost_price || 0,
    sale_price: productData.sale_price || null,
    on_sale: productData.on_sale || false,
    stock_quantity: productData.stock_quantity ?? inv.total_quantity,
    total_stock: productData.stock_quantity ?? inv.total_quantity,
    image_url: productData.featured_image,
    featured_image: productData.featured_image,
    vendor_logo_url: vendor?.logo_url || null,
    category,
    primary_category_id: productData.primary_category_id,
    description: productData.description || null,
    short_description: productData.short_description || null,
    custom_fields: productData.custom_fields || {},
    pricing_data: pricingData,
    inventory_quantity: inv.available_quantity,
    inventory_id: inv.id,
    vendor,
    fields,

    // LIVE PRICING TEMPLATE - SINGLE SOURCE OF TRUTH
    pricing_template_id: productData.pricing_template_id || null,
    pricing_template: productData.pricing_template || null,

    // Add inventory array for consistency (single location)
    inventory: inv.locations ? [{
      id: inv.id,
      location_id: inv.location_id,
      location_name: inv.locations.name || 'Unknown',
      quantity: inv.total_quantity || inv.quantity,
      available_quantity: inv.available_quantity,
      reserved_quantity: inv.held_quantity || 0,
    }] : [],
  }
}

/**
 * Extract category from product data
 * Tries primary_category first, falls back to product_categories
 */
function extractCategory(productData: any): string | null {
  // Try primary_category first
  if (productData.primary_category?.name) {
    return productData.primary_category.name
  }

  // Fall back to product_categories
  const productCategories = productData.product_categories || []
  if (productCategories.length > 0 && productCategories[0].categories) {
    return productCategories[0].categories.name
  }

  return null
}

/**
 * Extract unique categories from products
 */
export function extractCategories(products: Product[]): string[] {
  const categories = new Set<string>()

  products.forEach((product) => {
    if (product.category) {
      categories.add(product.category)
    }
  })

  return ['All', ...Array.from(categories).sort()]
}

/**
 * Extract unique field values from products
 * Used for filter options (strain types, consistencies, flavors, etc.)
 */
export function extractFieldValues(products: Product[], fieldLabel: string, categoryFilter?: string): string[] {
  const values = new Set<string>()

  products
    .filter((p) => !categoryFilter || p.category === categoryFilter)
    .forEach((product) => {
      const field = product.fields?.find((f) => f.label === fieldLabel)
      if (field?.value) {
        values.add(field.value)
      }
    })

  return Array.from(values).sort()
}

/**
 * Get the lowest price from a product (for "From $X.XX" display)
 * SINGLE SOURCE: Reads from pricing_template.default_tiers
 */
export function getLowestPrice(product: Product): number {
  const tiers = product.pricing_template?.default_tiers || []

  if (tiers.length === 0) {
    return product.price || 0
  }

  const prices = tiers.map((t) => parseFloat(String(t.default_price)))
  return Math.min(...prices)
}

/**
 * Find suggested tier index (e.g., for cannabis, 3.5g is most common)
 */
export function findSuggestedTierIndex(tiers: PricingTier[]): number {
  return tiers.findIndex((t) => {
    const weight = (t.weight || t.label || '').toLowerCase()
    return weight.includes('3.5') || weight.includes('eighth')
  })
}

/**
 * Check if product is in stock
 */
export function isProductInStock(product: Product): boolean {
  return (product.inventory_quantity || 0) > 0
}

/**
 * Filter products by search query
 */
export function filterBySearch(products: Product[], query: string): Product[] {
  if (!query.trim()) return products

  const lowerQuery = query.toLowerCase()
  return products.filter((p) => p.name.toLowerCase().includes(lowerQuery))
}

/**
 * Filter products by category
 */
export function filterByCategory(products: Product[], category: string): Product[] {
  if (category === 'All') return products
  return products.filter((p) => p.category === category)
}

/**
 * Filter products by field values (strain types, consistencies, etc.)
 */
export function filterByFieldValues(
  products: Product[],
  fieldLabel: string,
  values: string[]
): Product[] {
  if (values.length === 0) return products

  return products.filter((p) => {
    const fieldValue = p.fields?.find((f) => f.label === fieldLabel)?.value
    return fieldValue && values.includes(fieldValue)
  })
}

/**
 * Apply all filters to products
 * Jobs Principle: One function to rule them all
 */
export interface ProductFilters {
  searchQuery: string
  category: string
  strainTypes: string[]
  consistencies: string[]
  flavors: string[]
}

export function applyFilters(products: Product[], filters: ProductFilters): Product[] {
  let filtered = products

  // Search filter
  filtered = filterBySearch(filtered, filters.searchQuery)

  // Category filter
  filtered = filterByCategory(filtered, filters.category)

  // Strain type filter
  filtered = filterByFieldValues(filtered, 'strain_type', filters.strainTypes)

  // Consistency filter
  filtered = filterByFieldValues(filtered, 'consistency', filters.consistencies)

  // Flavor filter
  filtered = filterByFieldValues(filtered, 'flavor', filters.flavors)

  return filtered
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: ProductFilters): number {
  return [
    filters.category !== 'All',
    filters.strainTypes.length > 0,
    filters.consistencies.length > 0,
    filters.flavors.length > 0,
  ].filter(Boolean).length
}

/**
 * Get matching filters for a product (for UI highlighting)
 */
export function getMatchingFilters(product: Product, filters: ProductFilters): string[] {
  const matching: string[] = []

  // Category match
  if (filters.category !== 'All' && product.category === filters.category) {
    matching.push(filters.category)
  }

  // Strain type match
  const strainType = product.fields?.find((f) => f.label === 'strain_type')?.value
  if (strainType && filters.strainTypes.includes(strainType)) {
    matching.push(strainType)
  }

  // Consistency match
  const consistency = product.fields?.find((f) => f.label === 'consistency')?.value
  if (consistency && filters.consistencies.includes(consistency)) {
    matching.push(consistency)
  }

  // Flavor match
  const flavor = product.fields?.find((f) => f.label === 'flavor')?.value
  if (flavor && filters.flavors.includes(flavor)) {
    matching.push(flavor)
  }

  return matching
}
