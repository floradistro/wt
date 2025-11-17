/**
 * Shared Hook Types
 * Prevents circular dependencies between components and hooks
 */

import type { Product } from './pos'

/**
 * Cart Hook Return Type
 * Used by useCart hook and consumed by components
 */
export interface UseCartReturn {
  items: CartItem[]
  itemCount: number
  subtotal: number
  addToCart: (product: Product, quantity?: number, priceOverride?: number) => void
  removeFromCart: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  updatePrice: (itemId: string, price: number) => void
  clearCart: () => void
  getItem: (itemId: string) => CartItem | undefined
}

/**
 * Cart Item
 * Individual item in the shopping cart
 */
export interface CartItem {
  id: string
  product: Product
  quantity: number
  priceOverride?: number
  subtotal: number
}
