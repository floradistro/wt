/**
 * Product Transformation Utilities
 * Pure functions for transforming raw inventory data into Product types
 */

import type { Product, PricingTier, ProductField } from '@/types/pos'

/**
 * Transform raw inventory data from Supabase into Product format
 * Jobs Principle: Pure function, testable, single responsibility
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
 * Transform a single inventory item into a Product
 */
function transformSingleInventoryItem(inv: any): Product {
  const productData = inv.products

  // Extract pricing tiers
  const pricingData = productData.pricing_data || {}
  const pricingTiers: PricingTier[] = (pricingData.tiers || [])
    .filter((tier: any) => tier.enabled !== false && tier.price)
    .map((tier: any) => ({
      break_id: tier.id,
      label: tier.label,
      qty: tier.quantity || 1,
      price: parseFloat(tier.price),
      sort_order: tier.sort_order || 0,
    }))
    .sort((a: PricingTier, b: PricingTier) => (a.sort_order || 0) - (b.sort_order || 0))

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
    price: productData.regular_price || 0,
    image_url: productData.featured_image,
    category,
    description: productData.description || null,
    short_description: productData.short_description || null,
    inventory_quantity: inv.available_quantity,
    inventory_id: inv.id,
    pricing_tiers: pricingTiers,
    vendor,
    fields,
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
 */
export function getLowestPrice(product: Product): number {
  const tiers = product.pricing_tiers || []

  if (tiers.length === 0) {
    return product.price || 0
  }

  const prices = tiers.map((t) => parseFloat(String(t.price)))
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
