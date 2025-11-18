/**
 * Data Normalization Utilities
 * Ensures consistent formatting of customer data across all entry points
 */

/**
 * Normalize phone number - remove ALL formatting
 * MUST match normalization in customers.service.ts and POSUnifiedCustomerSelector.tsx
 *
 * @example "(828) 320-4633" → "8283204633"
 * @example "828-320-4633" → "8283204633"
 * @example "828.320.4633" → "8283204633"
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (!trimmed) return null

  // Remove ALL formatting: spaces, dashes, parentheses, periods
  return trimmed.replace(/[\s\-\(\)\.]/g, '')
}

/**
 * Normalize email - lowercase and trim
 *
 * @example "John.DOE@GMAIL.COM" → "john.doe@gmail.com"
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const trimmed = email.trim()
  if (!trimmed) return null

  return trimmed.toLowerCase()
}

/**
 * Normalize name - title case (first letter uppercase, rest lowercase)
 * Handles special cases like McDonald, O'Brien, etc.
 *
 * @example "JOHN" → "John"
 * @example "mcdonald" → "McDonald"
 * @example "o'brien" → "O'Brien"
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (!trimmed) return null

  // Convert to lowercase first
  let normalized = trimmed.toLowerCase()

  // Title case: capitalize first letter
  normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1)

  // Handle Mc/Mac prefixes (McDonald, MacArthur)
  normalized = normalized.replace(/\bMc([a-z])/g, (match, letter) => `Mc${letter.toUpperCase()}`)
  normalized = normalized.replace(/\bMac([a-z])/g, (match, letter) => `Mac${letter.toUpperCase()}`)

  // Handle O' prefix (O'Brien, O'Connor)
  normalized = normalized.replace(/\bO'([a-z])/g, (match, letter) => `O'${letter.toUpperCase()}`)

  // Handle De/La/Le/Van/Von prefixes
  normalized = normalized.replace(/\bDe ([A-Z][a-z]+)/g, (match) => match)
  normalized = normalized.replace(/\bLa ([A-Z][a-z]+)/g, (match) => match)
  normalized = normalized.replace(/\bLe ([A-Z][a-z]+)/g, (match) => match)
  normalized = normalized.replace(/\bVan ([A-Z][a-z]+)/g, (match) => match)
  normalized = normalized.replace(/\bVon ([A-Z][a-z]+)/g, (match) => match)

  return normalized
}

/**
 * Normalize city name - title case for each word
 *
 * @example "CHARLOTTE" → "Charlotte"
 * @example "new york" → "New York"
 * @example "SAN FRANCISCO" → "San Francisco"
 */
export function normalizeCity(city: string | null | undefined): string | null {
  if (!city) return null
  const trimmed = city.trim()
  if (!trimmed) return null

  // Title case each word
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Normalize state code - uppercase, 2 characters
 *
 * @example "nc" → "NC"
 * @example "california" → "CA" (if we add state name lookup)
 */
export function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null
  const trimmed = state.trim()
  if (!trimmed) return null

  // Uppercase and limit to 2 characters
  return trimmed.toUpperCase().substring(0, 2)
}

/**
 * Normalize postal code - remove spaces, limit to 5-10 chars
 *
 * @example "28202-1234" → "282021234"
 * @example "28202 1234" → "282021234"
 */
export function normalizePostalCode(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null
  const trimmed = postalCode.trim()
  if (!trimmed) return null

  // Remove spaces and dashes
  return trimmed.replace(/[\s\-]/g, '').substring(0, 10)
}

/**
 * Normalize street address - title case
 *
 * @example "123 MAIN ST" → "123 Main St"
 * @example "456 oak avenue" → "456 Oak Avenue"
 */
export function normalizeAddress(address: string | null | undefined): string | null {
  if (!address) return null
  const trimmed = address.trim()
  if (!trimmed) return null

  // Title case each word, but preserve numbers
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Don't capitalize if it's just numbers
      if (/^\d+$/.test(word)) return word
      // Handle abbreviations (St, Ave, Blvd, etc) - keep them lowercase for now
      if (['st', 'ave', 'rd', 'blvd', 'ln', 'dr', 'ct', 'pl', 'way'].includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1)
      }
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}
