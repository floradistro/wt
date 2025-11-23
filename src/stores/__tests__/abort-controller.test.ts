/**
 * AbortController Integration Tests
 * Tests that AbortController works correctly in stores
 */

import { useProductsStore } from '../products.store'
import { useCustomersListStore } from '../customers-list.store'
import { useOrdersStore } from '../orders.store'

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gt: jest.fn(() => ({
            abortSignal: jest.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
    })),
    removeChannel: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
  },
}))

// Mock services
jest.mock('@/services/customers.service', () => ({
  customersService: {
    getCustomers: jest.fn(() => Promise.resolve([])),
    searchCustomers: jest.fn(() => Promise.resolve([])),
  },
}))

jest.mock('@/services/orders.service', () => ({
  ordersService: {
    getOrders: jest.fn(() => Promise.resolve([])),
  },
}))

describe('AbortController Integration', () => {
  describe('ProductsStore', () => {
    beforeEach(() => {
      useProductsStore.getState().reset()
    })

    it('has AbortController state', () => {
      const store = useProductsStore.getState()
      expect(store.currentController).toBeNull()
      expect(typeof store.cancelLoadProducts).toBe('function')
    })

    it('creates AbortController when loading', async () => {
      const store = useProductsStore.getState()

      // Start loading (don't await - we want to check mid-flight)
      const loadPromise = store.loadProducts('location-1')

      // Controller should be set during loading
      expect(store.currentController).not.toBeNull()

      // Wait for load to complete
      await loadPromise

      // Controller should be cleared after completion
      expect(store.currentController).toBeNull()
    })
  })

  describe('CustomersListStore', () => {
    beforeEach(() => {
      useCustomersListStore.getState().reset()
    })

    it('has AbortController state', () => {
      const store = useCustomersListStore.getState()
      expect(store.currentController).toBeNull()
      expect(typeof store.cancelLoadCustomers).toBe('function')
    })

    it('cancels previous load when starting new one', async () => {
      const store = useCustomersListStore.getState()

      // Start first load
      const load1 = store.loadCustomers('vendor-1')
      const controller1 = store.currentController
      expect(controller1).not.toBeNull()

      // Start second load (should cancel first)
      const load2 = store.loadCustomers('vendor-1')
      const controller2 = store.currentController

      // Second controller should be different
      expect(controller2).not.toBe(controller1)

      await Promise.all([load1, load2])
    })
  })

  describe('OrdersStore', () => {
    beforeEach(() => {
      useOrdersStore.getState().reset()
    })

    it('has AbortController state', () => {
      const store = useOrdersStore.getState()
      expect(store.currentController).toBeNull()
      expect(typeof store.cancelLoadOrders).toBe('function')
    })

    it('clears controller on reset', async () => {
      const store = useOrdersStore.getState()

      // Start loading
      const loadPromise = store.loadOrders()
      expect(store.currentController).not.toBeNull()

      // Reset should cancel
      store.reset()
      expect(store.currentController).toBeNull()

      await loadPromise
    })
  })
})
