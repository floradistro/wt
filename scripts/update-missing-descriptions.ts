import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

// New descriptions for missing products
const NEW_DESCRIPTIONS: Record<string, string> = {
  // Pre-rolls with weights
  'Banana Smoothie 1.3g': 'Banana OG meets creamy smoothie terps. Tropical, sweet, and mellow. Pre-roll ready for instant relaxation.',
  'Caramel Delight 2.5g': 'Sweet caramel and vanilla notes with earthy undertones. Dessert strain vibes in a hefty pre-roll. Smooth and indulgent.',
  'Fire Breath 2.5g': 'Hot gas meets fruity fire. Pungent, potent, and packed for a strong session. Not for beginners.',
  'Gas Clay / Gaslicious Clay 1.3g': 'Fuel-forward funk with earthy clay notes. Dense, gassy, and ready to roll. Pre-roll potency at its finest.',
  'Grape Gas 2.5g': 'Grape Pie genetics with pure gas. Sweet purple terps meet fuel. Big pre-roll, bigger flavor.',
  'Gummy Bear 1.3g': 'Sweet candy terps in pre-roll form. Fruity, fun, and smooth. Like smoking your favorite gummy.',
  'Kush Mint 1.3g': 'Bubba Kush meets Animal Mints. Minty, gassy, and relaxing. Pre-roll crafted for kush lovers.',
  'Mellow Flower 2.5g': 'Gentle, balanced hybrid for easy sessions. Floral and smooth. Hefty pre-roll for mellow vibes.',
  'Rocky Road 2.5g': 'Chocolate, nuts, and marshmallow terps. Dessert strain heaven in a big pre-roll. Sweet and stoney.',
  'Sour Diesel 2.5g': 'East Coast legend in pre-roll form. Diesel fuel and citrus. Energizing sativa for the real ones.',
  'Sour Garlic 1.3g': 'GMO funk meets sour power. Pungent, savory, and potent. Pre-roll for garlic strain enthusiasts.',

  // Flower strains
  'Berry Twist': 'Mixed berry genetics twisted together. Sweet, fruity, and colorful. Berry lovers paradise.',
  'Carolina Cola': 'Southern comfort in flower form. Sweet cola and vanilla notes. Relaxing and nostalgic.',
  'Clementine Orange': 'Tangie lineage with bright citrus. Sweet orange zest and uplifting energy. Morning strain perfection.',
  'Cold Clementine': 'Chilled citrus terps. Tangie genetics with a cool finish. Refreshing and bright.',
  'Dantes Inferno': 'Hell-fire OG cross. Spicy, earthy, and intense. Indica heat for those who can handle it.',
  'Diamond Runtz': 'Runtz family with extra sparkle. Sweet, fruity, and covered in trichomes. Premium candy gas.',
  'Fig Bar': 'Sweet fig and cookie terps. Dessert strain with earthy depth. Unique flavor, smooth smoke.',
  'Fizzy Lemonade': 'Lemon genetics with effervescent terps. Bright, bubbly, and uplifting. Summer in flower form.',
  'Fizzy Punch': 'Fruit punch with fizzy citrus. Sweet, tangy, and energizing. Party strain vibes.',
  'G33': 'Gelato 33 phenotype. Sunset Sherbet x Thin Mint Cookies. Creamy, sweet, and potent.',
  'Gas Butter': 'Fuel meets creamy smoothness. Gassy terps with buttery finish. Rich and potent.',
  'Gascan Runtz': 'Runtz crossed with pure gas. Fuel-forward candy sweetness. Hard-hitting hybrid.',
  'Gelato 15': 'Cookie Fam phenotype. Thin Mint x Sunset Sherbet. Dessert terps with heavy relaxation.',
  'Girl Scout Cookie': 'The original GSC. OG Kush x Durban Poison. Earthy, sweet, and legendary.',
  'Glitter Bomb': 'Explosive trichome coverage. Sweet and sparkly. Eye candy that hits hard.',
  'Grape gas': 'Grape Pie meets fuel genetics. Purple terps, gassy finish. Sweet and pungent.',
  'Iced Berry': 'Frozen berry terps. Cool, sweet, and refreshing. Frosty buds with fruity flavor.',
  'Japanese Peaches': 'Exotic peach genetics. Sweet, floral, and delicate. Premium fruit terps.',
  'Jet Fuel': 'High-octane sativa. Diesel and skunk with energizing effects. Fuel up and go.',
  'Jungle Cake': 'Wedding Cake x White Fire. Vanilla, earth, and gas. Potent jungle vibes.',
  'Lemon Cherry Diesel': 'Lemon Cherry Gelato x Diesel. Citrus, cherry, and fuel. Triple threat terps.',
  'Lemon Cherry Gelato': 'Sunset Sherbet x Girl Scout Cookies with cherry lemon. Sweet, sour, and creamy.',
  'Lemon Cherry Runtz': 'Runtz with lemon cherry twist. Candy, citrus, and fruit. Flavor explosion.',
  'Lemon Ginger': 'Citrus meets spice. Lemon terps with ginger warmth. Unique and invigorating.',
  'Lemon Runtz': 'Runtz with lemon dominant terps. Candy citrus sweetness. Sour patch vibes.',
  'Lighter': 'Fire OG genetics. Gassy and potent. Spark it up and lift off.',
  'Mac Cocktail': 'MAC crossed with fruity genetics. Creamy, citrus, and complex. Premium hybrid blend.',
  'Malibu Kush': 'California coastal OG. Earthy pine with ocean breeze vibes. West Coast relaxation.',
  'Mallow Runtz': 'Runtz meets marshmallow. Sweet, fluffy, and smooth. Dessert candy hybrid.',
  'Mango Trees': 'Tropical mango genetics. Sweet fruit with earthy depth. Island vacation terps.',
  'Molotov Cocktails': 'Explosive hybrid blend. Fruity fire with gasoline finish. Potent party starter.',
  'Orange Candy Crush': 'Orange soda meets candy. Sweet citrus and sugar. Crushing it with flavor.',
  'Oreos': 'Cookies and cream genetics. Sweet, creamy, and dank. Dessert strain done right.',
  'Papaya Jam': 'Tropical papaya terps. Sweet, fruity, and smooth. Jam-packed with flavor.',
  'Pez Candy': 'Old school candy vibes. Sweet, fruity, and nostalgic. Like the dispenser, but better.',
  'Pink Lady': 'Pink phenotype elegance. Floral, sweet, and smooth. Lady-like but hits hard.',
  'Pink Lemonade': 'Lemonade with pink berry twist. Sweet, tart, and refreshing. Summer sipper strain.',
  'Pink Soufflé': 'Fluffy pink dessert terps. Sweet, airy, and delicate. French pastry vibes.',
  'Pop 41': 'Popping terps with 41 genetics. Sweet, loud, and trendy. Hype strain that delivers.',
  'Sherb Cream Pie': 'Sherbet meets Pie genetics. Creamy, fruity, and sweet. Relaxing indica for dessert lovers.',
  'Sinmint': 'Sin City meets mint. Cookies family with cool finish. Minty, earthy, and potent.',
  'Sour Guava': 'Tropical guava with sour twist. Tangy, sweet, and exotic. Fruit punch funk.',
  'Sour Runtz': 'Runtz with sour terps. Tangy candy with gas. Sweet and sour perfection.',
  'Sprite': 'Lemon-lime refreshment. Bright, bubbly, and clean. Soda strain vibes.',
  'Strawberry Shortcake': 'Sweet strawberry and cake. Dessert terps with berry pop. Classic flavor done right.',
  'Strawnana': 'Strawberry meets Banana Kush. Sweet fruit fusion. Tropical dessert hybrid.',
  'Super Boof': 'Boofy terps amplified. Gassy, funky, and loud. Super-charged potency.',
  'Super Runtz': 'Runtz on steroids. Extra candy, extra gas, extra everything. Super-sized flavor.',
  'Super Skunk': 'Classic skunk genetics enhanced. Earthy, pungent, and old school. Super stinky.',
  'Sweeties': 'Pure sugar terps. Sweet, candy-like, and smooth. Sweetest smoke around.',
  'Thin Mint Cookies': 'GSC phenotype. Minty chocolate cookie dough. Girl Scout classic.',
  'Trainwreck': 'Legendary sativa hybrid. Lemon, pine, and spice. Mental clarity express.',
  'Tropic Fury': 'Tropical storm of terps. Mango, pineapple, and passion fruit fury. Island explosion.',
  'Wedding Cake': 'Triangle Kush x Animal Mints. Vanilla frosting and tangy earth. Celebration strain.',
  'Yellow Zushi': 'Zushi with yellow terps. Sweet, exotic, and rare. Golden ticket genetics.',
  'Zushi': 'Zkittlez x Kush Mints. Sweet candy meets gas. Exotic hype that delivers.',

  // Gummies (scratch-made, no artificial sweeteners/dyes)
  'Fruit Punch Gummies': 'Scratch-made with no artificial sweeteners or dyes. Classic fruit punch flavor crafted clean. Party in your mouth.',
  'Grape Gummies': 'Scratch-made grape perfection—no artificial sweeteners or dyes. Bold purple flavor, real ingredients. Concord vibes.',
  'Green Tea Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Earthy green tea with subtle sweetness. Zen in a gummy.',
  'Honey Gummies': 'Scratch-made with real honey—no artificial sweeteners or dyes. Golden sweetness, clean ingredients. Bee-approved.',
  'Kiwi Lime Gummies': 'Scratch-made with no artificial sweeteners or dyes. Tangy kiwi meets zesty lime. Tropical tart perfection.',
  'Lemon Drop Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Classic lemon drop flavor, clean craft. Pucker up.',

  // Cookies (contain infused chocolate)
  'Peanut Butter Cookies': 'Classic PB cookies made with infused chocolate. Nutty, sweet, and perfectly dosed. Comfort food elevated.',
  'Snickerdoodle Cookies': 'Cinnamon sugar cookies with infused chocolate. Warm, spiced, and delicious. Holiday vibes year-round.',
  'Thin Mint Cookies': 'Minty chocolate cookies with infused chocolate. Cool, sweet, and refreshing. Girl Scout nostalgia.',

  // Chocolate (pure infused chocolate)
  'Milk Chocolate': 'Pure infused milk chocolate. Creamy, smooth, and classic. Premium chocolate, precise dosing.',
}

async function main() {
  console.log('Updating missing product descriptions...\n')

  let updated = 0
  let failed = 0

  for (const [name, description] of Object.entries(NEW_DESCRIPTIONS)) {
    const { error, count } = await supabase
      .from('products')
      .update({ description })
      .eq('vendor_id', VENDOR_ID)
      .eq('name', name)

    if (error) {
      console.error(`❌ ${name}: ${error.message}`)
      failed++
    } else {
      console.log(`✅ ${name}`)
      updated++
    }
  }

  console.log(`\n✅ Updated: ${updated}`)
  console.log(`❌ Failed: ${failed}`)
}

main()
