import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

// Updated edible descriptions with user's specific product info
const EDIBLE_DESCRIPTIONS: Record<string, string> = {
  // GUMMIES - scratch-made, no artificial sweeteners or dyes
  'Apple Gummies': 'Scratch-made with real fruit and zero artificial sweeteners or dyes. Crisp green apple flavor that actually tastes like an orchard, not a lab. Clean, consistent, delicious.',
  'Blackberry Lemonade Gummies': 'Scratch-made with no artificial sweeteners or dyes. Tart lemonade meets sweet blackberry in every bite. Summer in gummy form, crafted clean.',
  'Blueberry Gummies': 'Scratch-made from real ingredients—no artificial sweeteners or dyes ever. Deep berry flavor that hits authentic every time. Clean edibles done right.',
  'Blueberry Lemonade Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Bright lemon zest balanced by ripe blueberry sweetness. Refreshing and real.',
  'Cherry Gummies': 'Scratch-made with no artificial sweeteners or dyes. Bold cherry flavor crafted from real ingredients. Sweet, tart, and clean as it gets.',
  'Cola Gummies': 'Scratch-made cola flavor without a single artificial sweetener or dye. Classic fizzy soda vibes in a clean, craft gummy. Nostalgic and natural.',
  'Green Apple Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Sour green apple punch made the right way. Tart, tangy, and totally clean.',
  'Mango Gummies': 'Scratch-made tropical perfection—no artificial sweeteners or dyes. Ripe mango flavor that tastes like the real fruit. Island vibes, clean ingredients.',
  'Mixed Berry Gummies': 'Scratch-made berry medley with no artificial sweeteners or dyes. Strawberry, blueberry, and raspberry in perfect harmony. Real fruit flavor, real craft.',
  'Mixed Fruit Gummies': 'Scratch-made fruit explosion without artificial sweeteners or dyes. A rainbow of real flavors in every bag. Clean ingredients, maximum taste.',
  'Orange Gummies': 'Scratch-made with no artificial sweeteners or dyes. Bright citrus burst like fresh-squeezed sunshine. Real orange flavor, crafted clean.',
  'Peach Gummies': 'Scratch-made from real ingredients—zero artificial sweeteners or dyes. Sweet Georgia peach flavor done authentically. Summer harvest in every bite.',
  'Pineapple Gummies': 'Scratch-made tropical treat with no artificial sweeteners or dyes. Tangy pineapple that tastes like vacation. Clean, bright, and perfectly balanced.',
  'Raspberry Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Sweet-tart raspberry flavor from real craft. Bold berry taste, clean conscience.',
  'Sour Gummies': 'Scratch-made pucker power without artificial sweeteners or dyes. Tangy coating over fruity centers. Real sour, real clean, real good.',
  'Strawberry Gummies': 'Scratch-made strawberry perfection—no artificial sweeteners or dyes. Sweet berry flavor like fresh-picked fruit. Simple, clean, delicious.',
  'Tropical Gummies': 'Scratch-made island escape with zero artificial sweeteners or dyes. Mango, pineapple, and passion fruit paradise. Clean tropical vibes.',
  'Watermelon Gummies': 'Scratch-made summer sweetness—no artificial sweeteners or dyes. Juicy watermelon flavor that tastes like the real thing. Refreshing and clean.',

  // COOKIES - contain infused chocolate
  'Brownies': 'Rich, fudgy brownies made with infused chocolate. Dense, decadent, and dangerously delicious. Classic comfort elevated with premium craft.',
  'Chocolate Chip Cookies': 'Classic cookies loaded with infused chocolate chips. Crispy edges, chewy centers, and perfectly dosed. Homestyle taste, craft quality.',

  // COCOA BITES / MILK CHOCOLATE - pure infused chocolate
  'Cocoa Bites': 'Pure infused chocolate in bite-sized perfection. Rich cocoa flavor, precise dosing, smooth melt. Premium chocolate craft, nothing artificial.',
  'Mallows': 'Fluffy marshmallows dipped in pure infused chocolate. Sweet, pillowy, and perfectly balanced. Craft confection meets clean dosing.',
  'Neapolitan': 'Three layers of pure infused chocolate: vanilla, strawberry, and cocoa. Classic ice cream vibes in chocolate form. Craft quality, nostalgic taste.',
}

async function main() {
  console.log('Updating edible product descriptions...\n')

  for (const [name, description] of Object.entries(EDIBLE_DESCRIPTIONS)) {
    const { error } = await supabase
      .from('products')
      .update({ description })
      .eq('vendor_id', VENDOR_ID)
      .eq('name', name)

    if (error) {
      console.error(`❌ ${name}: ${error.message}`)
    } else {
      console.log(`✅ ${name}`)
    }
  }

  console.log('\n✅ Done updating edible descriptions!')
}

main()
