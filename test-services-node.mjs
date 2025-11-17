/**
 * Service Integration Tests (Node.js)
 *
 * Tests all Supabase services using direct database queries.
 * Run with: node test-services-node.mjs
 */

import { createClient } from '@supabase/supabase-js'

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uaednwpxursknmwdeejn.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

// Use service role for testing (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Test vendor ID
const TEST_VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

const results = []

function logTest(name, passed, message, error) {
  results.push({ name, passed, message, error })
  const icon = passed ? '' : 'L'
  console.log(`${icon} ${name}: ${message}`)
  if (error) {
    console.error('  Error:', error.message || error)
  }
}

async function testLoyaltyService() {
  console.log('\n=5 Testing Loyalty Service...\n')

  try {
    // Test: Get loyalty program
    const { data: program, error } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('vendor_id', TEST_VENDOR_ID)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (program) {
      logTest(
        'Get Loyalty Program',
        true,
        `Found program: "${program.name}" (${program.points_per_dollar} pts/$)`
      )
      console.log('  Program details:', {
        id: program.id,
        name: program.name,
        point_value: program.point_value,
        points_per_dollar: program.points_per_dollar,
        is_active: program.is_active,
      })

      // Test: Calculate points to earn
      const pointsToEarn = Math.floor(100 * program.points_per_dollar)
      logTest('Calculate Points to Earn', pointsToEarn > 0, `$100 order = ${pointsToEarn} points`)

      // Test: Calculate loyalty discount
      const discount = 100 * program.point_value
      logTest('Calculate Loyalty Discount', discount > 0, `100 points = $${discount.toFixed(2)} discount`)

      // Test: Calculate max redeemable
      const maxPoints = Math.min(200, Math.floor(50 / program.point_value))
      logTest('Calculate Max Redeemable', maxPoints >= 0, `$50 subtotal, 200 pts available = ${maxPoints} max redeemable`)
    } else {
      logTest('Get Loyalty Program', false, 'No loyalty program found')
    }
  } catch (error) {
    logTest('Loyalty Service', false, 'Failed', error)
  }
}

async function testCustomersService() {
  console.log('\n=5 Testing Customers Service...\n')

  try {
    // Test: Get customers
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    logTest('Get Customers', customers.length > 0, `Found ${customers.length} customers`)
    if (customers.length > 0) {
      console.log('  Sample customer:', {
        id: customers[0].id,
        email: customers[0].email,
        first_name: customers[0].first_name,
        last_name: customers[0].last_name,
        loyalty_points: customers[0].loyalty_points,
        total_spent: customers[0].total_spent,
      })
    }

    // Test: Search customers
    if (customers.length > 0 && customers[0].first_name) {
      const { data: searchResults } = await supabase
        .from('customers')
        .select('*')
        .or(`email.ilike.%${customers[0].first_name.substring(0, 3)}%,first_name.ilike.%${customers[0].first_name.substring(0, 3)}%`)
        .limit(20)

      logTest('Search Customers', searchResults.length > 0, `Search found ${searchResults.length} customers`)
    }

    // Test: Get customer by ID
    if (customers.length > 0) {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customers[0].id)
        .single()

      logTest('Get Customer by ID', !!customer, `Retrieved customer: ${customer.email}`)
    }

    // Test: Get customer with orders
    if (customers.length > 0) {
      const { data: customerWithOrders } = await supabase
        .from('customers')
        .select(`
          *,
          orders!customer_id (
            id,
            order_number,
            total_amount,
            created_at
          )
        `)
        .eq('id', customers[0].id)
        .single()

      logTest('Get Customer with Orders', !!customerWithOrders, `Found ${customerWithOrders.orders?.length || 0} orders`)
    }

    // Test: Get top customers
    const { data: topCustomers } = await supabase
      .from('customers')
      .select('*')
      .order('total_spent', { ascending: false })
      .limit(5)

    logTest('Get Top Customers', topCustomers.length > 0, `Found ${topCustomers.length} top customers`)
    if (topCustomers.length > 0) {
      console.log('  Top customer:', {
        email: topCustomers[0].email,
        total_spent: topCustomers[0].total_spent,
        total_orders: topCustomers[0].total_orders,
      })
    }
  } catch (error) {
    logTest('Customers Service', false, 'Failed', error)
  }
}

async function testProductsService() {
  console.log('\n=5 Testing Products Service...\n')

  try {
    // Test: Get products
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'published')
      .order('name', { ascending: true })
      .limit(5)

    if (error) throw error

    logTest('Get Products', products.length > 0, `Found ${products.length} products`)
    if (products.length > 0) {
      console.log('  Sample product:', {
        id: products[0].id,
        name: products[0].name,
        sku: products[0].sku,
        price: products[0].price,
        status: products[0].status,
      })
    }

    // Test: Search products
    if (products.length > 0) {
      const { data: searchResults } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${products[0].name.substring(0, 3)}%,sku.ilike.%${products[0].name.substring(0, 3)}%`)
        .eq('status', 'published')
        .limit(20)

      logTest('Search Products', searchResults.length > 0, `Search found ${searchResults.length} products`)
    }

    // Test: Get product by ID
    if (products.length > 0) {
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', products[0].id)
        .single()

      logTest('Get Product by ID', !!product, `Retrieved product: ${product.name}`)
    }
  } catch (error) {
    logTest('Products Service', false, 'Failed', error)
  }
}

async function testOrdersService() {
  console.log('\n=5 Testing Orders Service...\n')

  try {
    // Test: Get orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    logTest('Get Orders', orders.length > 0, `Found ${orders.length} orders`)
    if (orders.length > 0) {
      console.log('  Sample order:', {
        id: orders[0].id,
        order_number: orders[0].order_number,
        status: orders[0].status,
        payment_status: orders[0].payment_status,
        total_amount: orders[0].total_amount,
        created_at: orders[0].created_at,
      })
    }

    // Test: Get today's orders
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: todaysOrders } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    logTest('Get Today\'s Orders', todaysOrders.length >= 0, `Found ${todaysOrders.length} orders today`)

    // Test: Get order by ID (with items)
    if (orders.length > 0) {
      const { data: order } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('id', orders[0].id)
        .single()

      logTest('Get Order by ID', !!order, `Retrieved order with ${order.order_items?.length || 0} items`)
    }

    // Test: Search orders
    if (orders.length > 0) {
      const { data: searchResults } = await supabase
        .from('orders')
        .select('*')
        .or(`order_number.ilike.%${orders[0].order_number}%`)
        .limit(20)

      logTest('Search Orders', searchResults.length > 0, `Search found order: ${orders[0].order_number}`)
    }
  } catch (error) {
    logTest('Orders Service', false, 'Failed', error)
  }
}

async function runAllTests() {
  console.log('=� Starting Service Integration Tests...')
  console.log('Testing against vendor:', TEST_VENDOR_ID)
  console.log('Supabase URL:', SUPABASE_URL)
  console.log('='.repeat(60))

  await testLoyaltyService()
  await testCustomersService()
  await testProductsService()
  await testOrdersService()

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('=� TEST SUMMARY')
  console.log('='.repeat(60))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  console.log(`\nTotal Tests: ${total}`)
  console.log(` Passed: ${passed}`)
  console.log(`L Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)

  if (failed > 0) {
    console.log('\n�  Failed Tests:')
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.message}`)
      })
  }

  console.log('\n' + '='.repeat(60))
  console.log(failed === 0 ? ' ALL TESTS PASSED!' : 'L SOME TESTS FAILED')
  console.log('='.repeat(60))

  process.exit(failed > 0 ? 1 : 0)
}

// Run tests
runAllTests().catch((error) => {
  console.error('L Test runner failed:', error)
  process.exit(1)
})
