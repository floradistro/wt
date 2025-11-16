import { useState, useCallback, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import type { CartItem, Product, PricingTier } from '@/types/pos'

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountingItemId, setDiscountingItemId] = useState<string | null>(null)

  /**
   * Add product to cart (with optional pricing tier)
   */
  const addToCart = useCallback((product: Product, tier?: PricingTier) => {
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
          inventoryId: product.inventory_id || product.id, // Use actual inventory record ID
        },
      ]
    })
  }, [])

  /**
   * Update item quantity (delta can be +1 or -1)
   */
  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    )
  }, [])

  /**
   * Change tier for a cart item (remove old, add new)
   */
  const changeTier = useCallback((oldItemId: string, product: Product, newTier: PricingTier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

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
