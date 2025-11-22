/**
 * Customer Store
 * Jobs Principle: Single source of truth for customer selection and ID scanning
 *
 * ANTI-LOOP DESIGN:
 * - ✅ All selectors ONLY return values (no setState, no calculations)
 * - ✅ All mutations happen in actions
 * - ✅ No subscriptions that call setState
 * - ✅ No useEffects (stores don't use React hooks)
 * - ✅ Actions exported as plain objects with getters
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import type { Customer } from '@/types/pos'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'

// ========================================
// TYPES
// ========================================
export interface CustomerMatch {
  customer: Customer
  confidence: 'exact' | 'high'
  confidenceScore: number
  matchedFields: string[]
  reason: string
}

interface CustomerState {
  // State
  selectedCustomer: Customer | null
  scannedDataForNewCustomer: AAMVAData | null
  customerMatches: CustomerMatch[]
  vendorId: string | null

  // Actions
  selectCustomer: (customer: Customer) => void
  clearCustomer: () => void
  setScannedData: (data: AAMVAData) => void
  clearScannedData: () => void
  setCustomerMatches: (matches: CustomerMatch[]) => void
  clearCustomerMatches: () => void
  setVendorId: (vendorId: string) => void
  findMatchingCustomer: (data: AAMVAData) => Promise<{
    customer: Customer | null
    matchType: 'exact' | 'high' | null
  }>
  createCustomerMatch: (customer: Customer, matchType: 'exact' | 'high') => CustomerMatch
  reset: () => void
}

// ========================================
// STORE
// ========================================
// ANTI-LOOP: No useEffects, no subscriptions, no setState in selectors
export const useCustomerStore = create<CustomerState>((set, get) => ({
  // State
  selectedCustomer: null,
  scannedDataForNewCustomer: null,
  customerMatches: [],
  vendorId: null,

  // Actions
  selectCustomer: (customer: Customer) => {
    // ANTI-LOOP: Simple setState - no side effects, no circular dependencies
    set({
      selectedCustomer: customer,
      scannedDataForNewCustomer: null,
      customerMatches: [],
    })
  },

  clearCustomer: () => {
    // ANTI-LOOP: Simple setState - no side effects
    set({ selectedCustomer: null })
  },

  setScannedData: (data: AAMVAData) => {
    // ANTI-LOOP: Simple setState - no side effects
    set({ scannedDataForNewCustomer: data })
  },

  clearScannedData: () => {
    // ANTI-LOOP: Simple setState - no side effects
    set({ scannedDataForNewCustomer: null })
  },

  setCustomerMatches: (matches: CustomerMatch[]) => {
    // ANTI-LOOP: Simple setState - no side effects
    set({ customerMatches: matches })
  },

  clearCustomerMatches: () => {
    // ANTI-LOOP: Simple setState - no side effects
    set({ customerMatches: [] })
  },

  setVendorId: (vendorId: string) => {
    // ANTI-LOOP: Only sets value - no side effects
    set({ vendorId })
  },

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
   * ANTI-LOOP: This is an async action that returns a value - it does NOT call setState
   * Components must call this and then decide whether to call setCustomerMatches
   */
  findMatchingCustomer: async (data: AAMVAData) => {
    const { vendorId } = get()

    if (!vendorId) {
      logger.error('Cannot find matching customer: vendorId not set')
      return { customer: null, matchType: null }
    }

    try {
      logger.debug('🔍 [Customer Match] Searching for customer with ID data:', {
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        licenseNumber: data.licenseNumber ? `***${data.licenseNumber.slice(-4)}` : null,
        vendorId,
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
          .eq('vendor_id', vendorId)
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
        const nameVariations: Array<{ first_name: string; middle_name: string | null }> = [
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
            .eq('vendor_id', vendorId)
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
          .eq('vendor_id', vendorId)
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
  },

  /**
   * Create customer match object for UI display
   * ANTI-LOOP: Pure function - no setState, just returns a value
   */
  createCustomerMatch: (customer: Customer, matchType: 'exact' | 'high'): CustomerMatch => {
    return {
      customer,
      confidence: matchType,
      confidenceScore: matchType === 'exact' ? 100 : 90,
      matchedFields: matchType === 'exact' ? ['license', 'name', 'dob'] : ['name', 'dob'],
      reason: matchType === 'exact'
        ? 'License number matched'
        : 'Name and date of birth matched',
    }
  },

  reset: () => {
    set({
      selectedCustomer: null,
      scannedDataForNewCustomer: null,
      customerMatches: [],
    })
  },
}))

// ========================================
// SELECTORS (ANTI-LOOP: Use useShallow for objects)
// ========================================
// ✅ Primitive value - direct selector (no useShallow needed)
export const useSelectedCustomer = () =>
  useCustomerStore((state) => state.selectedCustomer)

export const useScannedDataForNewCustomer = () =>
  useCustomerStore((state) => state.scannedDataForNewCustomer)

export const useCustomerMatches = () =>
  useCustomerStore((state) => state.customerMatches)

// ✅ Object return - use useShallow to prevent infinite re-renders
export const useCustomerState = () =>
  useCustomerStore(
    useShallow((state) => ({
      selectedCustomer: state.selectedCustomer,
      scannedData: state.scannedDataForNewCustomer,
      matches: state.customerMatches,
    }))
  )

// ========================================
// ACTIONS (ANTI-LOOP: Export as plain object with getters, NOT hooks)
// ========================================
// ✅ CORRECT: Direct action imports (no subscription loop)
export const customerActions = {
  get selectCustomer() { return useCustomerStore.getState().selectCustomer },
  get clearCustomer() { return useCustomerStore.getState().clearCustomer },
  get setScannedData() { return useCustomerStore.getState().setScannedData },
  get clearScannedData() { return useCustomerStore.getState().clearScannedData },
  get setCustomerMatches() { return useCustomerStore.getState().setCustomerMatches },
  get clearCustomerMatches() { return useCustomerStore.getState().clearCustomerMatches },
  get setVendorId() { return useCustomerStore.getState().setVendorId },
  get findMatchingCustomer() { return useCustomerStore.getState().findMatchingCustomer },
  get createCustomerMatch() { return useCustomerStore.getState().createCustomerMatch },
  get reset() { return useCustomerStore.getState().reset },
}
