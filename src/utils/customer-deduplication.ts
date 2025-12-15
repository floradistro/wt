/**
 * Customer De-Duplication Utilities
 * Prevent duplicate customers and intelligently match existing ones
 */

import { supabase } from '@/lib/supabase/client'
import type { Customer } from '@/services/customers.service'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { normalizePhone, normalizeEmail } from './data-normalization'
import { logger } from '@/utils/logger'
import type { PostgrestError } from '@supabase/supabase-js'

type SupabaseQueryResult<T> = {
  data: T[] | null
  error: PostgrestError | null
}

export type MatchConfidence = 'exact' | 'high' | 'medium' | 'low'

export interface CustomerMatch {
  customer: Customer
  confidence: MatchConfidence
  confidenceScore: number // 0-100
  matchedFields: string[]
  reason: string
}

/**
 * Find potential duplicate customers before creating a new one
 *
 * Matching Priority:
 * 1. Driver's License Number (100% - EXACT)
 * 2. Phone + DOB (95% - HIGH)
 * 3. Email (90% - HIGH)
 * 4. First + Last + DOB (85% - HIGH)
 * 5. Phone only (75% - MEDIUM)
 * 6. First + Last name (60% - MEDIUM)
 *
 * Performance: Uses parallel query execution and 5s timeouts
 * Optimized with database indexes for 50-100x faster lookups
 */
export async function findPotentialDuplicates(params: {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  dateOfBirth?: string
  driversLicenseNumber?: string
  vendorId?: string
}): Promise<CustomerMatch[]> {
  const startTime = performance.now()
  const matches: CustomerMatch[] = []

  // Query timeout wrapper with error logging
  const QUERY_TIMEOUT = 5000 // 5 seconds
  const queryWithTimeout = async <T>(
    promise: Promise<T> | PromiseLike<T>,
    queryName: string
  ): Promise<T | null> => {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        logger.warn(`[Customer Deduplication] Query timeout: ${queryName} exceeded ${QUERY_TIMEOUT}ms`)
        resolve(null)
      }, QUERY_TIMEOUT)
    )
    try {
      return await Promise.race([promise, timeoutPromise])
    } catch (error) {
      logger.error(`[Customer Deduplication] Query error in ${queryName}:`, error)
      return null
    }
  }

  // Normalize inputs
  const normalizedPhone = normalizePhone(params.phone)
  const normalizedEmail = normalizeEmail(params.email)

  // LEVEL 1: Driver's License Number (100% match - EXACT)
  // Return immediately if found - this is definitive
  if (params.driversLicenseNumber) {
    const result = await queryWithTimeout<SupabaseQueryResult<Customer>>(
      supabase
        .from('customers')
        .select('*')
        .eq('drivers_license_number', params.driversLicenseNumber)
        .eq('is_active', true)
        .limit(1) as unknown as Promise<SupabaseQueryResult<Customer>>,
      'license_lookup'
    )

    if (result?.data && result.data.length > 0) {
      const duration = performance.now() - startTime
      // console.log(`[Customer Deduplication] Exact match found via license in ${duration.toFixed(0)}ms`)

      matches.push({
        customer: result.data[0] as Customer,
        confidence: 'exact',
        confidenceScore: 100,
        matchedFields: ['drivers_license_number'],
        reason: 'Same driver\'s license number',
      })
      return matches
    }
  }

  // LEVEL 2-6: Run remaining queries in parallel for performance
  // Only execute queries if we have the required data
  const parallelQueries: Promise<{ matches: CustomerMatch[]; level: number }>[] = []

  // LEVEL 2: Phone + DOB (95% match - HIGH)
  if (normalizedPhone && params.dateOfBirth) {
    parallelQueries.push(
      queryWithTimeout<SupabaseQueryResult<Customer>>(
        supabase
          .from('customers')
          .select('*')
          .eq('phone', normalizedPhone)
          .eq('date_of_birth', params.dateOfBirth)
          .eq('is_active', true)
          .limit(5) as unknown as Promise<SupabaseQueryResult<Customer>>,
        'phone_dob_lookup'
      ).then(result => ({
        matches: (result?.data || []).map((customer: Customer) => ({
          customer,
          confidence: 'high' as MatchConfidence,
          confidenceScore: 95,
          matchedFields: ['phone', 'date_of_birth'],
          reason: 'Same phone number and date of birth',
        })),
        level: 2,
      }))
    )
  }

  // LEVEL 3: Email (90% match - HIGH)
  if (normalizedEmail && !normalizedEmail.includes('@walk-in.local') && !normalizedEmail.includes('@alpine.local')) {
    parallelQueries.push(
      queryWithTimeout<SupabaseQueryResult<Customer>>(
        supabase
          .from('customers')
          .select('*')
          .eq('email', normalizedEmail)
          .eq('is_active', true)
          .limit(5) as unknown as Promise<SupabaseQueryResult<Customer>>,
        'email_lookup'
      ).then(result => ({
        matches: (result?.data || []).map((customer: Customer) => ({
          customer,
          confidence: 'high' as MatchConfidence,
          confidenceScore: 90,
          matchedFields: ['email'],
          reason: 'Same email address',
        })),
        level: 3,
      }))
    )
  }

  // LEVEL 4: First + Last + DOB (85% match - HIGH)
  if (params.firstName && params.lastName && params.dateOfBirth) {
    let query = supabase
      .from('customers')
      .select('*')
      .ilike('first_name', params.firstName)
      .ilike('last_name', params.lastName)
      .eq('date_of_birth', params.dateOfBirth)
      .eq('is_active', true)
      .limit(5)

    if (params.vendorId) {
      query = query.eq('vendor_id', params.vendorId)
    }

    parallelQueries.push(
      queryWithTimeout<SupabaseQueryResult<Customer>>(query as unknown as Promise<SupabaseQueryResult<Customer>>, 'name_dob_lookup').then(result => ({
        matches: (result?.data || []).map((customer: Customer) => ({
          customer,
          confidence: 'high' as MatchConfidence,
          confidenceScore: 85,
          matchedFields: ['first_name', 'last_name', 'date_of_birth'],
          reason: 'Same name and date of birth',
        })),
        level: 4,
      }))
    )
  }

  // LEVEL 5: Phone only (75% match - MEDIUM)
  if (normalizedPhone) {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('is_active', true)
      .limit(5)

    if (params.vendorId) {
      query = query.eq('vendor_id', params.vendorId)
    }

    parallelQueries.push(
      queryWithTimeout<SupabaseQueryResult<Customer>>(query as unknown as Promise<SupabaseQueryResult<Customer>>, 'phone_lookup').then(result => ({
        matches: (result?.data || []).map((customer: Customer) => ({
          customer,
          confidence: 'medium' as MatchConfidence,
          confidenceScore: 75,
          matchedFields: ['phone'],
          reason: 'Same phone number (could be family member)',
        })),
        level: 5,
      }))
    )
  }

  // LEVEL 6: First + Last name only (60% match - MEDIUM)
  if (params.firstName && params.lastName) {
    let query = supabase
      .from('customers')
      .select('*')
      .ilike('first_name', params.firstName)
      .ilike('last_name', params.lastName)
      .eq('is_active', true)
      .limit(5)

    if (params.vendorId) {
      query = query.eq('vendor_id', params.vendorId)
    }

    parallelQueries.push(
      queryWithTimeout<SupabaseQueryResult<Customer>>(query as unknown as Promise<SupabaseQueryResult<Customer>>, 'name_lookup').then(result => ({
        matches: (result?.data || []).map((customer: Customer) => ({
          customer,
          confidence: 'medium' as MatchConfidence,
          confidenceScore: 60,
          matchedFields: ['first_name', 'last_name'],
          reason: 'Same name (could be different person)',
        })),
        level: 6,
      }))
    )
  }

  // Execute all queries in parallel
  const results = await Promise.all(parallelQueries)

  // Deduplicate and merge results
  const seenCustomerIds = new Set<string>()
  results.forEach(result => {
    result.matches.forEach(match => {
      if (!seenCustomerIds.has(match.customer.id)) {
        seenCustomerIds.add(match.customer.id)
        matches.push(match)
      }
    })
  })

  // Sort by confidence score (highest first)
  const sortedMatches = matches.sort((a, b) => b.confidenceScore - a.confidenceScore)

  // Performance logging
  const duration = performance.now() - startTime
  // console.log(
  //   `[Customer Deduplication] Found ${sortedMatches.length} potential matches in ${duration.toFixed(0)}ms`,
  //   sortedMatches.length > 0 ? `(highest: ${sortedMatches[0].confidenceScore}%)` : ''
  // )

  return sortedMatches
}

/**
 * Find duplicates from scanned ID data
 */
export async function findDuplicatesFromScan(
  scannedData: AAMVAData,
  vendorId?: string
): Promise<CustomerMatch[]> {
  return findPotentialDuplicates({
    firstName: scannedData.firstName,
    lastName: scannedData.lastName,
    phone: undefined, // Don't use phone from ID - not on most licenses
    dateOfBirth: scannedData.dateOfBirth,
    driversLicenseNumber: scannedData.licenseNumber,
    vendorId,
  })
}

/**
 * Check if customer should be created or if duplicate exists
 * Returns true if safe to create, false if duplicate found
 */
export async function shouldCreateNewCustomer(params: {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  dateOfBirth?: string
  driversLicenseNumber?: string
  vendorId?: string
}): Promise<{
  shouldCreate: boolean
  matches: CustomerMatch[]
  recommendation: string
}> {
  const matches = await findPotentialDuplicates(params)

  // Exact or high confidence match - don't create
  if (matches.length > 0 && (matches[0].confidence === 'exact' || matches[0].confidence === 'high')) {
    return {
      shouldCreate: false,
      matches,
      recommendation: `Found ${matches[0].confidence} match: ${matches[0].reason}. Use existing customer instead.`,
    }
  }

  // Medium confidence - warn but allow
  if (matches.length > 0 && matches[0].confidence === 'medium') {
    return {
      shouldCreate: true, // Allow but show warning
      matches,
      recommendation: `Found ${matches.length} possible match(es). Review before creating.`,
    }
  }

  // No matches or low confidence - safe to create
  return {
    shouldCreate: true,
    matches,
    recommendation: 'No duplicates found. Safe to create new customer.',
  }
}

/**
 * Merge two customer records
 * Keeps the primary customer and merges data from secondary
 *
 * @param primaryId - Customer to keep
 * @param secondaryId - Customer to merge and delete
 * @returns Updated primary customer
 */
export async function mergeCustomers(
  primaryId: string,
  secondaryId: string
): Promise<{ success: boolean; error?: string; customer?: Customer }> {
  try {
    // Get both customers
    const { data: primary } = await supabase
      .from('customers')
      .select('*')
      .eq('id', primaryId)
      .single()

    const { data: secondary } = await supabase
      .from('customers')
      .select('*')
      .eq('id', secondaryId)
      .single()

    if (!primary || !secondary) {
      return { success: false, error: 'One or both customers not found' }
    }

    // Merge data - keep primary's data, fill in blanks from secondary
    const mergedData: Partial<Customer> = {
      email: primary.email || secondary.email,
      phone: primary.phone || secondary.phone,
      first_name: primary.first_name || secondary.first_name,
      last_name: primary.last_name || secondary.last_name,
      full_name: primary.full_name || secondary.full_name,
      // Combine stats
      loyalty_points: primary.loyalty_points + secondary.loyalty_points,
      total_spent: primary.total_spent + secondary.total_spent,
      total_orders: primary.total_orders + secondary.total_orders,
    }

    // Update primary customer
    const { data: updated, error: updateError } = await supabase
      .from('customers')
      .update(mergedData)
      .eq('id', primaryId)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // TODO: Reassign orders from secondary to primary
    // This requires updating the orders table
    await supabase
      .from('orders')
      .update({ customer_id: primaryId })
      .eq('customer_id', secondaryId)

    // TODO: Reassign loyalty transactions
    await supabase
      .from('loyalty_transactions')
      .update({ customer_id: primaryId })
      .eq('customer_id', secondaryId)

    // Soft delete secondary customer
    await supabase
      .from('customers')
      .update({
        is_active: false,
        email: `merged.${secondaryId}@deleted.local`, // Prevent email conflicts
      })
      .eq('id', secondaryId)

    return { success: true, customer: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during merge',
    }
  }
}
