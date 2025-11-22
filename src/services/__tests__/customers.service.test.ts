/**
 * Unit Tests for Customers Service
 * Tests customer deletion with atomic operations
 */

import {
  deleteCustomer,
  getCustomers,
  searchCustomers,
  getCustomerById,
  createCustomer,
} from '../customers.service'

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    startSpan: jest.fn(() => ({ finish: jest.fn() })),
  },
}))

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
}

jest.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase,
}))

describe('Customers Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deleteCustomer', () => {
    const customerId = 'customer-123'
    const vendorId = 'vendor-123'

    it('should delete customer successfully using atomic function', async () => {
      const mockResult = [
        {
          customer_id: customerId,
          was_active: true,
          success: true,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null })

      await deleteCustomer(customerId, vendorId)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_customer_safe', {
        p_customer_id: customerId,
        p_vendor_id: vendorId,
      })
    })

    it('should fetch vendor ID if not provided', async () => {
      const mockUser = { id: 'user-123' }
      const mockUserData = { vendor_id: vendorId }
      const mockResult = [{ customer_id: customerId, was_active: true, success: true }]

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null }),
          }),
        }),
      })

      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null })

      await deleteCustomer(customerId)

      expect(mockSupabase.from).toHaveBeenCalledWith('users')
      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_customer_safe', {
        p_customer_id: customerId,
        p_vendor_id: vendorId,
      })
    })

    it('should throw error if vendor ID cannot be determined', async () => {
      const mockUser = { id: 'user-123' }

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })

      await expect(deleteCustomer(customerId)).rejects.toThrow(
        'Failed to determine vendor ID for customer deletion'
      )
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'PGRST500' },
      })

      await expect(deleteCustomer(customerId, vendorId)).rejects.toThrow(
        'Failed to delete customer: Database error'
      )
    })

    it('should throw error if operation did not complete', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ customer_id: customerId, was_active: true, success: false }],
        error: null,
      })

      await expect(deleteCustomer(customerId, vendorId)).rejects.toThrow(
        'Failed to delete customer: operation did not complete'
      )
    })

    it('should throw error if no data returned', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })

      await expect(deleteCustomer(customerId, vendorId)).rejects.toThrow(
        'Failed to delete customer: operation did not complete'
      )
    })

    it('should be idempotent - handle already deleted customers', async () => {
      const mockResult = [
        {
          customer_id: customerId,
          was_active: false, // Already inactive
          success: true,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockResult, error: null })

      await deleteCustomer(customerId, vendorId)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_customer_safe', {
        p_customer_id: customerId,
        p_vendor_id: vendorId,
      })
    })
  })

  describe('getCustomers', () => {
    it('should fetch only active customers by default', async () => {
      const mockCustomers = [
        { id: 'c1', first_name: 'John', is_active: true },
        { id: 'c2', first_name: 'Jane', is_active: true },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockCustomers, error: null }),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await getCustomers()

      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
      expect(result).toEqual(mockCustomers)
    })

    it('should include inactive customers when requested', async () => {
      const mockCustomers = [
        { id: 'c1', first_name: 'John', is_active: true },
        { id: 'c2', first_name: 'Jane', is_active: false },
      ]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockCustomers, error: null }),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      await getCustomers({ includeInactive: true })

      // eq should NOT be called for is_active when includeInactive is true
      expect(mockQuery.eq).not.toHaveBeenCalledWith('is_active', true)
    })

    it('should filter by search term', async () => {
      const mockCustomers = [{ id: 'c1', first_name: 'John', is_active: true }]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockCustomers, error: null }),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      await getCustomers({ searchTerm: 'John' })

      expect(mockQuery.or).toHaveBeenCalled()
    })
  })

  describe('searchCustomers', () => {
    it('should search only active customers', async () => {
      const mockCustomers = [{ id: 'c1', first_name: 'John', is_active: true }]

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockCustomers, error: null }),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await searchCustomers('John')

      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
      expect(result).toEqual(mockCustomers)
    })

    it('should return empty array for empty search term', async () => {
      const result = await searchCustomers('')

      expect(result).toEqual([])
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })
  })

  describe('getCustomerById', () => {
    it('should fetch only active customer by default', async () => {
      const mockCustomer = { id: 'c1', first_name: 'John', is_active: true }

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCustomer, error: null }),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await getCustomerById('c1')

      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'c1')
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true)
      expect(result).toEqual(mockCustomer)
    })

    it('should include inactive customer when requested', async () => {
      const mockCustomer = { id: 'c1', first_name: 'John', is_active: false }

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCustomer, error: null }),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      await getCustomerById('c1', true)

      // Should only have one eq call for ID, not for is_active
      const eqCalls = mockQuery.eq.mock.calls
      expect(eqCalls.length).toBe(1)
      expect(eqCalls[0]).toEqual(['id', 'c1'])
    })
  })

  describe('createCustomer', () => {
    it('should create customer using atomic function', async () => {
      const mockCustomer = {
        id: 'c1',
        email: 'john@example.com',
        phone: '1234567890',
        first_name: 'John',
        last_name: 'Doe',
        loyalty_points: 0,
        total_spent: 0,
        total_orders: 0,
        is_active: true,
      }

      const mockRpcResult = [
        {
          customer_id: 'c1',
          created: true,
          duplicate_found: false,
          success: true,
        },
      ]

      // Mock the RPC call
      mockSupabase.rpc.mockResolvedValue({ data: mockRpcResult, error: null })

      // Mock the follow-up fetch
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCustomer, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await createCustomer({
        email: 'john@example.com',
        phone: '(123) 456-7890',
        first_name: 'John',
        last_name: 'Doe',
        vendor_id: 'vendor-123',
      })

      expect(result).toEqual(mockCustomer)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_customer_safe', {
        p_vendor_id: 'vendor-123',
        p_first_name: 'John',
        p_last_name: 'Doe',
        p_email: 'john@example.com',
        p_phone: '(123) 456-7890',
        p_middle_name: null,
        p_date_of_birth: null,
        p_street_address: null,
        p_city: null,
        p_state: null,
        p_postal_code: null,
        p_idempotency_key: null,
      })
    })

    it('should handle duplicate detection', async () => {
      const existingCustomer = {
        id: 'existing-c1',
        email: 'existing@example.com',
        phone: '5555555555',
        first_name: 'Existing',
        last_name: 'Customer',
        loyalty_points: 100,
        total_spent: 500,
        total_orders: 10,
        is_active: true,
      }

      const mockRpcResult = [
        {
          customer_id: 'existing-c1',
          created: false,
          duplicate_found: true,
          success: true,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockRpcResult, error: null })

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existingCustomer, error: null }),
      }
      mockSupabase.from.mockReturnValue(mockQuery)

      const result = await createCustomer({
        email: 'existing@example.com',
        phone: '555-555-5555',
        first_name: 'Different',
        last_name: 'Name',
        vendor_id: 'vendor-123',
      })

      // Should return the existing customer
      expect(result).toEqual(existingCustomer)
      expect(result.id).toBe('existing-c1')
    })

    it('should throw error if vendor ID is missing', async () => {
      await expect(
        createCustomer({
          first_name: 'John',
          last_name: 'Doe',
        })
      ).rejects.toThrow('Vendor ID is required')
    })

    it('should throw error if first name is missing', async () => {
      await expect(
        createCustomer({
          last_name: 'Doe',
          vendor_id: 'vendor-123',
        } as any)
      ).rejects.toThrow('First name and last name are required')
    })

    it('should throw error if operation fails', async () => {
      const mockRpcResult = [
        {
          customer_id: null,
          created: false,
          duplicate_found: false,
          success: false,
        },
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockRpcResult, error: null })

      await expect(
        createCustomer({
          first_name: 'John',
          last_name: 'Doe',
          vendor_id: 'vendor-123',
        })
      ).rejects.toThrow('Failed to create customer: operation did not complete')
    })
  })
})
