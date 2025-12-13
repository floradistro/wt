#!/usr/bin/env node
/**
 * Fix Loyalty Points Bug - DEEP Analysis & Correction Script
 *
 * Problem: The POS was valuing points at $0.01 (default fallback) instead of $0.05 (configured value)
 * because it was reading from the wrong store.
 *
 * This script:
 * 1. Finds ALL orders where loyalty points were redeemed (last 60 days)
 * 2. Analyzes each order to determine what point value was used
 * 3. Reports the difference owed to each customer
 * 4. Generates SQL to refund as points
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- EXPO_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function analyzeAffectedOrders() {
  console.log('\n🔍 DEEP ANALYSIS: All orders with loyalty point redemptions (last 60 days)...\n')

  // Get the configured point value from loyalty_programs
  const { data: loyaltyProgram, error: programError } = await supabase
    .from('loyalty_programs')
    .select('point_value, vendor_id, created_at, updated_at')
    .eq('is_active', true)
    .single()

  if (programError) {
    console.error('Error fetching loyalty program:', programError)
    return
  }

  const correctPointValue = loyaltyProgram.point_value
  const wrongPointValue = 0.01 // The bug was using this fallback

  console.log(`📊 Loyalty Program Configuration:`)
  console.log(`   Correct point value: $${correctPointValue.toFixed(2)} per point`)
  console.log(`   Bug was using: $${wrongPointValue.toFixed(2)} per point (${correctPointValue / wrongPointValue}x less!)`)
  console.log(`   Program last updated: ${loyaltyProgram.updated_at}`)
  console.log()

  // Calculate date 60 days ago
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  // Find ALL orders in the last 60 days - we'll filter in JS for better analysis
  let allOrders = []
  let page = 0
  const pageSize = 1000

  console.log('📥 Fetching all orders from last 60 days...')

  while (true) {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        metadata,
        total_amount,
        subtotal,
        discount_amount,
        customer_id,
        order_type,
        customers (
          id,
          first_name,
          last_name,
          email,
          loyalty_points
        )
      `)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return
    }

    if (!orders || orders.length === 0) break

    allOrders = allOrders.concat(orders)
    console.log(`   Fetched ${allOrders.length} orders so far...`)

    if (orders.length < pageSize) break
    page++
  }

  console.log(`\n📊 Total orders in last 60 days: ${allOrders.length}`)

  // Filter to orders with loyalty redemptions
  const ordersWithLoyalty = allOrders.filter(o => {
    const points = o.metadata?.loyalty_points_redeemed
    return points && points > 0
  })

  console.log(`📊 Orders with loyalty points redeemed: ${ordersWithLoyalty.length}\n`)

  if (ordersWithLoyalty.length === 0) {
    console.log('✅ No orders found with loyalty point redemptions.')
    return
  }

  // Analyze point values used
  const pointValueAnalysis = {
    correctValue: 0,
    wrongValue: 0,
    otherValue: 0,
    zeroDiscount: 0,
  }

  const orders = ordersWithLoyalty

  // Analyze each order
  let totalAffectedOrders = 0
  let totalOwed = 0
  let totalPointsRedeemed = 0
  const affectedCustomers = new Map()
  const ordersByPointValue = []

  // First pass: categorize all orders
  for (const order of orders) {
    const pointsRedeemed = order.metadata?.loyalty_points_redeemed || 0
    const discountGiven = order.metadata?.loyalty_discount_amount || 0

    if (pointsRedeemed === 0) continue

    totalPointsRedeemed += pointsRedeemed
    const actualPointValue = discountGiven / pointsRedeemed

    ordersByPointValue.push({
      order,
      pointsRedeemed,
      discountGiven,
      actualPointValue,
      correctDiscount: pointsRedeemed * correctPointValue
    })

    if (discountGiven === 0) {
      pointValueAnalysis.zeroDiscount++
    } else if (Math.abs(actualPointValue - correctPointValue) < 0.001) {
      pointValueAnalysis.correctValue++
    } else if (Math.abs(actualPointValue - wrongPointValue) < 0.001) {
      pointValueAnalysis.wrongValue++
    } else {
      pointValueAnalysis.otherValue++
    }
  }

  // Print analysis summary
  console.log('📊 POINT VALUE ANALYSIS:')
  console.log('─'.repeat(60))
  console.log(`   Orders using CORRECT value ($${correctPointValue.toFixed(2)}): ${pointValueAnalysis.correctValue}`)
  console.log(`   Orders using WRONG value ($${wrongPointValue.toFixed(2)}): ${pointValueAnalysis.wrongValue}`)
  console.log(`   Orders with $0 discount (bug?): ${pointValueAnalysis.zeroDiscount}`)
  console.log(`   Orders using OTHER values: ${pointValueAnalysis.otherValue}`)
  console.log(`   Total points redeemed: ${totalPointsRedeemed.toLocaleString()}`)
  console.log()

  // Show sample of "other" values if any
  if (pointValueAnalysis.otherValue > 0) {
    console.log('⚠️  ORDERS WITH UNEXPECTED POINT VALUES:')
    const otherOrders = ordersByPointValue.filter(o => {
      if (o.discountGiven === 0) return false
      return Math.abs(o.actualPointValue - correctPointValue) >= 0.001 &&
             Math.abs(o.actualPointValue - wrongPointValue) >= 0.001
    }).slice(0, 10)

    for (const o of otherOrders) {
      console.log(`   Order ${o.order.order_number}: ${o.pointsRedeemed} pts @ $${o.actualPointValue.toFixed(4)}/pt = $${o.discountGiven.toFixed(2)}`)
    }
    console.log()
  }

  console.log('─'.repeat(100))
  console.log('AFFECTED ORDERS (using $0.01 instead of $0.05):')
  console.log('─'.repeat(100))
  console.log('Order #       | Date       | Customer           | Points | Discount Given | Should Be | Owed')
  console.log('─'.repeat(100))

  for (const { order, pointsRedeemed, discountGiven, actualPointValue, correctDiscount } of ordersByPointValue) {
    // Include orders with wrong value OR zero discount (both are bugs)
    const isWrongValue = Math.abs(actualPointValue - wrongPointValue) < 0.001
    const isZeroDiscount = discountGiven === 0 && pointsRedeemed > 0

    if (isWrongValue || isZeroDiscount) {
      const owed = correctDiscount - discountGiven
      totalAffectedOrders++
      totalOwed += owed

      const customer = order.customers
      if (!customer) continue // Skip orders without customer (shouldn't happen with loyalty redemptions)
      const customerKey = order.customer_id

      if (!affectedCustomers.has(customerKey)) {
        affectedCustomers.set(customerKey, {
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          email: customer.email,
          currentPoints: customer.loyalty_points,
          ordersAffected: 0,
          totalOwed: 0,
          orders: []
        })
      }

      const customerRecord = affectedCustomers.get(customerKey)
      customerRecord.ordersAffected++
      customerRecord.totalOwed += owed
      customerRecord.orders.push({
        orderNumber: order.order_number,
        date: new Date(order.created_at).toLocaleDateString(),
        pointsRedeemed,
        discountGiven,
        correctDiscount,
        owed
      })

      const customerName = `${customer.first_name} ${customer.last_name}`.slice(0, 18)
      console.log(
        `${order.order_number.toString().padEnd(13)} | ` +
        `${new Date(order.created_at).toLocaleDateString().padEnd(10)} | ` +
        `${customerName.padEnd(18)} | ` +
        `${pointsRedeemed.toString().padStart(6)} | ` +
        `$${discountGiven.toFixed(2).padStart(13)} | ` +
        `$${correctDiscount.toFixed(2).padStart(8)} | ` +
        `$${owed.toFixed(2).padStart(5)}`
      )
    }
  }

  console.log('─'.repeat(100))
  console.log()

  // Summary
  console.log('📈 SUMMARY')
  console.log('─'.repeat(50))
  console.log(`Total orders affected: ${totalAffectedOrders}`)
  console.log(`Total customers affected: ${affectedCustomers.size}`)
  console.log(`Total amount owed to customers: $${totalOwed.toFixed(2)}`)
  console.log()

  // Per-customer breakdown
  if (affectedCustomers.size > 0) {
    console.log('📋 AFFECTED CUSTOMERS (sorted by amount owed)')
    console.log('─'.repeat(80))

    const sortedCustomers = [...affectedCustomers.values()]
      .sort((a, b) => b.totalOwed - a.totalOwed)

    for (const customer of sortedCustomers) {
      console.log(`\n${customer.name} (${customer.email})`)
      console.log(`   Orders affected: ${customer.ordersAffected}`)
      console.log(`   Total owed: $${customer.totalOwed.toFixed(2)}`)
      console.log(`   Current points balance: ${customer.currentPoints}`)

      // Option: Refund as points (owed / correctPointValue)
      const pointsToRefund = Math.ceil(customer.totalOwed / correctPointValue)
      console.log(`   Refund option: Add ${pointsToRefund} points to their account`)
    }

    // Generate SQL for fixing
    console.log('\n\n📝 SQL TO REFUND AS POINTS:')
    console.log('─'.repeat(80))
    console.log('-- Run these statements to credit affected customers with bonus points\n')

    for (const customer of sortedCustomers) {
      const pointsToRefund = Math.ceil(customer.totalOwed / correctPointValue)
      console.log(`-- ${customer.name}: $${customer.totalOwed.toFixed(2)} owed = ${pointsToRefund} points`)
      console.log(`UPDATE customers SET loyalty_points = loyalty_points + ${pointsToRefund} WHERE id = '${customer.id}';`)
      console.log()
    }
  }

  return { affectedCustomers, totalOwed, totalAffectedOrders }
}

// Run the analysis
analyzeAffectedOrders()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
