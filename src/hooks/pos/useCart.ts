import { useState, useCallback, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import type { CartItem, Product, PricingTier } from '@/types/pos'
import { logger } from '@/utils/logger'

export interface UseCartReturn {
  // State
  cart: CartItem[]
  discountingItemId: string | null

  // Actions
  addToCart: (product: Product, tier?: PricingTier) => void
  updateQuantity: (productId: string, delta: number) => void
  changeTier: (oldItemId: string, product: Product, newTier: PricingTier) => void
  applyManualDiscount: (itemId: string, discountAmount: number) => void
  removeManualDiscount: (itemId: string) => void
  clearCart: () => void
  setDiscountingItemId: (itemId: string | null) => void

  // Computed
  subtotal: number
  itemCount: number
}

export function useCart(): UseCartReturn {
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountingItemId, setDiscountingItemId] = useState<string | null>(null)

  /**
   * Add product to cart (with optional pricing tier)
   * STEVE JOBS PRINCIPLE: Never let them add more than we have in stock
   */
  const addToCart = useCallback((product: Product, tier?: PricingTier) => {
    const price = tier ? (typeof tier.price === 'number' ? tier.price : parseFloat(tier.price)) : (product.regular_price || 0)
    const tierLabel = tier ? (tier.weight || tier.label) : null
    const itemId = tier ? `${product.id}_${tier.weight || tier.label}` : product.id
    const availableInventory = product.inventory_quantity || 0

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === itemId)

      // STEVE JOBS: Check inventory before adding
      if (existing) {
        // Would this addition exceed inventory?
        if (existing.quantity + 1 > availableInventory) {
          logger.warn('Cannot add more to cart - inventory limit', {
            product: product.name,
            availableInventory,
            currentQuantity: existing.quantity
          })
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          return prevCart // Don't add, return cart unchanged
        }
        return prevCart.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
        )
      }

      // New item - check if we have at least 1 in stock
      if (availableInventory < 1) {
        logger.warn('Cannot add product - out of stock', { product: product.name })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        return prevCart // Don't add
      }

      return [
        ...prevCart,
        {
          id: itemId,
          name: tierLabel ? `${product.name} (${tierLabel})` : product.name,
          price,
          quantity: 1,
          tierLabel: tierLabel || undefined,
          productName: product.name,
          productId: product.id,
          inventoryId: product.inventory_id || product.id, // Use actual inventory record ID
          availableInventory, // Store for future validation
        },
      ]
    })
  }, [])

  /**
   * Update item quantity (delta can be +1 or -1)
   * STEVE JOBS PRINCIPLE: Respect inventory limits
   */
  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === productId) {
            const newQuantity = item.quantity + delta

            // STEVE JOBS: Check inventory when increasing quantity
            if (delta > 0 && item.availableInventory !== undefined) {
              if (newQuantity > item.availableInventory) {
                logger.warn('Cannot increase quantity - inventory limit', {
                  item: item.name,
                  availableInventory: item.availableInventory
                })
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                return item // Don't change quantity
              }
            }

            return { ...item, quantity: newQuantity }
          }
          return item
        })
        .filter((item) => item.quantity > 0)
    })
  }, [])

  /**
   * Change tier for a cart item (remove old, add new)
   */
  const changeTier = useCallback((oldItemId: string, product: Product, newTier: PricingTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const availableInventory = product.inventory_quantity || 0

    setCart((prevCart) => {
      // Remove the old tier item
      const filtered = prevCart.filter((item) => item.id !== oldItemId)

      // Add the new tier
      const price = typeof newTier.price === 'number' ? newTier.price : parseFloat(newTier.price)
      const tierLabel = newTier.weight || newTier.label
      const itemId = `${product.id}_${newTier.weight || newTier.label}`

      // Check if this tier already exists
      const existing = filtered.find((item) => item.id === itemId)
      if (existing) {
        return filtered.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
        )
      }

      return [
        ...filtered,
        {
          id: itemId,
          name: tierLabel ? `${product.name} (${tierLabel})` : product.name,
          price,
          quantity: 1,
          tierLabel: tierLabel || undefined,
          productName: product.name,
          productId: product.id,
          inventoryId: product.inventory_id || product.id, // Use actual inventory record ID
          availableInventory, // Store for validation
        },
      ]
    })
  }, [])

  /**
   * Apply staff discount to cart item
   */
  const applyManualDiscount = useCallback((productId: string, type: 'percentage' | 'amount', value: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === productId) {
          const originalPrice = item.originalPrice || item.price
          let adjustedPrice = originalPrice

          if (type === 'percentage') {
            adjustedPrice = originalPrice * (1 - value / 100)
          } else {
            adjustedPrice = Math.max(0, originalPrice - value)
          }

          return {
            ...item,
            manualDiscountType: type,
            manualDiscountValue: value,
            adjustedPrice,
            originalPrice,
          }
        }
        return item
      })
    )
    setDiscountingItemId(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [])

  /**
   * Remove staff discount from cart item
   */
  const removeManualDiscount = useCallback((productId: string) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === productId) {
          const { manualDiscountType: _manualDiscountType, manualDiscountValue: _manualDiscountValue, adjustedPrice: _adjustedPrice, originalPrice: _originalPrice, ...rest } = item
          return rest
        }
        return item
      })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  /**
   * Clear entire cart
   */
  const clearCart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setCart([])
    setDiscountingItemId(null)
  }, [])

  /**
   * Calculate cart subtotal (with staff discounts applied)
   */
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.adjustedPrice !== undefined ? item.adjustedPrice : item.price
      return sum + price * item.quantity
    }, 0)
  }, [cart])

  /**
   * Calculate total item count
   */
  const itemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  return {
    // State
    cart,
    discountingItemId,

    // Actions
    addToCart,
    updateQuantity,
    changeTier,
    applyManualDiscount,
    removeManualDiscount,
    clearCart,
    setDiscountingItemId,

    // Computed
    subtotal,
    itemCount,
  }
}
