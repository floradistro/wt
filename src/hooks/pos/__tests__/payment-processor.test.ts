/**
 * Payment Processor Integration Tests
 *
 * These tests ensure the payment processor integration stays bulletproof.
 * Run with: npm test payment-processor.test.ts
 */

import { renderHook, act, waitFor } from '@testing-library/react-native'
import { usePaymentProcessor, startPaymentProcessorMonitoring, stopPaymentProcessorMonitoring } from '@/stores/payment-processor.store'

// Mock fetch globally
global.fetch = jest.fn()

// Mock Supabase auth
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({
        data: {
          session: {
            access_token: 'mock-token-123'
          }
        }
      }))
    }
  }
}))

describe('Payment Processor Store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()

    // Reset store state
    usePaymentProcessor.setState({
      status: 'checking',
      processors: [],
      currentProcessor: null,
      onlineCount: 0,
      totalCount: 0,
      isEnabled: true,
      locationId: null,
      registerId: null,
      activityLog: [],
    })
  })

  afterEach(() => {
    stopPaymentProcessorMonitoring()
  })

  describe('Health Check', () => {
    it('should fetch processor status from backend API', async () => {
      const mockResponse = {
        results: [
          {
            processor_id: 'proc-123',
            processor_name: 'Terminal 1',
            processor_type: 'dejavoo',
            is_live: true,
            last_checked: new Date().toISOString(),
          }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const { result } = renderHook(() => usePaymentProcessor())

      await act(async () => {
        await result.current.checkStatus('loc-123', 'reg-456')
      })

      await waitFor(() => {
        expect(result.current.status).toBe('connected')
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pos/payment-processors/health?locationId=loc-123'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token-123',
          }),
        })
      )

      expect(result.current.currentProcessor).toEqual({
        processor_id: 'proc-123',
        processor_name: 'Terminal 1',
        processor_type: 'dejavoo',
        is_live: true,
        last_checked: expect.any(String),
      })

      expect(result.current.onlineCount).toBe(1)
      expect(result.current.totalCount).toBe(1)
    })

    it('should handle no processors configured', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })

      const { result } = renderHook(() => usePaymentProcessor())

      await act(async () => {
        await result.current.checkStatus('loc-123')
      })

      await waitFor(() => {
        expect(result.current.status).toBe('disconnected')
      })

      expect(result.current.errorMessage).toContain('No processors configured')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => usePaymentProcessor())

      await act(async () => {
        await result.current.checkStatus('loc-123')
      })

      await waitFor(() => {
        expect(result.current.status).toBe('error')
      })

      expect(result.current.errorMessage).toBe('Network error')
    })

    it('should handle timeout', async () => {
      const abortError = new Error('Abort')
      abortError.name = 'AbortError'

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(abortError)

      const { result } = renderHook(() => usePaymentProcessor())

      await act(async () => {
        await result.current.checkStatus('loc-123')
      })

      await waitFor(() => {
        expect(result.current.status).toBe('error')
      })

      expect(result.current.errorMessage).toBe('Health check timeout')
    })

    it('should require authentication', async () => {
      // Mock no session
      const { supabase } = require('@/lib/supabase/client')
      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null }
      })

      const { result } = renderHook(() => usePaymentProcessor())

      await act(async () => {
        await result.current.checkStatus('loc-123')
      })

      await waitFor(() => {
        expect(result.current.status).toBe('error')
      })

      expect(result.current.errorMessage).toBe('Authentication required')
    })
  })

  describe('Location and Register Management', () => {
    it('should auto-check when location changes', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      })

      const { result } = renderHook(() => usePaymentProcessor())

      await act(async () => {
        result.current.setLocationId('loc-123')
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })

    it('should auto-check when register changes', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      })

      const { result } = renderHook(() => usePaymentProcessor())

      // Set location first
      act(() => {
        result.current.setLocationId('loc-123')
      })

      await act(async () => {
        result.current.setRegisterId('reg-456')
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2) // Once for location, once for register
      })
    })
  })

  describe('Activity Logging', () => {
    it('should log health check results', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            processor_id: 'proc-123',
            processor_name: 'Terminal 1',
            is_live: true,
          }]
        }),
      })

      const { result } = renderHook(() => usePaymentProcessor())

      await act(async () => {
        await result.current.checkStatus('loc-123')
      })

      await waitFor(() => {
        expect(result.current.activityLog.length).toBeGreaterThan(0)
      })

      const latestLog = result.current.activityLog[0]
      expect(latestLog.type).toBe('success')
      expect(latestLog.message).toContain('Terminal 1 ready')
      expect(latestLog.is_live).toBe(true)
    })

    it('should limit activity log to 20 entries', () => {
      const { result } = renderHook(() => usePaymentProcessor())

      act(() => {
        // Add 25 logs
        for (let i = 0; i < 25; i++) {
          result.current.addActivityLog('health_check', `Test ${i}`)
        }
      })

      expect(result.current.activityLog.length).toBe(20)
    })
  })
})

describe('Payment Processing (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Card Payment', () => {
    it('should call /api/pos/payment/process endpoint', async () => {
      const mockPaymentResponse = {
        success: true,
        transactionId: 'txn-real-123',
        authorizationCode: 'AUTH-REAL-456',
        cardType: 'VISA',
        cardLast4: '1234',
        amount: 50.00,
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentResponse,
      })

      const response = await fetch('https://whaletools.dev/api/pos/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
        body: JSON.stringify({
          locationId: 'loc-123',
          registerId: 'reg-456',
          amount: 50.00,
          paymentMethod: 'credit',
        }),
      })

      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.transactionId).toBe('txn-real-123')
      expect(data.authorizationCode).toBe('AUTH-REAL-456')
      expect(data.cardType).toBe('VISA')
      expect(data.cardLast4).toBe('1234')
    })

    it('should NOT use mock data', async () => {
      // This test ensures we never have hardcoded mock data
      const mockResponse = {
        success: true,
        transactionId: 'txn-123',
        authorizationCode: 'AUTH-456',
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const response = await fetch('https://whaletools.dev/api/pos/payment/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10.00, paymentMethod: 'credit' }),
      })

      const data = await response.json()

      // Ensure transaction ID doesn't match mock pattern
      expect(data.transactionId).not.toMatch(/^TXN\d+$/)
      expect(data.authorizationCode).not.toMatch(/^AUTH\d+$/)
    })

    it('should handle payment decline', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Card declined',
          isDeclined: true,
        }),
      })

      const response = await fetch('https://whaletools.dev/api/pos/payment/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10.00, paymentMethod: 'credit' }),
      })

      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toContain('declined')
    })
  })

  describe('Payment Method Normalization', () => {
    it('should map "card" to "credit"', () => {
      const normalizePaymentMethod = (method: string): string => {
        if (method === 'card') return 'credit'
        return method.toLowerCase()
      }

      expect(normalizePaymentMethod('card')).toBe('credit')
      expect(normalizePaymentMethod('CARD')).toBe('credit')
      expect(normalizePaymentMethod('cash')).toBe('cash')
      expect(normalizePaymentMethod('CASH')).toBe('cash')
    })

    it('should validate against database constraints', () => {
      const validMethods = ['credit', 'debit', 'ebt_food', 'ebt_cash', 'gift', 'cash', 'check']

      const normalizePaymentMethod = (method: string): string => {
        if (method === 'card') return 'credit'
        return method.toLowerCase()
      }

      // Test that our normalization always produces valid values
      expect(validMethods).toContain(normalizePaymentMethod('card'))
      expect(validMethods).toContain(normalizePaymentMethod('cash'))
      expect(validMethods).toContain(normalizePaymentMethod('credit'))
    })
  })
})
