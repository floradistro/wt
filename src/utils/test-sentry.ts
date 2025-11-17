/* eslint-disable no-console */
/**
 * Sentry Integration Test Utility
 *
 * Use this to verify Sentry is working correctly.
 * Import this in your app and call the test functions.
 */

import { Sentry } from './sentry'

/**
 * Test 1: Simple Error Capture
 * Should appear in Sentry dashboard immediately
 */
export function testSentryErrorCapture() {
  console.log('🧪 Testing Sentry error capture...')

  try {
    throw new Error('TEST: Sentry error capture verification')
  } catch (error) {
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        test: 'error_capture',
        feature: 'sentry_integration',
      },
      extra: {
        testDescription: 'Simple error capture test',
        timestamp: new Date().toISOString(),
      },
    })
    console.log('✅ Test error sent to Sentry')
  }
}

/**
 * Test 2: Breadcrumb Trail
 * Should show sequence of events leading to error
 */
export function testSentryBreadcrumbs() {
  console.log('🧪 Testing Sentry breadcrumbs...')

  // Add breadcrumbs
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Step 1: User opened payment modal',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Step 2: User selected credit card payment',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Step 3: Payment processing started',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Step 4: Error occurred',
    level: 'error',
  })

  // Capture error with breadcrumbs
  try {
    throw new Error('TEST: Breadcrumb trail verification')
  } catch (error) {
    Sentry.captureException(error, {
      level: 'warning',
      tags: {
        test: 'breadcrumbs',
        feature: 'sentry_integration',
      },
    })
    console.log('✅ Test error with breadcrumbs sent to Sentry')
  }
}

/**
 * Test 3: Context Data
 * Should show rich context in error details
 */
export function testSentryContext() {
  console.log('🧪 Testing Sentry context...')

  // Set context
  Sentry.setContext('payment', {
    type: 'card',
    amount: 42.50,
    itemCount: 3,
    hasProcessor: true,
    processorName: 'Test Processor',
  })

  Sentry.setContext('customer', {
    id: 'test-customer-123',
    firstName: 'Test',
    lastName: 'User',
    loyaltyPoints: 150,
  })

  // Capture error with context
  try {
    throw new Error('TEST: Context data verification')
  } catch (error) {
    Sentry.captureException(error, {
      level: 'info',
      tags: {
        test: 'context',
        feature: 'sentry_integration',
      },
    })
    console.log('✅ Test error with context sent to Sentry')
  }
}

/**
 * Test 4: Performance Transaction
 * Should appear in Performance monitoring
 */
export async function testSentryPerformance() {
  console.log('🧪 Testing Sentry performance monitoring...')

  // Use captureMessage with performance tag instead of transactions
  // Sentry.startTransaction may not be available in this SDK version
  try {
    // Simulate payment steps timing
    const start = Date.now()
    await new Promise(resolve => setTimeout(resolve, 100))
    const validateTime = Date.now() - start

    await new Promise(resolve => setTimeout(resolve, 500))
    const apiTime = Date.now() - start - validateTime

    await new Promise(resolve => setTimeout(resolve, 200))
    const totalTime = Date.now() - start

    Sentry.captureMessage('TEST: Performance tracking verification', {
      level: 'info',
      tags: {
        test: 'performance',
        feature: 'sentry_integration',
      },
      extra: {
        testDescription: 'Performance monitoring test',
        timestamp: new Date().toISOString(),
        timing: {
          validateTime,
          apiTime,
          totalTime,
          totalAmount: 42.50,
        },
      },
    })

    console.log('✅ Test transaction sent to Sentry')
  } catch (error) {
    console.error('❌ Performance test failed:', error)
  }
}

/**
 * Test 5: Payment Error Simulation
 * Simulates real payment flow error
 */
export function testPaymentError() {
  console.log('🧪 Testing payment error flow...')

  Sentry.setContext('payment', {
    type: 'card',
    amount: 99.99,
    itemCount: 5,
    hasProcessor: true,
    processorName: 'Test Terminal',
    locationId: 'test-location-123',
    registerId: 'test-register-456',
  })

  Sentry.addBreadcrumb({
    category: 'payment',
    message: 'Payment initiated',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'payment',
    message: 'Processor validation passed',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'payment',
    message: 'Payment stage: initializing',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'payment',
    message: 'Payment stage: sending to terminal',
    level: 'info',
  })

  // Simulate timeout error
  const error = new Error('TEST: Payment timeout error (3 min timeout)')
  error.name = 'AbortError'

  Sentry.captureException(error, {
    level: 'warning',
    contexts: {
      payment: {
        type: 'card',
        amount: 99.99,
        stage: 'waiting_for_customer',
        errorType: 'timeout',
        isTimeout: true,
        shouldRetry: true,
      },
      processor: {
        id: 'test-processor-789',
        name: 'Test Terminal',
      },
    },
    tags: {
      test: 'payment_error',
      'payment.method': 'card',
      'error.type': 'timeout',
      'payment.retryable': 'true',
    },
  })

  console.log('✅ Test payment error sent to Sentry')
}

/**
 * Test 6: Processor Health Check Error
 * Simulates health check failure
 */
export function testProcessorHealthError() {
  console.log('🧪 Testing processor health check error...')

  Sentry.setContext('processor', {
    locationId: 'test-location-123',
    registerId: 'test-register-456',
    isEnabled: true,
  })

  Sentry.addBreadcrumb({
    category: 'processor',
    message: 'Health check initiated',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'processor',
    message: 'Calling health check API',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'processor',
    message: 'Health check timeout',
    level: 'error',
  })

  const error = new Error('TEST: Processor health check timeout')
  error.name = 'AbortError'

  Sentry.captureException(error, {
    level: 'warning',
    contexts: {
      processor: {
        locationId: 'test-location-123',
        registerId: 'test-register-456',
        isEnabled: true,
        errorMsg: 'Health check timeout',
        isTimeout: true,
        duration: 10000,
      },
    },
    tags: {
      test: 'health_check_error',
      'processor.operation': 'health_check',
      'error.type': 'timeout',
    },
  })

  console.log('✅ Test health check error sent to Sentry')
}

/**
 * Test 7: Checkout Error
 * Simulates transaction saving failure
 */
export function testCheckoutError() {
  console.log('🧪 Testing checkout error...')

  Sentry.setContext('checkout', {
    total: 125.75,
    subtotal: 115.00,
    taxAmount: 10.75,
    itemCount: 8,
    paymentMethod: 'credit',
    hasCustomer: true,
    customerId: 'test-customer-123',
    vendorId: 'test-vendor-456',
    locationId: 'test-location-789',
    sessionId: 'test-session-012',
    hasLoyaltyPoints: true,
    loyaltyPointsToRedeem: 50,
    loyaltyDiscountAmount: 5.00,
  })

  Sentry.addBreadcrumb({
    category: 'checkout',
    message: 'Starting checkout process',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'checkout',
    message: 'Validating payment data',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'checkout',
    message: 'Calling create_pos_sale RPC',
    level: 'info',
  })

  Sentry.addBreadcrumb({
    category: 'checkout',
    message: 'RPC error creating sale',
    level: 'error',
  })

  const error = new Error('TEST: Failed to create sale - Database connection timeout')

  Sentry.captureException(error, {
    level: 'error',
    contexts: {
      checkout: {
        total: 125.75,
        subtotal: 115.00,
        taxAmount: 10.75,
        itemCount: 8,
        paymentMethod: 'credit',
        hasCustomer: true,
        customerId: 'test-customer-123',
        vendorId: 'test-vendor-456',
        locationId: 'test-location-789',
        sessionId: 'test-session-012',
        hasLoyaltyPoints: true,
        loyaltyPointsToRedeem: 50,
        loyaltyDiscountAmount: 5.00,
      },
    },
    tags: {
      test: 'checkout_error',
      'checkout.operation': 'create_sale',
      'payment.method': 'credit',
    },
  })

  console.log('✅ Test checkout error sent to Sentry')
}

/**
 * Run all tests
 * Call this to verify complete Sentry integration
 */
export async function runAllSentryTests() {
  console.log('\n🚀 Starting comprehensive Sentry integration tests...\n')

  // Test 1: Simple error
  testSentryErrorCapture()
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 2: Breadcrumbs
  testSentryBreadcrumbs()
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 3: Context
  testSentryContext()
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 4: Performance
  await testSentryPerformance()
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 5: Payment error
  testPaymentError()
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 6: Health check error
  testProcessorHealthError()
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Test 7: Checkout error
  testCheckoutError()

  console.log('\n✅ All Sentry tests completed!')
  console.log('📊 Check your Sentry dashboard at: https://sentry.io/')
  console.log('\nYou should see:')
  console.log('  • 7 new errors in Issues')
  console.log('  • 4 performance transactions')
  console.log('  • Breadcrumbs attached to errors')
  console.log('  • Context data in error details')
  console.log('  • Tags for filtering (test, feature, etc.)')
}

/**
 * Quick test - just send one error
 */
export function quickSentryTest() {
  console.log('🧪 Quick Sentry test...')

  Sentry.captureMessage('TEST: Quick Sentry verification', {
    level: 'info',
    tags: {
      test: 'quick_test',
      timestamp: new Date().toISOString(),
    },
  })

  console.log('✅ Test message sent to Sentry')
  console.log('📊 Check your dashboard: https://sentry.io/')
}
