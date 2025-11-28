#!/usr/bin/env node
/**
 * Test checkout Edge Function to debug the error
 * Run with: node test-checkout.js
 */

const SUPABASE_URL = 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTcyMzMsImV4cCI6MjA3NjU3MzIzM30.N8jPwlyCBB5KJB5I-XaK6m-mq88rSR445AWFJJmwRCg'

// You need to get a real JWT token by logging in
// For now, this will help us see if we can reach the function
const TEST_JWT = process.argv[2] || ''

if (!TEST_JWT) {
  console.error('Usage: node test-checkout.js <JWT_TOKEN>')
  console.error('Get your JWT from localStorage in the browser DevTools:')
  console.error('  localStorage.getItem("supabase.auth.token")')
  process.exit(1)
}

const testPayload = {
  vendorId: 'test-vendor-id',
  locationId: 'test-location-id',
  registerId: 'test-register-id',
  sessionId: 'test-session-id',
  items: [
    {
      productId: 'test-product-1',
      productName: 'Test Product',
      productSku: 'TEST-001',
      quantity: 1,
      unitPrice: 10.00,
      lineTotal: 10.00,
      gramsToDeduct: 1,
      tierName: '1 Unit'
    }
  ],
  subtotal: 10.00,
  taxAmount: 1.00,
  total: 11.00,
  paymentMethod: 'cash',
  customerName: 'Test Customer'
}

async function testCheckout() {
  console.log('🧪 Testing process-checkout Edge Function...\n')
  console.log('URL:', `${SUPABASE_URL}/functions/v1/process-checkout`)
  console.log('Payload:', JSON.stringify(testPayload, null, 2))
  console.log('\nSending request...\n')

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_JWT}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(testPayload)
    })

    console.log('Response Status:', response.status, response.statusText)
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()))

    const text = await response.text()
    console.log('\nResponse Body (raw):', text)

    try {
      const json = JSON.parse(text)
      console.log('\nResponse Body (parsed):')
      console.log(JSON.stringify(json, null, 2))
    } catch (e) {
      console.log('\n❌ Response is not valid JSON')
    }

    if (!response.ok) {
      console.log('\n❌ Request failed!')
      process.exit(1)
    }

    console.log('\n✅ Request succeeded!')
  } catch (error) {
    console.error('\n💥 Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

testCheckout()
