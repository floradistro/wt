/**
 * useRecentCustomers Hook
 * Jobs Principle: Manage recently searched customers
 *
 * Features:
 * - Store last 10 customers searched
 * - Persist to AsyncStorage
 * - Show on empty search
 * - Clear all recent searches
 */

import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Customer } from '@/types/pos'
import { logger } from '@/utils/logger'

const RECENT_CUSTOMERS_KEY = '@whaletools:recent_customers'
const MAX_RECENT = 10

export interface RecentCustomer extends Customer {
  viewedAt: string // ISO timestamp
}

export function useRecentCustomers(vendorId: string) {
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])

  // Load recent customers on mount
  useEffect(() => {
    loadRecentCustomers()
  }, [vendorId])

  const loadRecentCustomers = async () => {
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
        `${RECENT_CUSTOMERS_KEY}:${vendorId}`,
        JSON.stringify(updated)
      )
    } catch (error) {
      logger.error('[useRecentCustomers] Failed to save:', error)
    }
  }, [recentCustomers, vendorId])

  const clearRecentCustomers = useCallback(async () => {
    try {
      setRecentCustomers([])
      await AsyncStorage.removeItem(`${RECENT_CUSTOMERS_KEY}:${vendorId}`)
    } catch (error) {
      logger.error('[useRecentCustomers] Failed to clear:', error)
    }
  }, [vendorId])

  return {
    recentCustomers,
    addRecentCustomer,
    clearRecentCustomers,
  }
}
