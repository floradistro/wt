/**
 * Payment Validation Tests
 * Critical tests for payment validation utilities
 */

import {
  validateRealPaymentData,
  validatePaymentMethod,
  normalizePaymentMethod,
  validateProcessor,
  validatePaymentResponse,
} from '../payment-validation'
import type { PaymentData } from '@/components/pos/payment'

describe('Payment Validation', () => {
  describe('validateRealPaymentData', () => {
    it('allows cash payments without additional validation', () => {
      const cashPayment: PaymentData = {
        paymentMethod: 'cash',
        cashTendered: 100,
        changeGiven: 0,
      }
      expect(() => validateRealPaymentData(cashPayment)).not.toThrow()
    })

    it('allows card payments with valid transaction IDs', () => {
      const cardPayment: PaymentData = {
        paymentMethod: 'card',
        transactionId: 'abc123xyz789',
        authorizationCode: 'DEJ456',
      }
      expect(() => validateRealPaymentData(cardPayment)).not.toThrow()
    })

    it('rejects mocked transaction IDs (TXN pattern)', () => {
      const mockedPayment: PaymentData = {
        paymentMethod: 'card',
        transactionId: 'TXN1234567890',
      }
      expect(() => validateRealPaymentData(mockedPayment)).toThrow('INVALID PAYMENT DATA')
      expect(() => validateRealPaymentData(mockedPayment)).toThrow('appears to be mocked')
    })

    it('rejects mocked authorization codes (AUTH pattern)', () => {
      const mockedPayment: PaymentData = {
        paymentMethod: 'card',
        authorizationCode: 'AUTH1234567890',
      }
      expect(() => validateRealPaymentData(mockedPayment)).toThrow('INVALID PAYMENT DATA')
      expect(() => validateRealPaymentData(mockedPayment)).toThrow('appears to be mocked')
    })

    it('allows split payments', () => {
      const splitPayment: PaymentData = {
        paymentMethod: 'split',
        splitPayments: [
          { method: 'cash', amount: 50 },
          { method: 'card', amount: 50 },
        ],
      }
      expect(() => validateRealPaymentData(splitPayment)).not.toThrow()
    })
  })

  describe('validatePaymentMethod', () => {
    it('accepts valid payment methods', () => {
      const validMethods = ['credit', 'debit', 'ebt_food', 'ebt_cash', 'gift', 'cash', 'check', 'split', 'multi-card']
      
      validMethods.forEach(method => {
        expect(() => validatePaymentMethod(method)).not.toThrow()
      })
    })

    it('accepts case-insensitive payment methods', () => {
      expect(() => validatePaymentMethod('CASH')).not.toThrow()
      expect(() => validatePaymentMethod('Credit')).not.toThrow()
      expect(() => validatePaymentMethod('SPLIT')).not.toThrow()
    })

    it('rejects invalid payment methods', () => {
      expect(() => validatePaymentMethod('bitcoin')).toThrow('INVALID PAYMENT METHOD')
      expect(() => validatePaymentMethod('venmo')).toThrow('INVALID PAYMENT METHOD')
      expect(() => validatePaymentMethod('')).toThrow('INVALID PAYMENT METHOD')
    })
  })

  describe('normalizePaymentMethod', () => {
    it('converts card to credit', () => {
      expect(normalizePaymentMethod('card')).toBe('credit')
      expect(normalizePaymentMethod('Card')).toBe('credit')
      expect(normalizePaymentMethod('CARD')).toBe('credit')
    })

    it('preserves split for Edge Function detection', () => {
      expect(normalizePaymentMethod('split')).toBe('split')
      expect(normalizePaymentMethod('SPLIT')).toBe('split')
    })

    it('preserves multi-card for Edge Function detection', () => {
      expect(normalizePaymentMethod('multi-card')).toBe('multi-card')
      expect(normalizePaymentMethod('MULTI-CARD')).toBe('multi-card')
    })

    it('lowercases other methods', () => {
      expect(normalizePaymentMethod('CASH')).toBe('cash')
      expect(normalizePaymentMethod('Credit')).toBe('credit')
      expect(normalizePaymentMethod('EBT_FOOD')).toBe('ebt_food')
    })
  })

  describe('validateProcessor', () => {
    it('rejects null processor', () => {
      expect(() => validateProcessor(null)).toThrow('INVALID PROCESSOR')
    })

    it('rejects undefined processor', () => {
      expect(() => validateProcessor(undefined)).toThrow('INVALID PROCESSOR')
    })

    it('rejects processor without processor_id', () => {
      expect(() => validateProcessor({ name: 'Dejavoo' })).toThrow('missing processor_id')
    })

    it('rejects offline processor', () => {
      expect(() => validateProcessor({
        processor_id: 'dej-123',
        processor_name: 'Dejavoo',
        is_live: false,
      })).toThrow('PROCESSOR OFFLINE')
    })

    it('accepts valid online processor', () => {
      expect(() => validateProcessor({
        processor_id: 'dej-123',
        processor_name: 'Dejavoo',
        is_live: true,
      })).not.toThrow()
    })
  })

  describe('validatePaymentResponse', () => {
    it('rejects null response', () => {
      expect(() => validatePaymentResponse(null)).toThrow('INVALID RESPONSE')
    })

    it('rejects response with success=false', () => {
      expect(() => validatePaymentResponse({
        success: false,
        error: 'Declined',
      })).toThrow('Declined')
    })

    it('rejects response without success field', () => {
      expect(() => validatePaymentResponse({
        transactionId: 'abc123',
      })).toThrow('missing success field')
    })

    it('rejects response without transaction ID', () => {
      expect(() => validatePaymentResponse({
        success: true,
        authorizationCode: 'AUTH123',
      })).toThrow('missing transaction ID')
    })

    it('rejects response without authorization code', () => {
      expect(() => validatePaymentResponse({
        success: true,
        transactionId: 'TXN123',
      })).toThrow('missing authorization code')
    })

    it('accepts valid response with camelCase fields', () => {
      expect(() => validatePaymentResponse({
        success: true,
        transactionId: 'abc123',
        authorizationCode: 'DEJ456',
      })).not.toThrow()
    })

    it('accepts valid response with snake_case fields', () => {
      expect(() => validatePaymentResponse({
        success: true,
        transaction_id: 'abc123',
        authorization_code: 'DEJ456',
      })).not.toThrow()
    })
  })
})
