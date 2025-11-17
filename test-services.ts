/**
 * Service Integration Tests
 *
 * Tests all Supabase services to ensure they work correctly.
 * Run with: npx tsx test-services.ts
 */

import { loyaltyService } from './src/services/loyalty.service'
import { ordersService } from './src/services/orders.service'
import { productsService } from './src/services/products.service'
import { customersService } from './src/services/customers.service'

// Test vendor ID from database
const TEST_VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

interface TestResult {
  name: string
  passed: boolean
  message: string
  error?: any
}

const results: TestResult[] = []

function logTest(name: string, passed: boolean, message: string, error?: any) {
  results.push({ name, passed, message, error })
  const icon = passed ? '' : 'L'
  console.log(`${icon} ${name}: ${message}`)
  if (error) {
    console.error('  Error:', error)
  }
}

async function testLoyaltyService() {
  console.log('\n=5 Testing Loyalty Service...\n')

  try {
    // Test: Get loyalty program
    const program = await loyaltyService.getLoyaltyProgram(TEST_VENDOR_ID)
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
    } else {
      logTest('Get Loyalty Program', false, 'No loyalty program found')
    }

    // Test: Calculate points to earn
    const pointsToEarn = loyaltyService.calculatePointsToEarn(100, program)
    logTest(
      'Calculate Points to Earn',
      pointsToEarn > 0,
      `$100 order = ${pointsToEarn} points`
    )

    // Test: Calculate loyalty discount
    const discount = loyaltyService.calculateLoyaltyDiscount(100, program)
    logTest(
      'Calculate Loyalty Discount',
      discount > 0,
      `100 points = $${discount.toFixed(2)} discount`
    )

    // Test: Calculate max redeemable
    const maxPoints = loyaltyService.calculateMaxRedeemablePoints(50, 200, program)
    logTest(
      'Calculate Max Redeemable',
      maxPoints >= 0,
      `$50 subtotal, 200 pts available = ${maxPoints} max redeemable`
    )
  } catch (error) {
    logTest('Loyalty Service', false, 'Failed', error)
  }
}

async function testCustomersService() {
  console.log('\n=5 Testing Customers Service...\n')

  try {
    // Test: Get customers
    const customers = await customersService.getCustomers({ limit: 5 })
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
      const searchResults = await customersService.searchCustomers(
        customers[0].first_name.substring(0, 3)
      )
      logTest(
        'Search Customers',
        searchResults.length > 0,
        `Search found ${searchResults.length} customers`
      )
    }

    // Test: Get customer by ID
    if (customers.length > 0) {
      const customer = await customersService.getCustomerById(customers[0].id)
      logTest('Get Customer by ID', !!customer, `Retrieved customer: ${customer.email}`)
    }

    // Test: Get customer with orders
    if (customers.length > 0) {
      const customerWithOrders = await customersService.getCustomerWithOrders(
        customers[0].id
      )
      logTest(
        'Get Customer with Orders',
        !!customerWithOrders,
        `Found ${customerWithOrders.recent_orders?.length || 0} recent orders`
      )
    }

    // Test: Get top customers
    const topCustomers = await customersService.getTopCustomers(5)
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
    const products = await productsService.getProducts({ limit: 5, isActive: true })
    logTest('Get Products', products.length > 0, `Found ${products.length} products`)
    if (products.length > 0) {
      console.log('  Sample product:', {
        id: products[0].id,
        name: products[0].name,
        sku: products[0].sku,
        barcode: products[0].barcode,
        price: products[0].price,
        is_active: products[0].is_active,
      })
    }

    // Test: Search products
    if (products.length > 0) {
      const searchResults = await productsService.searchProducts(
        products[0].name.substring(0, 3)
      )
      logTest('Search Products', searchResults.length > 0, `Search found ${searchResults.length} products`)
    }

    // Test: Get product by ID
    if (products.length > 0) {
      const product = await productsService.getProductById(products[0].id)
      logTest('Get Product by ID', !!product, `Retrieved product: ${product.name}`)
    }

    // Test: Get product by barcode (if available)
    const productWithBarcode = products.find((p) => p.barcode)
    if (productWithBarcode && productWithBarcode.barcode) {
      const product = await productsService.getProductByBarcode(productWithBarcode.barcode)
      logTest(
        'Get Product by Barcode',
        !!product,
        `Found product by barcode: ${productWithBarcode.barcode}`
      )
    } else {
      logTest('Get Product by Barcode', true, 'Skipped - no products with barcodes')
    }

    // Test: Get product by SKU (if available)
    const productWithSku = products.find((p) => p.sku)
    if (productWithSku && productWithSku.sku) {
      const product = await productsService.getProductBySku(productWithSku.sku)
      logTest('Get Product by SKU', !!product, `Found product by SKU: ${productWithSku.sku}`)
    } else {
      logTest('Get Product by SKU', true, 'Skipped - no products with SKUs')
    }
  } catch (error) {
    logTest('Products Service', false, 'Failed', error)
  }
}

async function testOrdersService() {
  console.log('\n=5 Testing Orders Service...\n')

  try {
    // Test: Get orders
    const orders = await ordersService.getOrders({ limit: 5 })
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
    const todaysOrders = await ordersService.getTodaysOrders()
    logTest('Get Today\'s Orders', todaysOrders.length >= 0, `Found ${todaysOrders.length} orders today`)

    // Test: Get order by ID (with items)
    if (orders.length > 0) {
      const order = await ordersService.getOrderById(orders[0].id)
      logTest(
        'Get Order by ID',
        !!order,
        `Retrieved order with ${order.items.length} items`
      )
      console.log('  Order items:', order.items.length)
    }

    // Test: Search orders
    if (orders.length > 0) {
      const searchResults = await ordersService.searchOrders(orders[0].order_number)
      logTest(
        'Search Orders',
        searchResults.length > 0,
        `Search found order: ${orders[0].order_number}`
      )
    }
  } catch (error) {
    logTest('Orders Service', false, 'Failed', error)
  }
}

async function runAllTests() {
  console.log('=€ Starting Service Integration Tests...')
  console.log('Testing against vendor:', TEST_VENDOR_ID)
  console.log('=' .repeat(60))

  await testLoyaltyService()
  await testCustomersService()
  await testProductsService()
  await testOrdersService()

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('=Ê TEST SUMMARY')
  console.log('='.repeat(60))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  const total = results.length

  console.log(`\nTotal Tests: ${total}`)
  console.log(` Passed: ${passed}`)
  console.log(`L Failed: ${failed}`)
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)

  if (failed > 0) {
    console.log('\n   Failed Tests:')
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
