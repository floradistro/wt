/**
 * RUN ALL SENTRY TESTS
 * Directly sends all 7 test events to Sentry
 *
 * Usage: node RUN_ALL_SENTRY_TESTS.js
 */

const https = require('https');

const DSN = 'https://084642e519a1cb616b4c02060327eb9a@o4510333066674176.ingest.us.sentry.io/4510373174771717';

// Parse DSN
const dsnMatch = DSN.match(/https:\/\/(.+)@(.+)\/(.+)/);
if (!dsnMatch) {
  console.error('❌ Invalid DSN format');
  process.exit(1);
}

const [, key, host, projectId] = dsnMatch;

console.log('🚀 Running ALL Sentry Integration Tests...\n');
console.log('DSN:', DSN);
console.log('Host:', host);
console.log('Project ID:', projectId);
console.log('\n📤 Sending 7 test events to Sentry...\n');

// Helper function to send event
function sendEvent(event, testName) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(event);

    const options = {
      hostname: host,
      path: `/api/${projectId}/store/`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=test-script/1.0.0`,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${testName}`);
          resolve();
        } else {
          console.log(`❌ ${testName} - Status ${res.statusCode}`);
          console.log('   Response:', responseData);
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ ${testName} - ${error.message}`);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Test 1: Error Capture
async function test1ErrorCapture() {
  const event = {
    event_id: require('crypto').randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    sdk: { name: 'test-script', version: '1.0.0' },
    exception: {
      values: [{
        type: 'Error',
        value: 'TEST: Sentry error capture verification',
        stacktrace: {
          frames: [
            {
              filename: 'test-sentry.ts',
              function: 'testSentryErrorCapture',
              lineno: 18,
            }
          ]
        }
      }]
    },
    level: 'error',
    tags: {
      test: 'error_capture',
      feature: 'sentry_integration',
    },
    extra: {
      testDescription: 'Simple error capture test',
      timestamp: new Date().toISOString(),
    },
  };
  await sendEvent(event, 'Test 1: Error Capture');
}

// Test 2: Breadcrumbs
async function test2Breadcrumbs() {
  const event = {
    event_id: require('crypto').randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    sdk: { name: 'test-script', version: '1.0.0' },
    exception: {
      values: [{
        type: 'Error',
        value: 'TEST: Breadcrumb trail verification',
        stacktrace: {
          frames: [
            {
              filename: 'test-sentry.ts',
              function: 'testSentryBreadcrumbs',
              lineno: 69,
            }
          ]
        }
      }]
    },
    level: 'warning',
    tags: {
      test: 'breadcrumbs',
      feature: 'sentry_integration',
    },
    breadcrumbs: [
      {
        timestamp: Date.now() / 1000,
        category: 'test',
        message: 'Step 1: User opened payment modal',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'test',
        message: 'Step 2: User selected credit card payment',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'test',
        message: 'Step 3: Payment processing started',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'test',
        message: 'Step 4: Error occurred',
        level: 'error',
      },
    ],
  };
  await sendEvent(event, 'Test 2: Breadcrumbs');
}

// Test 3: Context Data
async function test3Context() {
  const event = {
    event_id: require('crypto').randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    sdk: { name: 'test-script', version: '1.0.0' },
    exception: {
      values: [{
        type: 'Error',
        value: 'TEST: Context data verification',
        stacktrace: {
          frames: [
            {
              filename: 'test-sentry.ts',
              function: 'testSentryContext',
              lineno: 107,
            }
          ]
        }
      }]
    },
    level: 'info',
    tags: {
      test: 'context',
      feature: 'sentry_integration',
    },
    contexts: {
      payment: {
        type: 'card',
        amount: 42.50,
        itemCount: 3,
        hasProcessor: true,
        processorName: 'Test Processor',
      },
      customer: {
        id: 'test-customer-123',
        firstName: 'Test',
        lastName: 'User',
        loyaltyPoints: 150,
      },
    },
  };
  await sendEvent(event, 'Test 3: Context Data');
}

// Test 4: Performance
async function test4Performance() {
  const event = {
    event_id: require('crypto').randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    sdk: { name: 'test-script', version: '1.0.0' },
    message: 'TEST: Performance tracking verification',
    level: 'info',
    tags: {
      test: 'performance',
      feature: 'sentry_integration',
    },
    extra: {
      testDescription: 'Performance monitoring test',
      timestamp: new Date().toISOString(),
      timing: {
        validateTime: 100,
        apiTime: 500,
        totalTime: 800,
        totalAmount: 42.50,
      },
    },
  };
  await sendEvent(event, 'Test 4: Performance Tracking');
}

// Test 5: Payment Error
async function test5PaymentError() {
  const event = {
    event_id: require('crypto').randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    sdk: { name: 'test-script', version: '1.0.0' },
    exception: {
      values: [{
        type: 'AbortError',
        value: 'TEST: Payment timeout error (3 min timeout)',
        stacktrace: {
          frames: [
            {
              filename: 'POSPaymentModal.tsx',
              function: 'handleCardPayment',
              lineno: 207,
            }
          ]
        }
      }]
    },
    level: 'warning',
    tags: {
      test: 'payment_error',
      'payment.method': 'card',
      'error.type': 'timeout',
      'payment.retryable': 'true',
    },
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
    breadcrumbs: [
      {
        timestamp: Date.now() / 1000,
        category: 'payment',
        message: 'Payment initiated',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'payment',
        message: 'Processor validation passed',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'payment',
        message: 'Payment stage: initializing',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'payment',
        message: 'Payment stage: sending to terminal',
        level: 'info',
      },
    ],
  };
  await sendEvent(event, 'Test 5: Payment Error');
}

// Test 6: Health Check Error
async function test6HealthCheck() {
  const event = {
    event_id: require('crypto').randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    sdk: { name: 'test-script', version: '1.0.0' },
    exception: {
      values: [{
        type: 'AbortError',
        value: 'TEST: Processor health check timeout',
        stacktrace: {
          frames: [
            {
              filename: 'payment-processor.store.ts',
              function: 'testConnection',
              lineno: 268,
            }
          ]
        }
      }]
    },
    level: 'warning',
    tags: {
      test: 'health_check_error',
      'processor.operation': 'health_check',
      'error.type': 'timeout',
    },
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
    breadcrumbs: [
      {
        timestamp: Date.now() / 1000,
        category: 'processor',
        message: 'Health check initiated',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'processor',
        message: 'Calling health check API',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'processor',
        message: 'Health check timeout',
        level: 'error',
      },
    ],
  };
  await sendEvent(event, 'Test 6: Health Check Error');
}

// Test 7: Checkout Error
async function test7Checkout() {
  const event = {
    event_id: require('crypto').randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    sdk: { name: 'test-script', version: '1.0.0' },
    exception: {
      values: [{
        type: 'DatabaseError',
        value: 'TEST: Failed to create sale - Database connection timeout',
        stacktrace: {
          frames: [
            {
              filename: 'POSCheckout.tsx',
              function: 'handleCheckout',
              lineno: 340,
            }
          ]
        }
      }]
    },
    level: 'error',
    tags: {
      test: 'checkout_error',
      'checkout.operation': 'create_sale',
      'payment.method': 'credit',
    },
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
    breadcrumbs: [
      {
        timestamp: Date.now() / 1000,
        category: 'checkout',
        message: 'Starting checkout process',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'checkout',
        message: 'Validating payment data',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'checkout',
        message: 'Calling create_pos_sale RPC',
        level: 'info',
      },
      {
        timestamp: Date.now() / 1000,
        category: 'checkout',
        message: 'RPC error creating sale',
        level: 'error',
      },
    ],
  };
  await sendEvent(event, 'Test 7: Checkout Error');
}

// Run all tests sequentially
async function runAllTests() {
  try {
    await test1ErrorCapture();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test2Breadcrumbs();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test3Context();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test4Performance();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test5PaymentError();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test6HealthCheck();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test7Checkout();

    console.log('\n✅ SUCCESS! All 7 test events sent to Sentry\n');
    console.log('📊 Check your dashboard:');
    console.log('   https://sentry.io/organizations/whaletools/issues/\n');
    console.log('You should see 7 new test events:');
    console.log('   1. TEST: Sentry error capture verification');
    console.log('   2. TEST: Breadcrumb trail verification');
    console.log('   3. TEST: Context data verification');
    console.log('   4. TEST: Performance tracking verification');
    console.log('   5. TEST: Payment timeout error');
    console.log('   6. TEST: Processor health check timeout');
    console.log('   7. TEST: Failed to create sale - Database timeout\n');
    console.log('⏰ Events can take 10-30 seconds to appear. Refresh your browser!\n');
  } catch (error) {
    console.error('\n❌ Some tests failed. Check errors above.\n');
    process.exit(1);
  }
}

runAllTests();
