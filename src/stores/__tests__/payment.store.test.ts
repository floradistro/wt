/**
 * Payment Store Tests
 * Critical tests for payment state machine and double-write protection
 */

import { usePaymentStore } from '../payment.store'
import type { PaymentStage } from '@/components/pos/payment/PaymentTypes'

describe('PaymentStore', () => {
  beforeEach(() => {
    // Reset store before each test
    usePaymentStore.getState().resetPayment()
  })

  describe('Double-Write Protection', () => {
    it('blocks duplicate payment calls when already processing', async () => {
      // Set to processing state
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('sending')
      usePaymentStore.getState().setStage('processing')

      // Try to call processPayment - should throw
      const mockParams: any = {
        paymentData: { paymentMethod: 'cash' },
        cart: [],
        subtotal: 100,
        taxAmount: 8,
        total: 108,
        itemCount: 1,
        sessionInfo: { sessionId: 'test', locationId: 'loc-1', registerId: 'reg-1' },
        vendor: { id: 'vendor-1', name: 'Test' },
        customUserId: 'user-1',
        selectedCustomer: null,
        loyaltyPointsToRedeem: 0,
        loyaltyDiscountAmount: 0,
        discountAmount: 0,
        selectedDiscountId: null,
        currentProcessor: null,
      }

      await expect(usePaymentStore.getState().processPayment(mockParams)).rejects.toThrow('Payment already in progress')
    })

    it('blocks payment when in initializing state', async () => {
      usePaymentStore.getState().setStage('initializing')

      const mockParams: any = {
        paymentData: { paymentMethod: 'cash' },
        cart: [],
        subtotal: 100,
        taxAmount: 8,
        total: 108,
        itemCount: 1,
        sessionInfo: { sessionId: 'test', locationId: 'loc-1', registerId: 'reg-1' },
        vendor: { id: 'vendor-1', name: 'Test' },
        customUserId: 'user-1',
        selectedCustomer: null,
        loyaltyPointsToRedeem: 0,
        loyaltyDiscountAmount: 0,
        discountAmount: 0,
        selectedDiscountId: null,
        currentProcessor: null,
      }

      await expect(usePaymentStore.getState().processPayment(mockParams)).rejects.toThrow('Payment already in progress')
    })

    it('allows payment when in null state', () => {
      // Null state should allow starting a payment
      expect(usePaymentStore.getState().stage).toBeNull()
      expect(() => usePaymentStore.getState().setStage('initializing')).not.toThrow()
    })
  })

  describe('State Management', () => {
    it('initializes with null state', () => {
      expect(usePaymentStore.getState().stage).toBeNull()
      expect(usePaymentStore.getState().error).toBeNull()
      expect(usePaymentStore.getState().completionData).toBeNull()
    })

    it('transitions through payment stages correctly', () => {
      usePaymentStore.getState().setStage('initializing')
      expect(usePaymentStore.getState().stage).toBe('initializing')

      usePaymentStore.getState().setStage('sending')
      expect(usePaymentStore.getState().stage).toBe('sending')

      usePaymentStore.getState().setStage('processing')
      expect(usePaymentStore.getState().stage).toBe('processing')

      usePaymentStore.getState().setStage('approving')
      expect(usePaymentStore.getState().stage).toBe('approving')

      usePaymentStore.getState().setStage('success')
      expect(usePaymentStore.getState().stage).toBe('success')

      usePaymentStore.getState().setStage('complete')
      expect(usePaymentStore.getState().stage).toBe('complete')
    })

    it('sets error state correctly', () => {
      usePaymentStore.getState().setError('Network timeout')

      expect(usePaymentStore.getState().stage).toBe('error')
      expect(usePaymentStore.getState().error).toBe('Network timeout')
    })

    it('resets payment state correctly', () => {
      // Set some state
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('sending')
      usePaymentStore.getState().setStage('processing')

      // Reset
      usePaymentStore.getState().resetPayment()

      expect(usePaymentStore.getState().stage).toBeNull()
      expect(usePaymentStore.getState().error).toBeNull()
      expect(usePaymentStore.getState().completionData).toBeNull()
    })
  })

  describe('State Machine Enforcement', () => {
    it('allows valid forward transitions', () => {
      // Valid flow
      expect(() => usePaymentStore.getState().setStage('initializing')).not.toThrow()
      expect(() => usePaymentStore.getState().setStage('sending')).not.toThrow()
      expect(() => usePaymentStore.getState().setStage('processing')).not.toThrow()
      expect(() => usePaymentStore.getState().setStage('approving')).not.toThrow()
      expect(() => usePaymentStore.getState().setStage('success')).not.toThrow()
      expect(() => usePaymentStore.getState().setStage('complete')).not.toThrow()
    })

    it('allows transitions to error from any state', () => {
      usePaymentStore.getState().setStage('initializing')
      expect(() => usePaymentStore.getState().setStage('error')).not.toThrow()

      usePaymentStore.getState().resetPayment()
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('sending')
      expect(() => usePaymentStore.getState().setStage('error')).not.toThrow()

      usePaymentStore.getState().resetPayment()
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('sending')
      usePaymentStore.getState().setStage('processing')
      expect(() => usePaymentStore.getState().setStage('error')).not.toThrow()
    })

    it('blocks invalid backward transitions', () => {
      // Get to success state
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('sending')
      usePaymentStore.getState().setStage('processing')
      usePaymentStore.getState().setStage('approving')
      usePaymentStore.getState().setStage('success')

      // Try to go backward - should throw
      expect(() => usePaymentStore.getState().setStage('initializing')).toThrow('Invalid payment state transition')
      expect(() => usePaymentStore.getState().setStage('processing')).toThrow('Invalid payment state transition')
    })

    it('blocks transitions from terminal states', () => {
      // Get to complete state
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('sending')
      usePaymentStore.getState().setStage('processing')
      usePaymentStore.getState().setStage('approving')
      usePaymentStore.getState().setStage('success')
      usePaymentStore.getState().setStage('complete')

      // Try to transition from complete - should throw
      expect(() => usePaymentStore.getState().setStage('initializing')).toThrow('Invalid payment state transition')
      expect(() => usePaymentStore.getState().setStage('processing')).toThrow('Invalid payment state transition')
      expect(() => usePaymentStore.getState().setStage('error')).toThrow('Invalid payment state transition')
    })

    it('blocks transitions from error state', () => {
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('error')

      // Error is a terminal state - can't transition to anything
      expect(() => usePaymentStore.getState().setStage('initializing')).toThrow('Invalid payment state transition')
      expect(() => usePaymentStore.getState().setStage('processing')).toThrow('Invalid payment state transition')
    })

    it('allows reset from any state', () => {
      // Complete state
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('sending')
      usePaymentStore.getState().setStage('processing')
      usePaymentStore.getState().setStage('approving')
      usePaymentStore.getState().setStage('success')
      usePaymentStore.getState().setStage('complete')

      // Reset should work
      expect(() => usePaymentStore.getState().resetPayment()).not.toThrow()
      expect(usePaymentStore.getState().stage).toBeNull()

      // Error state
      usePaymentStore.getState().setStage('initializing')
      usePaymentStore.getState().setStage('error')

      // Reset should work
      expect(() => usePaymentStore.getState().resetPayment()).not.toThrow()
      expect(usePaymentStore.getState().stage).toBeNull()
    })
  })
})
