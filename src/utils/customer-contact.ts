/**
 * Customer Contact Validation Utilities
 *
 * Identifies placeholder/fake emails and checks if customers have
 * real contactable information.
 */

/**
 * Placeholder email domains that should NOT be used for sending emails
 */
const PLACEHOLDER_DOMAINS = [
  '@walk-in.local',
  '@walkin.local',
  '@phone.local',
  '@alpine.local',
  '@pos.local',
  '@deleted.local',
  '@example.com',
  '@example.org',
  '@example.net',
  '@test.com',
  '@test.local',
]

/**
 * Placeholder email patterns that indicate fake/generated emails
 */
const PLACEHOLDER_PATTERNS = [
  /^walkin-/i,
  /^deleted\./i,
  /^merged\./i,
  /^test-/i,
  /^fake@/i,
  /^noemail/i,
  /^none@/i,
  /^na@/i,
  /^unknown@/i,
  /^placeholder/i,
  /^customer@/i,
  /^guest@/i,
  /^anonymous/i,
  /alpineiq/i,
  /^\d+@phone\.local$/i,       // Phone number as email like 1234567890@phone.local
  /^\d+@alpine\.local$/i,      // Phone number as email like 1234567890@alpine.local
]

/**
 * Check if an email is a placeholder/fake email
 * Returns true if the email should NOT be used for sending real emails
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true

  const emailLower = email.toLowerCase().trim()
  if (!emailLower) return true

  // Check domain patterns
  for (const domain of PLACEHOLDER_DOMAINS) {
    if (emailLower.endsWith(domain)) {
      return true
    }
  }

  // Check local part patterns
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(emailLower)) {
      return true
    }
  }

  return false
}

/**
 * Check if an email is a real, contactable email address
 */
export function isRealEmail(email: string | null | undefined): boolean {
  return !isPlaceholderEmail(email)
}

/**
 * Check if a phone number is valid (not empty or placeholder)
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false
  // Remove all non-digits and check length
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10
}

/**
 * Customer contact info status
 */
export interface CustomerContactStatus {
  hasRealEmail: boolean
  hasValidPhone: boolean
  needsEmail: boolean
  needsPhone: boolean
  isComplete: boolean
  message: string | null
}

/**
 * Get comprehensive contact status for a customer
 */
export function getCustomerContactStatus(customer: {
  email?: string | null
  phone?: string | null
} | null): CustomerContactStatus {
  if (!customer) {
    return {
      hasRealEmail: false,
      hasValidPhone: false,
      needsEmail: true,
      needsPhone: true,
      isComplete: false,
      message: 'No customer selected',
    }
  }

  const hasRealEmail = isRealEmail(customer.email)
  const hasValidPhone = isValidPhone(customer.phone)

  // Customer is "complete" if they have at least one real contact method
  // but we want BOTH for full marketing reach
  const isComplete = hasRealEmail && hasValidPhone

  let message: string | null = null
  if (!hasRealEmail && !hasValidPhone) {
    message = 'Missing email and phone number'
  } else if (!hasRealEmail) {
    message = 'Missing email address'
  } else if (!hasValidPhone) {
    message = 'Missing phone number'
  }

  return {
    hasRealEmail,
    hasValidPhone,
    needsEmail: !hasRealEmail,
    needsPhone: !hasValidPhone,
    isComplete,
    message,
  }
}

/**
 * Format what contact info is missing for display
 */
export function formatMissingContactInfo(customer: {
  email?: string | null
  phone?: string | null
} | null): string[] {
  const missing: string[] = []
  const status = getCustomerContactStatus(customer)

  if (status.needsEmail) {
    missing.push('email')
  }
  if (status.needsPhone) {
    missing.push('phone')
  }

  return missing
}
