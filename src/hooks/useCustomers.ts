/**
 * Customers Hook
 *
 * React hook for managing customers using Supabase directly.
 * Replaces API calls to /api/customers
 */

import { useState, useEffect, useCallback } from 'react'
import { customersService, type Customer, type CustomerWithOrders } from '@/services'
import { logger } from '@/utils/logger'

// Re-export types for convenience
export type { Customer, CustomerWithOrders }

export interface UseCustomersOptions {
  limit?: number
  searchTerm?: string
  autoLoad?: boolean
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const { limit = 20, searchTerm, autoLoad = true } = options

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Load customers with current filters
   */
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await customersService.getCustomers({ limit, searchTerm })
      setCustomers(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load customers:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, searchTerm])

  /**
   * Search customers (for POS)
   */
  const searchCustomers = useCallback(async (term: string, searchLimit = 20) => {
    try {
      setLoading(true)
      setError(null)
      const data = await customersService.searchCustomers(term, searchLimit)
      setCustomers(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to search customers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get customer by phone (for POS lookup)
   */
  const getCustomerByPhone = useCallback(async (phone: string) => {
    try {
      setLoading(true)
      setError(null)
      return await customersService.getCustomerByPhone(phone)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to get customer by phone:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get customer by email
   */
  const getCustomerByEmail = useCallback(async (email: string) => {
    try {
      setLoading(true)
      setError(null)
      return await customersService.getCustomerByEmail(email)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to get customer by email:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create new customer
   */
  const createCustomer = useCallback(
    async (params: {
      email?: string
      phone?: string
      first_name?: string
      last_name?: string
      vendor_id?: string
    }) => {
      try {
        setLoading(true)
        setError(null)
        const newCustomer = await customersService.createCustomer(params)

        // Add to local state
        setCustomers((prev) => [newCustomer, ...prev])

        return newCustomer
      } catch (err) {
        setError(err as Error)
        logger.error('Failed to create customer:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Update customer
   */
  const updateCustomer = useCallback(
    async (customerId: string, updates: Partial<Customer>) => {
      try {
        setLoading(true)
        setError(null)
        const updatedCustomer = await customersService.updateCustomer(customerId, updates)

        // Update local state
        setCustomers((prev) =>
          prev.map((customer) => (customer.id === customerId ? updatedCustomer : customer))
        )

        return updatedCustomer
      } catch (err) {
        setError(err as Error)
        logger.error('Failed to update customer:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Update customer loyalty points
   */
  const updateLoyaltyPoints = useCallback(
    async (customerId: string, pointsChange: number) => {
      try {
        setLoading(true)
        setError(null)
        await customersService.updateCustomerLoyaltyPoints(customerId, pointsChange)

        // Update local state
        setCustomers((prev) =>
          prev.map((customer) =>
            customer.id === customerId
              ? { ...customer, loyalty_points: customer.loyalty_points + pointsChange }
              : customer
          )
        )
      } catch (err) {
        setError(err as Error)
        logger.error('Failed to update loyalty points:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Delete customer (soft delete)
   */
  const deleteCustomer = useCallback(
    async (customerId: string) => {
      try {
        setLoading(true)
        setError(null)
        await customersService.deleteCustomer(customerId)

        // Remove from local state
        setCustomers((prev) => prev.filter((customer) => customer.id !== customerId))
      } catch (err) {
        setError(err as Error)
        logger.error('Failed to delete customer:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  /**
   * Refresh customers
   */
  const refresh = useCallback(() => {
    loadCustomers()
  }, [loadCustomers])

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad) {
      loadCustomers()
    }
  }, [autoLoad, loadCustomers])

  return {
    // State
    customers,
    loading,
    error,

    // Actions
    loadCustomers,
    searchCustomers,
    getCustomerByPhone,
    getCustomerByEmail,
    createCustomer,
    updateCustomer,
    updateLoyaltyPoints,
    deleteCustomer,
    refresh,
  }
}

/**
 * Hook for managing a single customer
 */
export function useCustomer(customerId: string | null) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadCustomer = useCallback(async () => {
    if (!customerId) {
      setCustomer(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await customersService.getCustomerById(customerId)
      setCustomer(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load customer:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadCustomer()
  }, [loadCustomer])

  return {
    customer,
    loading,
    error,
    reload: loadCustomer,
  }
}

/**
 * Hook for customer with orders
 */
export function useCustomerWithOrders(customerId: string | null) {
  const [customer, setCustomer] = useState<CustomerWithOrders | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadCustomer = useCallback(async () => {
    if (!customerId) {
      setCustomer(null)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await customersService.getCustomerWithOrders(customerId)
      setCustomer(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load customer with orders:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadCustomer()
  }, [loadCustomer])

  return {
    customer,
    loading,
    error,
    reload: loadCustomer,
  }
}

/**
 * Hook for top customers
 */
export function useTopCustomers(limit = 10) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadTopCustomers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await customersService.getTopCustomers(limit)
      setCustomers(data)
    } catch (err) {
      setError(err as Error)
      logger.error('Failed to load top customers:', err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    loadTopCustomers()
  }, [loadTopCustomers])

  return {
    customers,
    loading,
    error,
    reload: loadTopCustomers,
  }
}
