import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

// Moonwater beverage descriptions by ID (includes dosage-specific content)
const BEVERAGE_DESCRIPTIONS: Record<string, string> = {
  // BERRY TWIST
  'cf277f85-2276-45f7-ba6d-035b14281bff': // 60mg Riptide
    'Moonwater Riptide 60mg THC—for the experienced. Mixed berry medley with strawberry, blueberry, and raspberry in perfect harmony. All-natural flavors, pure THC, just 25 calories. This high-potency soda delivers serious effects for seasoned consumers. Start slow, even if you think you know your limits. Carbonated, refreshing, and powerfully effective.',

  '26ee237b-101a-4f0d-a2c6-814e41933eb2': // 10mg Golden Hour
    'Moonwater Golden Hour 10mg THC—the sweet spot. Mixed berry blend with natural strawberry, blueberry, and raspberry flavors. All-natural ingredients, pure THC, just 25 calories per can. Perfect for social situations or unwinding after work. Carbonated refreshment with balanced, predictable effects. The ideal moderate dose for consistent enjoyment.',

  '32048636-7f19-4e76-81d5-8754dd389106': // 30mg Darkside
    'Moonwater Darkside 30mg THC—elevated potency for experienced users. Mixed berry fusion with layered strawberry, blueberry, and raspberry notes. All-natural flavors, pure THC, just 25 calories. This stronger dose delivers pronounced effects—perfect for those who know their tolerance. Carbonated, delicious, and seriously effective.',

  // CAROLINA COLA
  '682813c0-2713-41e0-acd9-dff3abc47a99': // 60mg Riptide
    'Moonwater Riptide 60mg THC—maximum strength cola. Classic Southern cola flavor with vanilla and caramel notes, crafted with all-natural ingredients and pure THC. This high-potency soda is for experienced consumers only. Just 25 calories with serious effects. Nostalgic taste, modern potency. Approach with respect.',

  // CLEMENTINE ORANGE
  'c2186e96-3a18-4681-8a26-c396a80788d7': // 10mg Golden Hour
    'Moonwater Golden Hour 10mg THC—bright citrus balance. Fresh clementine and orange burst with natural sweetness. All-natural flavors, pure THC, just 25 calories. The perfect moderate dose for consistent, enjoyable effects. Sunshine in a can with carbonated refreshment. Ideal for social occasions or relaxed evenings.',

  'b77dd445-bb34-4719-a50e-19ee89df8345': // 5mg Day Drinker
    'Moonwater Day Drinker 5mg THC—light and refreshing. Bright clementine and orange citrus with all-natural flavors. Pure THC, just 25 calories, perfect for microdosing or cannabis newcomers. Gentle effects that enhance without overwhelming. Carbonated refreshment for any time of day. Start here if you\'re new to edibles.',

  // FIZZY LEMONADE
  '15dfdcab-7b8c-4dcc-96b9-302395d56c17': // 10mg Golden Hour
    'Moonwater Golden Hour 10mg THC—classic lemonade elevated. Bright, tart, and perfectly sweet with all-natural lemon flavor. Pure THC, just 25 calories, balanced effects. The ideal moderate dose for reliable enjoyment. Carbonated lemonade refreshment that actually works. Perfect for summer vibes any season.',

  '4de566d1-0ff7-470d-a1ac-c88b1978618b': // 30mg Darkside
    'Moonwater Darkside 30mg THC—lemonade with serious kick. Bright citrus tartness with natural lemon flavor and elevated potency. All-natural ingredients, pure THC, just 25 calories. This stronger dose is for experienced consumers seeking pronounced effects. Refreshing taste, powerful results.',

  '89ec0554-4b91-4efa-948a-fda63d0de6c3': // 5mg Day Drinker
    'Moonwater Day Drinker 5mg THC—light lemonade lift. Classic tart-sweet lemonade with all-natural flavors. Pure THC, just 25 calories, gentle effects perfect for beginners or microdosing. Carbonated refreshment without overwhelming potency. Start your THC beverage journey here.',

  // FIZZY PUNCH
  'ab6b9111-4fa0-4f10-a00a-c8fb230fc452': // 5mg Day Drinker
    'Moonwater Day Drinker 5mg THC—tropical punch, light lift. Mixed fruit punch with natural flavors and gentle carbonation. Pure THC, just 25 calories, perfect for cannabis newcomers or microdosing throughout the day. Refreshing party vibes without heavy effects. Easy introduction to THC beverages.',

  'ebf73a74-2812-4ccd-9bee-34dbc7508601': // 30mg Darkside
    'Moonwater Darkside 30mg THC—punch with power. Tropical fruit punch blend with elevated potency for experienced users. All-natural flavors, pure THC, just 25 calories. This stronger dose delivers pronounced effects—know your tolerance. Carbonated refreshment, serious results.',

  '334a3477-f467-4865-828a-8b34f1a81296': // 10mg Golden Hour
    'Moonwater Golden Hour 10mg THC—balanced tropical punch. Mixed fruit blend with natural flavors and perfect carbonation. Pure THC, just 25 calories, reliable moderate effects. The sweet spot for consistent enjoyment without overdoing it. Party-ready refreshment with predictable results.',

  // LEMON GINGER
  'f5d8e194-b4ca-4eb7-b7ef-243f11d3bbb6': // 10mg Golden Hour
    'Moonwater Golden Hour 10mg THC—citrus meets spice. Bright lemon with warming ginger kick, all-natural ingredients. Pure THC, just 25 calories, balanced effects. The perfect moderate dose for consistent enjoyment. Sophisticated flavor profile with carbonated refreshment. Something different for adventurous palates.',

  '34ad2a21-091c-4a5e-8f7e-eb1ece257628': // 30mg Darkside
    'Moonwater Darkside 30mg THC—spicy citrus with elevated potency. Zesty lemon and warming ginger for experienced consumers. All-natural flavors, pure THC, just 25 calories. This stronger dose delivers serious effects—approach with intention. Complex flavor, powerful results.',

  'ead53e13-6890-4cc4-bc58-e85148812db8': // 5mg Day Drinker
    'Moonwater Day Drinker 5mg THC—gentle citrus-ginger refresh. Bright lemon with subtle ginger warmth, all-natural ingredients. Pure THC, just 25 calories, light effects perfect for beginners. Sophisticated flavor without overwhelming potency. Microdose your way through the day.',
}

async function main() {
  console.log('Updating Moonwater beverage descriptions...\n')

  let updated = 0
  let failed = 0

  for (const [id, description] of Object.entries(BEVERAGE_DESCRIPTIONS)) {
    const { error } = await supabase
      .from('products')
      .update({ description })
      .eq('id', id)

    if (error) {
      console.error(`❌ ${id}: ${error.message}`)
      failed++
    } else {
      console.log(`✅ Updated ${id}`)
      updated++
    }
  }

  console.log(`\n✅ Updated: ${updated}`)
  console.log(`❌ Failed: ${failed}`)

  // Verify
  console.log('\n--- Sample verification ---\n')
  const { data } = await supabase
    .from('products')
    .select('name, custom_fields, description')
    .in('id', Object.keys(BEVERAGE_DESCRIPTIONS).slice(0, 3))

  data?.forEach(p => {
    const cf = p.custom_fields as any
    console.log(`${p.name} (${cf?.dosage} ${cf?.line}):`)
    console.log(`"${p.description?.substring(0, 100)}..."`)
    console.log()
  })
}

main()
