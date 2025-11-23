/**
 * useRecentCustomers Hook - ZERO PROPS ✅
 * Jobs Principle: Manage recently searched customers
 *
 * ZERO PROP DRILLING:
 * - No vendorId prop - reads from customer.store
 * - Store last 10 customers searched, persist to AsyncStorage
 */

import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCustomerStore } from '@/stores/customer.store'
import type { Customer } from '@/types/pos'
import { logger } from '@/utils/logger'

const RECENT_CUSTOMERS_KEY = '@whaletools:recent_customers'
const MAX_RECENT = 10

export interface RecentCustomer extends Customer {
  viewedAt: string // ISO timestamp
}

export function useRecentCustomers() {
  // ========================================
  // STORE - TRUE ZERO PROPS (read from environment)
  // ========================================
  const vendorId = useCustomerStore((state) => state.vendorId)

  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])

  // Load recent customers on mount or when vendorId changes
  useEffect(() => {
    if (vendorId) {
      loadRecentCustomers()
    }
  }, [vendorId])

  const loadRecentCustomers = async () => {
    if (!vendorId) return

    try {
      const stored = await AsyncStorage.getItem(`${RECENT_CUSTOMERS_KEY}:${vendorId}`)
      if (stored) {
        const customers = JSON.parse(stored) as RecentCustomer[]
        setRecentCustomers(customers)
      }
    } catch (error) {
      logger.error('[useRecentCustomers] Failed to load:', error)
    }
  }

  const addRecentCustomer = useCallback(async (customer: Customer) => {
    const currentVendorId = useCustomerStore.getState().vendorId
    if (!currentVendorId) return

    try {
      // Remove if already exists (move to top)
      const filtered = recentCustomers.filter(c => c.id !== customer.id)

      // Add to beginning with timestamp
      const recentCustomer: RecentCustomer = {
        ...customer,
        viewedAt: new Date().toISOString(),
      }

      // Limit to MAX_RECENT
      const updated = [recentCustomer, ...filtered].slice(0, MAX_RECENT)

      // Update state and storage
      setRecentCustomers(updated)
      await AsyncStorage.setItem(
        `${RECENT_CUSTOMERS_KEY}:${currentVendorId}`,
        JSON.stringify(updated)
      )
    } catch (error) {
      logger.error('[useRecentCustomers] Failed to save:', error)
    }
  }, [recentCustomers])

  const clearRecentCustomers = useCallback(async () => {
    const currentVendorId = useCustomerStore.getState().vendorId
    if (!currentVendorId) return

    try {
      setRecentCustomers([])
      await AsyncStorage.removeItem(`${RECENT_CUSTOMERS_KEY}:${currentVendorId}`)
    } catch (error) {
      logger.error('[useRecentCustomers] Failed to clear:', error)
    }
  }, [])

  return {
    recentCustomers,
    addRecentCustomer,
    clearRecentCustomers,
  }
}
