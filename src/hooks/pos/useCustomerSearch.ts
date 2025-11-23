/**
 * useCustomerSearch Hook - ZERO PROPS ✅
 * Jobs Principle: Manage customer search and filtering
 *
 * ZERO PROP DRILLING:
 * - No vendorId prop - reads from customer.store
 * - Handles search query state, customer search, debounced search
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useDebounce } from '@/hooks/useDebounce'
import { useCustomerStore } from '@/stores/customer.store'
import type { Customer } from '@/types/pos'

export function useCustomerSearch() {
  // ========================================
  // STORE - TRUE ZERO PROPS (read from environment)
  // ========================================
  const vendorId = useCustomerStore((state) => state.vendorId)
  // ========================================
  // STATE
  // ========================================
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)

  // Debounce search query by 150ms to prevent excessive API calls while feeling responsive
  const debouncedSearchQuery = useDebounce(searchQuery, 150)

  // ========================================
  // SEARCH LOGIC
  // ========================================
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setCustomers([])
        setSearching(false)
        return
      }

      // Get vendorId from store at search time
      const currentVendorId = useCustomerStore.getState().vendorId
      if (!currentVendorId) {
        logger.error('Cannot search customers: vendorId not set in store')
        setSearching(false)
        return
      }

      setSearching(true)
      try {
        // Smart search - Search ALL customers from this vendor across ALL fields, NO LIMITS
        // Searches: first_name, last_name, email, phone, display_name, middle_name
        const searchTerm = query.trim()

        // Normalize phone numbers - remove formatting characters for phone search
        const normalizedPhone = searchTerm.replace(/[\s\-\(\)\.]/g, '')
        const isPhoneSearch = /^\d+$/.test(normalizedPhone) && normalizedPhone.length >= 3

        let searchConditions = `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,middle_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`

        // Add phone search with normalized number for better matching
        if (isPhoneSearch) {
          searchConditions += `,phone.ilike.%${normalizedPhone}%`
        } else {
          searchConditions += `,phone.ilike.%${searchTerm}%`
        }

        const { data: results } = await supabase
          .from('customers')
          .select('*')
          .eq('vendor_id', currentVendorId)
          .eq('is_active', true) // Only search active customers
          .or(searchConditions)
          .order('created_at', { ascending: false })
          .limit(100000) // Very high limit to ensure we get ALL active customers

        setCustomers(results || [])
      } catch (error) {
        logger.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    },
    []
  )

  // Trigger search when debounced query changes
  useEffect(() => {
    performSearch(debouncedSearchQuery)
  }, [debouncedSearchQuery, performSearch])

  // Show searching state while debouncing (user is typing)
  useEffect(() => {
    if (searchQuery !== debouncedSearchQuery) {
      setSearching(true)
    }
  }, [searchQuery, debouncedSearchQuery])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setCustomers([])
    setSearching(false)
  }, [])

  return {
    // State
    searchQuery,
    customers,
    searching,

    // Actions
    setSearchQuery, // Use setSearchQuery directly instead of handleSearch
    clearSearch,
  }
}
