import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import type { CartItem, Product, PricingTier } from '@/types/pos'

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountingItemId, setDiscountingItemId] = useState<string | null>(null)

  /**
   * Add product to cart (with optional pricing tier)
   */
  const addToCart = (product: Product, tier?: PricingTier) => {
    const price = tier ? (typeof tier.price === 'number' ? tier.price : parseFloat(tier.price)) : (product.regular_price || 0)
    const tierLabel = tier ? (tier.weight || tier.label) : null
    const itemId = tier ? `${product.id}_${tier.weight || tier.label}` : product.id

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === itemId)
      if (existing) {
        return prevCart.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
        )
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
          inventoryId: product.id, // TODO: Use actual inventory_id once Product type is updated
        },
      ]
    })
  }

  /**
   * Update item quantity (delta can be +1 or -1)
   */
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    )
  }

  /**
   * Apply staff discount to cart item
   */
  const applyManualDiscount = (productId: string, type: 'percentage' | 'amount', value: number) => {
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
  }

  /**
   * Remove staff discount from cart item
   */
  const removeManualDiscount = (productId: string) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === productId) {
          const { manualDiscountType, manualDiscountValue, adjustedPrice, originalPrice, ...rest } = item
          return rest
        }
        return item
      })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  /**
   * Clear entire cart
   */
  const clearCart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setCart([])
    setDiscountingItemId(null)
  }

  /**
   * Calculate cart subtotal (with staff discounts applied)
   */
  const subtotal = cart.reduce((sum, item) => {
    const price = item.adjustedPrice !== undefined ? item.adjustedPrice : item.price
    return sum + price * item.quantity
  }, 0)

  /**
   * Calculate total item count
   */
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return {
    // State
    cart,
    discountingItemId,

    // Actions
    addToCart,
    updateQuantity,
    applyManualDiscount,
    removeManualDiscount,
    clearCart,
    setDiscountingItemId,

    // Computed
    subtotal,
    itemCount,
  }
}
