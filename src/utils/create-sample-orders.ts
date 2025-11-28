/**
 * Sample Orders Utility
 * Creates test orders using REAL customers and products from database
 */

import { supabase } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'

interface CreateSampleOrdersOptions {
  vendorId: string
  locationId?: string
}

/**
 * Generate a random order number for testing
 */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TEST-${timestamp}-${random}`
}

/**
 * Generate fake customer data for testing
 */
function generateFakeCustomers(count: number) {
  const firstNames = ['John', 'Sarah', 'Michael', 'Jessica', 'David', 'Emily', 'James', 'Ashley', 'Robert', 'Amanda', 'William', 'Jennifer', 'Richard', 'Lisa', 'Thomas']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore']
  const cities = ['Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Seattle', 'Denver', 'Portland', 'Miami', 'Atlanta']
  const states = ['CA', 'NY', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'TX', 'WA', 'CO', 'OR', 'FL', 'GA']
  const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Park Pl', 'Washington Blvd', 'Lincoln Way', 'Broadway', 'Market St', 'Pine St', 'Cedar Ln']

  return Array.from({ length: count }, (_, i) => {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const cityIndex = Math.floor(Math.random() * cities.length)

    return {
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `555-${Math.floor(1000 + Math.random() * 9000)}`,
      address_line1: `${Math.floor(100 + Math.random() * 9900)} ${streets[Math.floor(Math.random() * streets.length)]}`,
      address_line2: Math.random() > 0.7 ? `Apt ${Math.floor(1 + Math.random() * 99)}` : null,
      city: cities[cityIndex],
      state: states[cityIndex],
      zip: `${Math.floor(10000 + Math.random() * 90000)}`,
    }
  })
}

/**
 * Create sample pickup orders using real customers and products
 */
export async function createSamplePickupOrders(options: CreateSampleOrdersOptions) {
  const { vendorId, locationId } = options

  try {
    logger.info('[SampleOrders] Creating sample pickup orders', {
      vendorId,
      locationId
    })

    // Generate fake customer data for testing
    const selectedCustomers = generateFakeCustomers(4)

    // Fetch real products for order items (products are vendor-level, not location-level)
    const { data: products, error: productsError} = await supabase
      .from('products')
      .select('id, name, price')
      .eq('vendor_id', vendorId)
      .limit(20)

    if (productsError) {
      logger.error('[SampleOrders] Database error fetching products:', productsError)
      throw productsError
    }

    if (!products || products.length === 0) {
      throw new Error('No products found. Please add products first.')
    }

    logger.info('[SampleOrders] Found products:', { count: products.length })

    // Create orders using real customer data
    const pickupOrders = selectedCustomers.map((customer, index) => {
      const customerName = `${customer.first_name} ${customer.last_name}`

      // Calculate totals based on random products
      const numItems = Math.floor(Math.random() * 3) + 1
      let subtotal = 0
      for (let i = 0; i < numItems && i < products.length; i++) {
        const qty = Math.floor(Math.random() * 3) + 1
        subtotal += (products[i].price || 10) * qty
      }

      const taxAmount = subtotal * 0.0675
      const totalAmount = subtotal + taxAmount

      return {
        order_number: generateOrderNumber(),
        vendor_id: vendorId,
        order_type: 'pickup' as const,
        delivery_type: 'pickup' as const,
        status: index === 3 ? 'completed' as const : 'pending' as const,
        payment_status: index === 0 ? 'pending' as const : 'paid' as const,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: ['credit_card', 'debit_card', 'apple_pay'][index % 3],
        pickup_location_id: locationId,
        customer_id: null,
        billing_address: {
          line1: customer.address_line1,
          line2: customer.address_line2,
          city: customer.city,
          state: customer.state,
          zip: customer.zip,
        },
        metadata: {
          customer_name: customerName,
          customer_email: customer.email,
          customer_phone: customer.phone,
          is_test_order: true,
          staff_notes: index === 3 ? 'Order completed and picked up' : 'New pickup order',
        },
      }
    })

    const { data, error } = await supabase
      .from('orders')
      .insert(pickupOrders)
      .select()

    if (error) {
      logger.error('[SampleOrders] Database error creating pickup orders:', error)
      throw error
    }

    logger.info('[SampleOrders] Created pickup orders successfully:', {
      count: data?.length,
      orderIds: data?.map(o => o.id)
    })

    console.log('[SampleOrders] Full order data:', data)

    // Add order items using real products
    if (data && data.length > 0 && products.length > 0) {
      const orderItems = []

      for (const order of data) {
        // Add 1-3 random products to each order
        const numItems = Math.floor(Math.random() * 3) + 1
        const shuffledProducts = [...products].sort(() => Math.random() - 0.5)

        for (let i = 0; i < numItems && i < shuffledProducts.length; i++) {
          const product = shuffledProducts[i]
          const quantity = Math.floor(Math.random() * 3) + 1
          const unitPrice = product.price || 10.00
          const subtotal = quantity * unitPrice
          const taxAmount = subtotal * 0.0675
          const total = subtotal + taxAmount

          orderItems.push({
            order_id: order.id,
            product_id: product.id,
            quantity,
            unit_price: unitPrice,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: 0,
            total,
          })
        }
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        logger.warn('[SampleOrders] Failed to create order items:', itemsError)
      } else {
        logger.info('[SampleOrders] Created order items:', orderItems.length)
      }
    }

    return { success: true, count: data?.length || 0 }
  } catch (err) {
    logger.error('[SampleOrders] Failed to create pickup orders:', err)
    throw err
  }
}

/**
 * Create sample e-commerce/shipping orders using real customers and products
 */
export async function createSampleECommerceOrders(options: CreateSampleOrdersOptions) {
  const { vendorId, locationId } = options

  try {
    logger.info('[SampleOrders] Creating sample e-commerce orders', {
      vendorId,
      locationId
    })

    // Generate fake customer data for testing
    const selectedCustomers = generateFakeCustomers(6)

    // Fetch real products for order items (products are vendor-level, not location-level)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('vendor_id', vendorId)
      .limit(20)

    if (productsError) {
      logger.error('[SampleOrders] Database error fetching products:', productsError)
      throw productsError
    }

    if (!products || products.length === 0) {
      throw new Error('No products found. Please add products first.')
    }

    logger.info('[SampleOrders] Found products:', { count: products.length })

    // Create orders using real customer data
    const shippingOrders = selectedCustomers.map((customer, index) => {
      const customerName = `${customer.first_name} ${customer.last_name}`

      // Calculate totals based on random products
      const numItems = Math.floor(Math.random() * 3) + 1
      let subtotal = 0
      for (let i = 0; i < numItems && i < products.length; i++) {
        const qty = Math.floor(Math.random() * 3) + 1
        subtotal += (products[i].price || 10) * qty
      }

      const taxAmount = subtotal * 0.0675
      const totalAmount = subtotal + taxAmount
      const isCompleted = index >= 4

      return {
        order_number: generateOrderNumber(),
        vendor_id: vendorId,
        order_type: 'shipping' as const,
        delivery_type: 'shipping' as const,
        status: isCompleted ? 'completed' as const : 'pending' as const,
        payment_status: index === 0 ? 'pending' as const : 'paid' as const,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: ['credit_card', 'paypal', 'apple_pay'][index % 3],
        pickup_location_id: locationId,
        customer_id: null,
        billing_address: {
          line1: customer.address_line1,
          line2: customer.address_line2,
          city: customer.city,
          state: customer.state,
          zip: customer.zip,
          country: 'US',
        },
        metadata: {
          customer_name: customerName,
          customer_email: customer.email,
          customer_phone: customer.phone,
          is_test_order: true,
          staff_notes: isCompleted ? 'Shipped and delivered' : 'New e-commerce order',
          tracking_number: isCompleted ? `1Z999AA10${Math.floor(Math.random() * 1000000000)}` : null,
          tracking_url: isCompleted ? 'https://www.ups.com/track' : null,
          shipping_carrier: isCompleted ? 'UPS' : null,
          shipping_service: isCompleted ? 'Ground' : null,
          shipping_cost: isCompleted ? 12.50 : null,
        },
      }
    })

    const { data, error } = await supabase
      .from('orders')
      .insert(shippingOrders)
      .select()

    if (error) {
      logger.error('[SampleOrders] Database error creating e-commerce orders:', error)
      throw error
    }

    logger.info('[SampleOrders] Created e-commerce orders successfully:', {
      count: data?.length,
      orderIds: data?.map(o => o.id)
    })

    console.log('[SampleOrders] Full e-commerce order data:', data)

    // Add order items using real products
    if (data && data.length > 0 && products.length > 0) {
      const orderItems = []

      for (const order of data) {
        // Add 1-3 random products to each order
        const numItems = Math.floor(Math.random() * 3) + 1
        const shuffledProducts = [...products].sort(() => Math.random() - 0.5)

        for (let i = 0; i < numItems && i < shuffledProducts.length; i++) {
          const product = shuffledProducts[i]
          const quantity = Math.floor(Math.random() * 3) + 1
          const unitPrice = product.price || 10.00
          const subtotal = quantity * unitPrice
          const taxAmount = subtotal * 0.0675
          const total = subtotal + taxAmount

          orderItems.push({
            order_id: order.id,
            product_id: product.id,
            quantity,
            unit_price: unitPrice,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: 0,
            total,
          })
        }
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        logger.warn('[SampleOrders] Failed to create order items:', itemsError)
      } else {
        logger.info('[SampleOrders] Created order items:', orderItems.length)
      }
    }

    return { success: true, count: data?.length || 0 }
  } catch (err) {
    logger.error('[SampleOrders] Failed to create e-commerce orders:', err)
    throw err
  }
}
