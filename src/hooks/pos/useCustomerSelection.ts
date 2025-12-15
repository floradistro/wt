/**
 * useCustomerSelection Hook - ZERO PROPS ✅
 * Jobs Principle: Manage customer selection state and logic
 *
 * ZERO PROP DRILLING:
 * - No vendorId prop - reads from customer.store
 * - Handles customer selection state, scanned ID data, matching logic
 */

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import { useCustomerStore } from '@/stores/customer.store'
import type { Customer } from '@/types/pos'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

export interface CustomerMatch {
  customer: Customer
  confidence: 'exact' | 'high'
  confidenceScore: number
  matchedFields: string[]
  reason: string
}

export function useCustomerSelection() {
  // ========================================
  // STORE - TRUE ZERO PROPS (read from environment)
  // ========================================
  const vendorId = useCustomerStore((state) => state.vendorId)

  // ========================================
  // STATE
  // ========================================
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [scannedDataForNewCustomer, setScannedDataForNewCustomer] = useState<AAMVAData | null>(null)
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([])

  // ========================================
  // HANDLERS
  // ========================================
  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null)
  }, [])

  const handleCustomerSelected = useCallback((customer: Customer) => {
    setSelectedCustomer(customer)
    setScannedDataForNewCustomer(null)
    setCustomerMatches([])
  }, [])

  const handleScannedDataReceived = useCallback((data: AAMVAData) => {
    setScannedDataForNewCustomer(data)
  }, [])

  const clearScannedData = useCallback(() => {
    setScannedDataForNewCustomer(null)
  }, [])

  const handleCustomerMatchesFound = useCallback((matches: CustomerMatch[]) => {
    setCustomerMatches(matches)
  }, [])

  const clearCustomerMatches = useCallback(() => {
    setCustomerMatches([])
  }, [])

  /**
   * Intelligent Multi-Strategy Customer Matching
   *
   * Uses a three-tier matching system to find existing customers from scanned ID data,
   * preventing duplicate customer creation while maintaining high accuracy.
   *
   * **Matching Strategy:**
   * 1. **Exact Match** (License Number): 100% confidence, instant match
   * 2. **High Match** (Name + DOB): Handles name variations (first+middle combinations)
   * 3. **Fuzzy Match** (Similarity Score): Uses weighted scoring for partial matches
   *    - Last name: 50 points (most important)
   *    - First name: 30 points
   *    - Minimum score: 50 points required
   *
   * **Middle Name Handling:**
   * - Tries "John Michael" as first_name
   * - Tries "John" + middle_name="Michael"
   * - Tries "John" alone (ignores middle)
   *
   * @param data - Parsed AAMVA barcode data from driver's license
   * @returns Object with matched customer and match type, or nulls if no match
   *
   * @example
   * ```ts
   * const { customer, matchType } = await findMatchingCustomer(scannedData)
   * if (matchType === 'exact') {
   *   // Auto-select customer
   * } else if (matchType === 'high') {
   *   // Show confirmation prompt
   * } else {
   *   // Create new customer
   * }
   * ```
   */
  const findMatchingCustomer = useCallback(async (data: AAMVAData): Promise<{
    customer: Customer | null
    matchType: 'exact' | 'high' | null
  }> => {
    // Get vendorId from store at call time
    const currentVendorId = useCustomerStore.getState().vendorId

    if (!currentVendorId) {
      logger.error('Cannot find matching customer: vendorId not set in store')
      return { customer: null, matchType: null }
    }

    try {
      logger.debug('🔍 [Customer Match] Searching for customer with ID data:', {
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        licenseNumber: data.licenseNumber ? `***${data.licenseNumber.slice(-4)}` : null,
        vendorId: currentVendorId,
      })

      let customer: Customer | null = null
      let matchType: 'exact' | 'high' | null = null

      // Step 1: Try to find by license number (exact match)
      if (data.licenseNumber) {
        logger.debug('🔍 [Customer Match] Step 1: Searching by license number')
        const { data: licenseMatch, error } = await supabase
          .from('customers')
          .select('*')
          .eq('drivers_license_number', data.licenseNumber)
          .eq('vendor_id', currentVendorId)
          .eq('is_active', true)
          .single()

        if (error) {
          logger.debug('🔍 [Customer Match] License search error (expected if not found):', error.message)
        }

        if (licenseMatch) {
          logger.debug('✅ [Customer Match] FOUND by license number:', {
            customerId: licenseMatch.id,
            name: `${licenseMatch.first_name} ${licenseMatch.last_name}`,
          })
          customer = licenseMatch
          matchType = 'exact'
          return { customer, matchType }
        }
      }

      // Step 2: Try exact name + DOB match (with middle name variations)
      if (data.firstName && data.lastName && data.dateOfBirth) {
        logger.debug('🔍 [Customer Match] Step 2: Exact name + DOB match')

        // Try multiple name combinations
        const nameVariations: { first_name: string; middle_name: string | null }[] = [
          // Exact first name
          { first_name: data.firstName, middle_name: data.middleName || null },
          // First + Middle as first_name (if middle name exists)
          ...(data.middleName ? [{ first_name: `${data.firstName} ${data.middleName}`, middle_name: null }] : []),
          // Just first name, ignore middle
          { first_name: data.firstName, middle_name: null },
        ]

        for (const nameVar of nameVariations) {
          const query = supabase
            .from('customers')
            .select('*')
            .eq('first_name', nameVar.first_name)
            .eq('last_name', data.lastName)
            .eq('date_of_birth', data.dateOfBirth)
            .eq('vendor_id', currentVendorId)
            .eq('is_active', true)

          const { data: nameMatches, error } = await query

          if (error) {
            logger.debug('🔍 [Customer Match] Name search error:', error.message)
            continue
          }

          if (nameMatches && nameMatches.length > 0) {
            logger.debug('✅ [Customer Match] FOUND by exact name + DOB:', {
              searchedName: `${nameVar.first_name} ${data.lastName}`,
              foundCustomer: `${nameMatches[0].first_name} ${nameMatches[0].last_name}`,
              customerId: nameMatches[0].id,
            })
            customer = nameMatches[0]
            matchType = 'high'
            return { customer, matchType }
          }
        }
      }

      // Step 3: Fuzzy matching on name with same DOB
      if (data.firstName && data.lastName && data.dateOfBirth) {
        logger.debug('🔍 [Customer Match] Step 3: Fuzzy matching with same DOB')
        const { data: allCustomers } = await supabase
          .from('customers')
          .select('*')
          .eq('date_of_birth', data.dateOfBirth)
          .eq('vendor_id', currentVendorId)
          .eq('is_active', true)

        logger.debug('🔍 [Customer Match] Found customers with same DOB:', allCustomers?.length || 0)

        if (allCustomers && allCustomers.length > 0) {
          const firstName = data.firstName.toLowerCase().trim()
          const middleName = (data.middleName || '').toLowerCase().trim()
          const lastName = data.lastName.toLowerCase().trim()
          const fullFirstName = middleName ? `${firstName} ${middleName}` : firstName

          // Calculate similarity scores
          const scoredMatches = allCustomers
            .map((c) => {
              const cFirst = (c.first_name || '').toLowerCase().trim()
              const cMiddle = (c.middle_name || '').toLowerCase().trim()
              const cLast = (c.last_name || '').toLowerCase().trim()
              const cFullFirst = cMiddle ? `${cFirst} ${cMiddle}` : cFirst
              let score = 0

              // Last name matching (most important - 50 points)
              if (cLast === lastName) score += 50
              else if (cLast.startsWith(lastName) || lastName.startsWith(cLast)) score += 30
              else if (cLast.includes(lastName) || lastName.includes(cLast)) score += 20

              // First name matching (30 points)
              // Try multiple combinations
              if (cFirst === firstName) score += 30
              else if (cFullFirst === fullFirstName) score += 30
              else if (cFirst === fullFirstName) score += 25
              else if (cFirst.startsWith(firstName) || firstName.startsWith(cFirst)) score += 20
              else if (cFirst.includes(firstName) || firstName.includes(cFirst)) score += 10

              logger.debug('🔍 [Customer Match] Fuzzy score:', {
                customer: `${c.first_name} ${c.middle_name || ''} ${c.last_name}`,
                score,
              })

              return { customer: c, score }
            })
            .filter((m) => m.score >= 50) // Only strong matches
            .sort((a, b) => b.score - a.score)

          if (scoredMatches.length > 0) {
            logger.debug('✅ [Customer Match] FOUND by fuzzy matching:', {
              score: scoredMatches[0].score,
              customer: `${scoredMatches[0].customer.first_name} ${scoredMatches[0].customer.last_name}`,
              customerId: scoredMatches[0].customer.id,
            })
            customer = scoredMatches[0].customer
            matchType = 'high'
            return { customer, matchType }
          }
        }
      }

      logger.warn('❌ [Customer Match] No match found')
      return { customer: null, matchType: null }
    } catch (error) {
      logger.error('Error finding matching customer:', error)
      return { customer: null, matchType: null }
    }
  }, [])

  /**
   * Create customer match object for UI display
   */
  const createCustomerMatch = useCallback((
    customer: Customer,
    matchType: 'exact' | 'high'
  ): CustomerMatch => {
    return {
      customer,
      confidence: matchType,
      confidenceScore: matchType === 'exact' ? 100 : 90,
      matchedFields: matchType === 'exact' ? ['license', 'name', 'dob'] : ['name', 'dob'],
      reason: matchType === 'exact'
        ? 'License number matched'
        : 'Name and date of birth matched',
    }
  }, [])

  return {
    // State
    selectedCustomer,
    scannedDataForNewCustomer,
    customerMatches,

    // Actions
    setSelectedCustomer,
    handleClearCustomer,
    handleCustomerSelected,
    handleScannedDataReceived,
    clearScannedData,
    handleCustomerMatchesFound,
    clearCustomerMatches,

    // Utilities
    findMatchingCustomer,
    createCustomerMatch,
  }
}
