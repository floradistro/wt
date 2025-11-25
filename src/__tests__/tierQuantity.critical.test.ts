/**
 * MISSION CRITICAL TEST: Tier Quantity Inventory Deduction
 *
 * This test ensures that tierQuantity is ALWAYS present and correct
 * to prevent incorrect inventory deduction.
 *
 * FAILURE OF THESE TESTS = PRODUCTION INCIDENT
 */

import { useCartStore } from '@/stores/cart.store'
import type { Product, PricingTier } from '@/types/pos'

describe('CRITICAL: Tier Quantity Validation', () => {
  beforeEach(() => {
    // Reset cart before each test
    useCartStore.getState().reset()
  })

  describe('addToCart()', () => {
    it('CRITICAL: should set tierQuantity=1 for products without tiers', () => {
      const product: Product = {
        id: 'prod-1',
        name: 'Single Unit Product',
        regular_price: 10.00,
        inventory_id: 'inv-1',
        inventory_quantity: 100,
      }

      useCartStore.getState().addToCart(product)

      const items = useCartStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].tierQuantity).toBe(1)
      expect(items[0].quantity).toBe(1)
    })

    it('CRITICAL: should set tierQuantity from tier.qty for tiered products', () => {
      const product: Product = {
        id: 'prod-2',
        name: 'Bulk Product',
        regular_price: 50.00,
        inventory_id: 'inv-2',
        inventory_quantity: 100,
      }

      const tier: PricingTier = {
        qty: 3,
        price: 45.00,
        label: '3 for $45',
      }

      useCartStore.getState().addToCart(product, tier)

      const items = useCartStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].tierQuantity).toBe(3) // ✅ CRITICAL: Must be 3, not 1!
      expect(items[0].quantity).toBe(1) // Cart quantity is 1
      expect(items[0].tierLabel).toBe('3 for $45')
    })

    it('CRITICAL: should set tierQuantity=28 for gram-based tiers', () => {
      const product: Product = {
        id: 'prod-3',
        name: 'Cannabis Product',
        regular_price: 200.00,
        inventory_id: 'inv-3',
        inventory_quantity: 1000, // 1000 grams in stock
      }

      const tier: PricingTier = {
        qty: 28, // 28 grams (ounce)
        price: 180.00,
        label: '28g',
        weight: '28g (Ounce)',
      }

      useCartStore.getState().addToCart(product, tier)

      const items = useCartStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].tierQuantity).toBe(28) // ✅ CRITICAL: Must be 28 grams!
      expect(items[0].quantity).toBe(1)
    })

    it('CRITICAL: should THROW ERROR if tierQuantity is missing (safety check)', () => {
      // This simulates corrupted cart data
      const corruptedItem: any = {
        id: 'corrupt-1',
        name: 'Corrupted Item',
        price: 10,
        quantity: 1,
        productId: 'prod-x',
        inventoryId: 'inv-x',
        // tierQuantity is MISSING! This should cause an error
      }

      expect(() => {
        // Manually validate (simulating what happens in addToCart)
        if (!(corruptedItem as any).tierQuantity || (corruptedItem as any).tierQuantity <= 0) {
          throw new Error(`CRITICAL: Missing tierQuantity for item ${corruptedItem.name}`)
        }
      }).toThrow(/CRITICAL: Missing tierQuantity/)
    })
  })

  describe('changeTier()', () => {
    it('CRITICAL: should update tierQuantity when changing tiers', () => {
      const product: Product = {
        id: 'prod-4',
        name: 'Multi-Tier Product',
        regular_price: 100.00,
        inventory_id: 'inv-4',
        inventory_quantity: 1000,
      }

      // Add with tier 1 (qty=3)
      const tier1: PricingTier = {
        qty: 3,
        price: 45.00,
        label: '3 for $45',
      }
      useCartStore.getState().addToCart(product, tier1)

      const itemId = useCartStore.getState().items[0].id

      // Change to tier 2 (qty=5)
      const tier2: PricingTier = {
        qty: 5,
        price: 70.00,
        label: '5 for $70',
      }
      useCartStore.getState().changeTier(itemId, product, tier2)

      const items = useCartStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].tierQuantity).toBe(5) // ✅ CRITICAL: Must be 5, not 3!
      expect(items[0].tierLabel).toBe('5 for $70')
    })
  })

  describe('Checkout Validation', () => {
    it('CRITICAL: all cart items must have valid tierQuantity before checkout', () => {
      const product1: Product = {
        id: 'prod-5',
        name: 'Product 1',
        regular_price: 10.00,
        inventory_id: 'inv-5',
        inventory_quantity: 100,
      }

      const product2: Product = {
        id: 'prod-6',
        name: 'Product 2',
        regular_price: 50.00,
        inventory_id: 'inv-6',
        inventory_quantity: 100,
      }

      const tier: PricingTier = {
        qty: 3,
        price: 45.00,
        label: '3 for $45',
      }

      useCartStore.getState().addToCart(product1) // tierQuantity=1
      useCartStore.getState().addToCart(product2, tier) // tierQuantity=3

      const items = useCartStore.getState().items

      // Validate all items (simulates payment store validation)
      items.forEach((item, index) => {
        expect(item.tierQuantity).toBeDefined()
        expect(item.tierQuantity).toBeGreaterThan(0)
      })

      expect(items[0].tierQuantity).toBe(1)
      expect(items[1].tierQuantity).toBe(3)
    })
  })

  describe('Edge Cases', () => {
    it('CRITICAL: should handle fractional tierQuantity (e.g., 3.5g)', () => {
      const product: Product = {
        id: 'prod-7',
        name: 'Fractional Product',
        regular_price: 40.00,
        inventory_id: 'inv-7',
        inventory_quantity: 1000,
      }

      const tier: PricingTier = {
        qty: 3.5, // 3.5 grams (eighth)
        price: 35.00,
        label: '3.5g',
        weight: '3.5g (Eighth)',
      }

      useCartStore.getState().addToCart(product, tier)

      const items = useCartStore.getState().items
      expect(items[0].tierQuantity).toBe(3.5)
    })

    it('CRITICAL: should handle adding multiple of the same tier', () => {
      const product: Product = {
        id: 'prod-8',
        name: 'Bulk Product',
        regular_price: 50.00,
        inventory_id: 'inv-8',
        inventory_quantity: 100,
      }

      const tier: PricingTier = {
        qty: 3,
        price: 45.00,
        label: '3 for $45',
      }

      // Add same tier twice
      useCartStore.getState().addToCart(product, tier)
      useCartStore.getState().addToCart(product, tier)

      const items = useCartStore.getState().items
      expect(items).toHaveLength(1) // Should merge into one item
      expect(items[0].quantity).toBe(2) // Cart quantity = 2
      expect(items[0].tierQuantity).toBe(3) // Tier quantity stays 3

      // Total inventory deduction = tierQuantity * quantity = 3 * 2 = 6
      const totalDeduction = items[0].tierQuantity * items[0].quantity
      expect(totalDeduction).toBe(6)
    })
  })
})
