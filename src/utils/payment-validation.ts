/**
 * Payment Validation Utilities
 *
 * Runtime safeguards to prevent payment integration issues.
 * These validators throw errors in development to catch problems early.
 */

import type { PaymentData } from '@/components/pos/payment'

/**
 * Validates that payment data comes from a real processor, not mock data
 *
 * @throws Error if payment data appears to be mocked
 */
export function validateRealPaymentData(paymentData: PaymentData): void {
  if (paymentData.paymentMethod === 'cash') {
    // Cash payments don't need processor validation
    return
  }

  // Check for mock transaction ID patterns
  if (paymentData.transactionId) {
    if (paymentData.transactionId.match(/^TXN\d+$/)) {
      throw new Error(
        `INVALID PAYMENT DATA: Transaction ID "${paymentData.transactionId}" appears to be mocked. ` +
        `Real transaction IDs should come from the payment processor, not generated locally.`
      )
    }
  }

  // Check for mock authorization code patterns
  if (paymentData.authorizationCode) {
    if (paymentData.authorizationCode.match(/^AUTH\d+$/)) {
      throw new Error(
        `INVALID PAYMENT DATA: Authorization code "${paymentData.authorizationCode}" appears to be mocked. ` +
        `Real authorization codes should come from the payment processor, not generated locally.`
      )
    }
  }

  // ========================================================================
  // NOTE: In the TWO-PHASE COMMIT architecture with Edge Functions:
  // - Client passes paymentMethod: 'card' or 'split'
  // - Edge Function handles Dejavoo processing and gets authorization
  // - Authorization codes come from Edge Function, NOT from client
  //
  // We don't validate authorization codes here because they don't exist yet.
  // The Edge Function will validate that Dejavoo payment succeeded.
  // ========================================================================

  // Validation for card payments (future extension - not needed for Edge Function architecture)
  if (paymentData.authorizationCode && paymentData.cardLast4 === '4242' && __DEV__) {
    console.warn(
      '⚠️ WARNING: Card ending in 4242 detected. This is a common test card. ' +
      'Ensure you are using real payment processing in production.'
    )
  }
}

/**
 * Validates payment method is database-compatible
 *
 * @throws Error if payment method doesn't match database constraints
 */
export function validatePaymentMethod(method: string): void {
  const validMethods = ['credit', 'debit', 'ebt_food', 'ebt_cash', 'gift', 'cash', 'check', 'split']

  const normalized = method.toLowerCase()

  if (!validMethods.includes(normalized)) {
    throw new Error(
      `INVALID PAYMENT METHOD: "${method}" is not a valid payment method. ` +
      `Valid methods are: ${validMethods.join(', ')}. ` +
      `Did you forget to normalize the payment method? Use normalizePaymentMethod() before saving.`
    )
  }
}

/**
 * Normalizes payment method for database compatibility
 *
 * Maps frontend payment method names to database-compatible values.
 */
export function normalizePaymentMethod(method: string): string {
  // Map 'card' to 'credit' for database compatibility
  if (method.toLowerCase() === 'card') {
    return 'credit'
  }

  // IMPORTANT: Keep 'split' as 'split' so Edge Function can detect split payments
  // The split payment details (cash/card amounts) are sent separately
  // DO NOT convert split to credit!

  return method.toLowerCase()
}

/**
 * Validates processor configuration
 *
 * @throws Error if processor appears to be misconfigured
 */
export function validateProcessor(processor: any): void {
  if (!processor) {
    throw new Error('INVALID PROCESSOR: Processor is null or undefined')
  }

  if (!processor.processor_id) {
    throw new Error('INVALID PROCESSOR: Processor missing processor_id')
  }

  if (processor.is_live === false) {
    throw new Error(
      `PROCESSOR OFFLINE: Processor "${processor.processor_name || processor.processor_id}" is not live. ` +
      `Cannot process payments.`
    )
  }
}

/**
 * Validates API response from payment endpoint
 *
 * @throws Error if response is invalid
 */
export function validatePaymentResponse(response: any): void {
  if (!response) {
    throw new Error('INVALID RESPONSE: Payment API returned null or undefined')
  }

  if (response.success === false) {
    throw new Error(response.error || 'Payment failed')
  }

  if (!response.success) {
    throw new Error('INVALID RESPONSE: Payment API response missing success field')
  }

  // Validate transaction data is present
  if (!response.transactionId && !response.transaction_id) {
    throw new Error('INVALID RESPONSE: Payment succeeded but missing transaction ID')
  }

  if (!response.authorizationCode && !response.authorization_code) {
    throw new Error('INVALID RESPONSE: Payment succeeded but missing authorization code')
  }
}

/**
 * Development-only: Checks for mock payment code in source
 *
 * Call this during app initialization in development to ensure
 * no mock payment code exists in the codebase.
 */
export function checkForMockPaymentCode(): void {
  if (!__DEV__) return

  const warnings = []

  // This is a compile-time check - we can't actually scan source code at runtime
  // But we can log a reminder for developers
  // eslint-disable-next-line no-console
  console.log(
    '✅ Payment Validation: Ensure no mock payment code exists:\n' +
    '   - No "AUTH${Date.now()}" patterns\n' +
    '   - No "TXN${Date.now()}" patterns\n' +
    '   - No hardcoded card numbers (4242, etc.)\n' +
    '   - All payments use Edge Function (process-payment)'
  )
}

/**
 * Validates environment configuration for payment processing
 *
 * @throws Error if environment is not properly configured
 */
export function validatePaymentEnvironment(): void {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL

  if (!apiUrl) {
    throw new Error(
      'INVALID ENVIRONMENT: EXPO_PUBLIC_API_URL is not set. ' +
      'Payment processing requires a backend API URL. ' +
      'Set EXPO_PUBLIC_API_URL in your .env file and rebuild the app.'
    )
  }

  if (apiUrl.includes('localhost') && !__DEV__) {
    throw new Error(
      'INVALID ENVIRONMENT: Production app is pointing to localhost. ' +
      'EXPO_PUBLIC_API_URL should be set to https://whaletools.dev for production.'
    )
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Payment Environment: API URL = ${apiUrl}`)
}
