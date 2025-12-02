import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

// Trust-building category descriptions for website
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  // Main Categories
  'Flower': 'Hand-selected, small-batch cannabis flower grown by trusted cultivators. Every strain is lab-tested for potency and purity, with full COA transparency. We source only top-shelf genetics—no mids, no mystery. Quality you can see, smell, and trust.',

  'Concentrates': 'Premium cannabis extracts crafted with precision. From live resin to rosin, every batch is lab-verified for potency and purity. Clean extraction methods, no cutting agents, full terpene preservation. Connoisseur-grade concentrates for those who know the difference.',

  'Edibles': 'Handcrafted cannabis edibles made with real ingredients. Our gummies are scratch-made with no artificial sweeteners or dyes. Cookies feature infused chocolate. Consistent dosing, honest labeling, and flavors that actually taste good. Edibles done right.',

  'Beverages': 'Moonwater THC sodas—all-natural, low-calorie, pure THC. No artificial anything. From 5mg microdose to 60mg max strength, every can delivers precise, predictable effects. Lab-tested, carbonated refreshment that actually works.',

  'Disposable Vape': 'Ready-to-use cannabis vapes with premium oil and reliable hardware. No burnt hits, no leaky carts, no mystery ingredients. Lab-tested for potency and purity. Convenient, consistent, and crafted for quality.',

  'Hash Holes': 'The pinnacle of pre-roll craftsmanship. Premium flower wrapped around hash rosin cores. Hand-rolled, slow-burning, incredibly potent. Every hash hole is a work of art—and hits like one too. For those who demand the absolute best.',

  'Smoke Accessories': 'Quality accessories to elevate your session. From papers to pieces, we stock only reliable gear that performs. No cheap imports, no disappointments. The tools you need, built to last.',

  // Beverage Subcategories
  'Day Drinker (5mg)': 'Moonwater Day Drinker—5mg THC for light, functional effects. Perfect for newcomers or microdosing throughout the day. All-natural ingredients, just 25 calories. Start low, stay lifted.',

  'Golden Hour (10mg)': 'Moonwater Golden Hour—10mg THC for the sweet spot. Balanced effects that enhance without overwhelming. All-natural, 25 calories, reliable dosing. The go-to for consistent enjoyment.',

  'Darkside (30mg)': 'Moonwater Darkside—30mg THC for experienced consumers. Elevated potency, pronounced effects. Know your tolerance before diving in. All-natural ingredients, serious results.',

  'Riptide (60mg)': 'Moonwater Riptide—60mg THC for seasoned veterans only. Maximum strength, maximum respect required. All-natural, powerfully effective. Not for beginners. Approach with intention.',
}

async function main() {
  console.log('Updating category descriptions...\n')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('vendor_id', VENDOR_ID)

  let updated = 0
  let skipped = 0

  for (const cat of categories || []) {
    const description = CATEGORY_DESCRIPTIONS[cat.name]

    if (description) {
      const { error } = await supabase
        .from('categories')
        .update({ description })
        .eq('id', cat.id)

      if (error) {
        console.error(`❌ ${cat.name}: ${error.message}`)
      } else {
        console.log(`✅ ${cat.name}`)
        updated++
      }
    } else {
      console.log(`⏭️ ${cat.name} (no description defined)`)
      skipped++
    }
  }

  console.log(`\n✅ Updated: ${updated}`)
  console.log(`⏭️ Skipped: ${skipped}`)
}

main()
