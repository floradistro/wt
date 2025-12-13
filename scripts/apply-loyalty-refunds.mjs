#!/usr/bin/env node
/**
 * Apply Loyalty Points Refunds
 * Credits affected customers with bonus points to compensate for the $0.01 bug
 */

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// All affected customers with points to credit
const refunds = [
  { id: '2bb49320-cb0f-4993-af0f-ac1836b3174c', name: 'Elijah Zachary Davis', owed: 75.44, points: 1509 },
  { id: 'bc72edd5-cfbc-4139-b53e-ee4edfba56ff', name: 'Avery Graves', owed: 55.36, points: 1108 },
  { id: '22af7b4e-8a86-4f69-a457-cc8c2b15437b', name: 'Mark Hutchins', owed: 44.64, points: 893 },
  { id: '07aa7caf-5ef4-4ee3-a6f3-90b8d3d315b5', name: 'Dawson Burris', owed: 40.00, points: 800 },
  { id: 'b96d61aa-346b-47d1-bf35-50350e6f4b35', name: 'Dawson Albright', owed: 31.28, points: 626 },
  { id: '359d540d-9f5b-4837-96d2-a5e0e893561e', name: 'Kenedi Walker', owed: 24.04, points: 481 },
  { id: 'fcbd4fd9-2f73-4b56-abf1-a81ac7d5da93', name: 'ALEXANDER PAGE', owed: 22.40, points: 448 },
  { id: '2bc53666-bd51-4bbb-9262-e1f605938f50', name: 'Briana Combs', owed: 21.04, points: 421 },
  { id: '130346cb-b2a1-4d85-b448-916878268f63', name: 'Terrance Josey', owed: 20.00, points: 400 },
  { id: 'edd3f8d1-1842-452a-9677-897de4e903a0', name: 'Lauren Hicklin', owed: 17.24, points: 345 },
  { id: '5c74fb00-d8e6-41fc-8d10-543b86e32df1', name: 'Josh Thompson', owed: 16.68, points: 334 },
  { id: 'e27322b7-3dae-4d85-9194-a71b4cc0778a', name: 'Damon Rhone', owed: 16.16, points: 324 },
  { id: '4b6100b7-fa00-410b-aea6-68eba2f6f259', name: 'Katreena Rodriguez', owed: 15.12, points: 303 },
  { id: '32103c24-ffc4-46eb-8a48-185f5b999e8c', name: 'Peyton Ford', owed: 14.00, points: 280 },
  { id: 'd760724e-2a56-49af-9c0a-8e1cce3a8faf', name: 'Lisa Morsett', owed: 12.92, points: 259 },
  { id: 'cd2f362a-51ab-4a98-96ed-6bd773b2527f', name: 'Jerome Singleton', owed: 12.20, points: 244 },
  { id: '66de79bf-c4f8-4120-89c5-15eef3ca80cd', name: 'Thomas Sykes', owed: 11.76, points: 236 },
  { id: '6ec1e9b4-afcc-4d60-88c1-e20f6a462565', name: 'Quiana Whitfield', owed: 11.44, points: 229 },
  { id: 'f80bf8ca-e5cc-4904-a11c-968d4e5ba779', name: 'Sylvester Jones', owed: 10.72, points: 215 },
  { id: '4288aaea-8d17-4432-a41d-2b40539a4b65', name: 'Christopher Rich', owed: 10.40, points: 208 },
  { id: '10b388fb-a257-40a1-874e-8882747aca24', name: 'Alexander Page', owed: 10.08, points: 202 },
  { id: '8fc2d7b9-2d90-4001-9f5e-6303ed060cd7', name: 'Howze Dewaun', owed: 10.04, points: 201 },
  { id: '6178b330-0bc5-4b03-8e57-a836b229f214', name: 'Benjamin Poole', owed: 9.36, points: 188 },
  { id: '9ed84577-3751-4dcb-99ef-89a8a45d5639', name: 'J Turner Braren', owed: 8.84, points: 177 },
  { id: 'e504353d-b225-44b1-8d38-00035294c185', name: 'Alexis Eudy', owed: 8.84, points: 177 },
  { id: '8a5970b8-1706-42d8-8433-ef45948b148f', name: 'Diquan Baker', owed: 8.16, points: 164 },
  { id: '7da65ce4-a2d5-41fb-b1e3-c766b1a96796', name: 'Steven Haynes', owed: 7.56, points: 152 },
  { id: '7d0e88d7-f290-4aaa-9bed-61b789eba9e9', name: 'Alicia Reid', owed: 5.56, points: 112 },
  { id: '2d1ffa85-9a7d-4911-9e40-7d266e3685ff', name: 'Kendra Sharp', owed: 5.44, points: 109 },
  { id: 'fc95a17c-c9be-42f0-aff2-03b1f36a26ec', name: 'GEORGIANA FERRELL', owed: 5.44, points: 109 },
  { id: '78a0177e-4295-4b5c-9ae9-aad70aa7b7d8', name: 'Steven Levine', owed: 5.04, points: 101 },
  { id: '62bc32ba-48f1-4c2f-af04-0f29a01dcd90', name: 'Tyrone Williams', owed: 4.96, points: 100 },
  { id: '1fbed6ee-481b-45f4-b438-78118add1f56', name: 'Naia Harwood', owed: 4.80, points: 96 },
  { id: '07dd7185-0236-4f39-8832-fcb616a557dc', name: 'William Lee', owed: 4.64, points: 93 },
  { id: '14d4e51f-814d-4dab-abb1-36e1b2c8c466', name: "Ya' Keem Knox", owed: 4.44, points: 89 },
  { id: '7b607cad-a8de-4948-ba26-fe324628c124', name: 'Lovettice Smith', owed: 3.12, points: 63 },
  { id: '521c1ec3-b811-456f-b123-f2be65d74a02', name: 'Keith Hoist', owed: 3.00, points: 60 },
  { id: 'e1e02d9c-fd5b-4cd1-b37d-fe0ebdb78a02', name: 'Jessica Castillo', owed: 2.32, points: 47 },
  { id: 'a9b35fbc-bf3f-4616-b40c-86fdf4b9843b', name: 'Bryce Hoff', owed: 2.04, points: 41 },
  { id: 'eb98f012-a43a-4227-8027-1e99192b77e3', name: 'SUMMER BALL', owed: 1.68, points: 34 },
  { id: 'faee0196-6557-4cd4-bed0-e803aefb9a52', name: 'Jakob Rodgers', owed: 1.36, points: 28 },
  { id: 'f965580e-0a45-4a50-a1f2-967148c98224', name: 'MATTHEW VIEKE', owed: 1.36, points: 28 },
  { id: 'e09b2617-1e92-4aa2-b9cb-d42362893f87', name: 'Greenlee Medlin', owed: 1.16, points: 24 },
  { id: '24f66cf7-0a1a-4011-8660-92ef7ff49570', name: 'Keith Hoist (walk-in)', owed: 1.12, points: 23 },
  { id: '6c362218-b090-40d7-aaeb-09557074809e', name: 'Calvin Cappell', owed: 1.00, points: 20 },
  { id: '05f095fa-c7ac-4eb2-a92a-cc26b2373a3f', name: 'Samuel Tamayo albarran', owed: 0.56, points: 12 },
]

async function applyRefunds() {
  console.log('\n💰 APPLYING LOYALTY POINT REFUNDS\n')
  console.log('─'.repeat(80))

  let successCount = 0
  let failCount = 0
  let totalPointsCredited = 0

  for (const refund of refunds) {
    // Get current balance first
    const { data: before, error: readError } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', refund.id)
      .single()

    if (readError) {
      console.log(`❌ ${refund.name}: Failed to read - ${readError.message}`)
      failCount++
      continue
    }

    const beforePoints = before.loyalty_points || 0

    // Apply the credit
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        loyalty_points: beforePoints + refund.points,
        updated_at: new Date().toISOString()
      })
      .eq('id', refund.id)

    if (updateError) {
      console.log(`❌ ${refund.name}: Failed to update - ${updateError.message}`)
      failCount++
      continue
    }

    const afterPoints = beforePoints + refund.points
    console.log(`✅ ${refund.name.padEnd(25)} | +${refund.points.toString().padStart(4)} pts | $${refund.owed.toFixed(2).padStart(5)} owed | ${beforePoints} → ${afterPoints} pts`)
    successCount++
    totalPointsCredited += refund.points
  }

  console.log('─'.repeat(80))
  console.log(`\n📊 SUMMARY:`)
  console.log(`   ✅ Successfully credited: ${successCount} customers`)
  console.log(`   ❌ Failed: ${failCount} customers`)
  console.log(`   💎 Total points credited: ${totalPointsCredited.toLocaleString()}`)
  console.log(`   💵 Total value: $${(totalPointsCredited * 0.05).toFixed(2)}`)
  console.log()
}

applyRefunds()
  .then(() => {
    console.log('✨ Refund process complete!\n')
    process.exit(0)
  })
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
