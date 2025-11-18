/**
 * Customer De-Duplication Utilities
 * Prevent duplicate customers and intelligently match existing ones
 */

import { supabase } from '@/lib/supabase/client'
import type { Customer } from '@/services/customers.service'
import type { AAMVAData } from '@/lib/id-scanner/aamva-parser'
import { normalizePhone, normalizeEmail } from './data-normalization'

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
  const matches: CustomerMatch[] = []

  // Normalize inputs
  const normalizedPhone = normalizePhone(params.phone)
  const normalizedEmail = normalizeEmail(params.email)

  // LEVEL 1: Driver's License Number (100% match - EXACT)
  if (params.driversLicenseNumber) {
    const { data: licenseMatches } = await supabase
      .from('customers')
      .select('*')
      .eq('drivers_license_number', params.driversLicenseNumber)
      .limit(1)

    if (licenseMatches && licenseMatches.length > 0) {
      matches.push({
        customer: licenseMatches[0],
        confidence: 'exact',
        confidenceScore: 100,
        matchedFields: ['drivers_license_number'],
        reason: 'Same driver\'s license number',
      })
      return matches // Return immediately - this is definitive
    }
  }

  // LEVEL 2: Phone + DOB (95% match - HIGH)
  if (normalizedPhone && params.dateOfBirth) {
    const { data: phoneDobMatches } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('date_of_birth', params.dateOfBirth)
      .limit(5)

    if (phoneDobMatches) {
      phoneDobMatches.forEach(customer => {
        matches.push({
          customer,
          confidence: 'high',
          confidenceScore: 95,
          matchedFields: ['phone', 'date_of_birth'],
          reason: 'Same phone number and date of birth',
        })
      })
    }
  }

  // LEVEL 3: Email (90% match - HIGH, if real email)
  if (normalizedEmail && !normalizedEmail.includes('@walk-in.local') && !normalizedEmail.includes('@alpine.local')) {
    const { data: emailMatches } = await supabase
      .from('customers')
      .select('*')
      .eq('email', normalizedEmail)
      .limit(5)

    if (emailMatches) {
      emailMatches.forEach(customer => {
        // Avoid duplicates if already matched
        if (!matches.find(m => m.customer.id === customer.id)) {
          matches.push({
            customer,
            confidence: 'high',
            confidenceScore: 90,
            matchedFields: ['email'],
            reason: 'Same email address',
          })
        }
      })
    }
  }

  // LEVEL 4: First + Last + DOB (85% match - HIGH)
  if (params.firstName && params.lastName && params.dateOfBirth) {
    let query = supabase
      .from('customers')
      .select('*')
      .ilike('first_name', params.firstName)
      .ilike('last_name', params.lastName)
      .eq('date_of_birth', params.dateOfBirth)
      .limit(5)

    if (params.vendorId) {
      query = query.eq('vendor_id', params.vendorId)
    }

    const { data: nameDobMatches } = await query

    if (nameDobMatches) {
      nameDobMatches.forEach(customer => {
        if (!matches.find(m => m.customer.id === customer.id)) {
          matches.push({
            customer,
            confidence: 'high',
            confidenceScore: 85,
            matchedFields: ['first_name', 'last_name', 'date_of_birth'],
            reason: 'Same name and date of birth',
          })
        }
      })
    }
  }

  // LEVEL 5: Phone only (75% match - MEDIUM)
  if (normalizedPhone && matches.length === 0) {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('phone', normalizedPhone)
      .limit(5)

    if (params.vendorId) {
      query = query.eq('vendor_id', params.vendorId)
    }

    const { data: phoneMatches } = await query

    if (phoneMatches) {
      phoneMatches.forEach(customer => {
        if (!matches.find(m => m.customer.id === customer.id)) {
          matches.push({
            customer,
            confidence: 'medium',
            confidenceScore: 75,
            matchedFields: ['phone'],
            reason: 'Same phone number (could be family member)',
          })
        }
      })
    }
  }

  // LEVEL 6: First + Last name only (60% match - MEDIUM)
  if (params.firstName && params.lastName && matches.length === 0) {
    let query = supabase
      .from('customers')
      .select('*')
      .ilike('first_name', params.firstName)
      .ilike('last_name', params.lastName)
      .limit(5)

    if (params.vendorId) {
      query = query.eq('vendor_id', params.vendorId)
    }

    const { data: nameMatches } = await query

    if (nameMatches) {
      nameMatches.forEach(customer => {
        if (!matches.find(m => m.customer.id === customer.id)) {
          matches.push({
            customer,
            confidence: 'medium',
            confidenceScore: 60,
            matchedFields: ['first_name', 'last_name'],
            reason: 'Same name (could be different person)',
          })
        }
      })
    }
  }

  // Sort by confidence score (highest first)
  return matches.sort((a, b) => b.confidenceScore - a.confidenceScore)
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
      middle_name: primary.middle_name || secondary.middle_name,
      date_of_birth: primary.date_of_birth || secondary.date_of_birth,
      street_address: primary.street_address || secondary.street_address,
      city: primary.city || secondary.city,
      state: primary.state || secondary.state,
      postal_code: primary.postal_code || secondary.postal_code,
      drivers_license_number: primary.drivers_license_number || secondary.drivers_license_number,
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
