/**
 * Cart Store Tests
 * Critical tests for atomic inventory protection and cart operations
 */

import { act } from '@testing-library/react-native'
import { useCartStore } from '../cart.store'
import type { Product, PricingTier } from '@/types/pos'

describe('CartStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useCartStore.getState().reset()
  })

  describe('Atomic Inventory Protection', () => {
    it('prevents adding more items than available inventory', () => {
      const product: Product = {
        id: 'prod-1',
        name: 'Blue Dream',
        inventory_quantity: 2,
        regular_price: 10,
        inventory_id: 'inv-1',
      }

      // Add 1 - should succeed
      act(() => {
        useCartStore.getState().addToCart(product)
      })
      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().items[0].quantity).toBe(1)

      // Add 2 - should succeed (total 2)
      act(() => {
        useCartStore.getState().addToCart(product)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(2)

      // Add 3 - should be blocked (inventory is 2)
      act(() => {
        useCartStore.getState().addToCart(product)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(2) // Still 2, not 3
    })

    it('blocks adding out-of-stock products', () => {
      const product: Product = {
        id: 'prod-2',
        name: 'Out of Stock',
        inventory_quantity: 0,
        regular_price: 10,
        inventory_id: 'inv-2',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
      })

      expect(useCartStore.getState().items).toHaveLength(0) // Not added
    })

    it('allows multiple different products', () => {
      const product1: Product = {
        id: 'prod-3',
        name: 'Product 1',
        inventory_quantity: 5,
        regular_price: 10,
        inventory_id: 'inv-3',
      }

      const product2: Product = {
        id: 'prod-4',
        name: 'Product 2',
        inventory_quantity: 5,
        regular_price: 20,
        inventory_id: 'inv-4',
      }

      act(() => {
        useCartStore.getState().addToCart(product1)
        useCartStore.getState().addToCart(product2)
      })

      expect(useCartStore.getState().items).toHaveLength(2)
      expect(useCartStore.getState().items[0].productId).toBe('prod-3')
      expect(useCartStore.getState().items[1].productId).toBe('prod-4')
    })
  })

  describe('Quantity Updates', () => {
    it('respects inventory limits when increasing quantity', () => {
      const product: Product = {
        id: 'prod-5',
        name: 'Limited Stock',
        inventory_quantity: 3,
        regular_price: 10,
        inventory_id: 'inv-5',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
      })

      // Increase to 2
      act(() => {
        useCartStore.getState().updateQuantity('prod-5', 1)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(2)

      // Increase to 3 (max)
      act(() => {
        useCartStore.getState().updateQuantity('prod-5', 1)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(3)

      // Try to increase to 4 - should be blocked
      act(() => {
        useCartStore.getState().updateQuantity('prod-5', 1)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(3) // Still 3
    })

    it('removes item when quantity reaches 0', () => {
      const product: Product = {
        id: 'prod-6',
        name: 'Test Product',
        inventory_quantity: 5,
        regular_price: 10,
        inventory_id: 'inv-6',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
      })
      expect(useCartStore.getState().items).toHaveLength(1)

      // Decrease to 0
      act(() => {
        useCartStore.getState().updateQuantity('prod-6', -1)
      })
      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('handles decreasing quantity correctly', () => {
      const product: Product = {
        id: 'prod-7',
        name: 'Test Product',
        inventory_quantity: 10,
        regular_price: 10,
        inventory_id: 'inv-7',
      }

      // Add 3
      act(() => {
        useCartStore.getState().addToCart(product)
        useCartStore.getState().addToCart(product)
        useCartStore.getState().addToCart(product)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(3)

      // Decrease by 1
      act(() => {
        useCartStore.getState().updateQuantity('prod-7', -1)
      })
      expect(useCartStore.getState().items[0].quantity).toBe(2)
    })
  })

  describe('Pricing Tiers', () => {
    it('handles tiered products correctly', () => {
      const product: Product = {
        id: 'prod-8',
        name: 'Cannabis Flower',
        inventory_quantity: 10,
        regular_price: 10,
        inventory_id: 'inv-8',
      }

      const tier: PricingTier = {
        qty: 1,
        price: 35,
        weight: '3.5g',
        label: 'Eighth',
      }

      act(() => {
        useCartStore.getState().addToCart(product, tier)
      })

      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().items[0].price).toBe(35)
      expect(useCartStore.getState().items[0].tierLabel).toBe('3.5g')
      expect(useCartStore.getState().items[0].name).toContain('(3.5g)')
    })

    it('treats different tiers as separate cart items', () => {
      const product: Product = {
        id: 'prod-9',
        name: 'Cannabis Flower',
        inventory_quantity: 10,
        regular_price: 10,
        inventory_id: 'inv-9',
      }

      const tier1: PricingTier = {
        qty: 1,
        price: 35,
        weight: '3.5g',
      }

      const tier2: PricingTier = {
        qty: 1,
        price: 60,
        weight: '7g',
      }

      act(() => {
        useCartStore.getState().addToCart(product, tier1)
        useCartStore.getState().addToCart(product, tier2)
      })

      expect(useCartStore.getState().items).toHaveLength(2) // Two separate items
      expect(useCartStore.getState().items[0].id).toContain('3.5g')
      expect(useCartStore.getState().items[1].id).toContain('7g')
    })
  })

  describe('Manual Discounts', () => {
    it('applies percentage discount correctly', () => {
      const product: Product = {
        id: 'prod-10',
        name: 'Discountable',
        inventory_quantity: 10,
        regular_price: 100,
        inventory_id: 'inv-10',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
      })

      // Apply 10% discount
      act(() => {
        useCartStore.getState().applyManualDiscount('prod-10', 'percentage', 10)
      })

      const item = useCartStore.getState().items[0]
      expect(item.adjustedPrice).toBe(90) // 100 - 10%
      expect(item.manualDiscountType).toBe('percentage')
      expect(item.manualDiscountValue).toBe(10)
    })

    it('applies amount discount correctly', () => {
      const product: Product = {
        id: 'prod-11',
        name: 'Discountable',
        inventory_quantity: 10,
        regular_price: 100,
        inventory_id: 'inv-11',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
      })

      // Apply $15 discount
      act(() => {
        useCartStore.getState().applyManualDiscount('prod-11', 'amount', 15)
      })

      const item = useCartStore.getState().items[0]
      expect(item.adjustedPrice).toBe(85) // 100 - 15
    })

    it('removes discount correctly', () => {
      const product: Product = {
        id: 'prod-12',
        name: 'Discountable',
        inventory_quantity: 10,
        regular_price: 100,
        inventory_id: 'inv-12',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
        useCartStore.getState().applyManualDiscount('prod-12', 'percentage', 10)
      })

      // Remove discount
      act(() => {
        useCartStore.getState().removeManualDiscount('prod-12')
      })

      const item = useCartStore.getState().items[0]
      expect(item.adjustedPrice).toBeUndefined()
      expect(item.manualDiscountType).toBeUndefined()
    })
  })

  describe('Cart Operations', () => {
    it('clears cart correctly', () => {
      const product: Product = {
        id: 'prod-13',
        name: 'Test',
        inventory_quantity: 10,
        regular_price: 10,
        inventory_id: 'inv-13',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
        useCartStore.getState().addToCart(product)
      })
      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().items[0].quantity).toBe(2)

      act(() => {
        useCartStore.getState().clearCart()
      })
      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('resets store to initial state', () => {
      const product: Product = {
        id: 'prod-14',
        name: 'Test',
        inventory_quantity: 10,
        regular_price: 10,
        inventory_id: 'inv-14',
      }

      act(() => {
        useCartStore.getState().addToCart(product)
        useCartStore.getState().setDiscountingItemId('some-id')
      })

      act(() => {
        useCartStore.getState().reset()
      })

      expect(useCartStore.getState().items).toHaveLength(0)
      expect(useCartStore.getState().discountingItemId).toBeNull()
    })
  })
})
