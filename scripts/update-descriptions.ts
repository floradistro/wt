/**
 * Script to update product descriptions with fun, concise copy
 * Run with: npx tsx scripts/update-descriptions.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Vendor ID for Flora Distro
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

// Fun, concise descriptions based on real strain data
const NEW_DESCRIPTIONS: Record<string, string> = {
  // === FLOWER ===
  'Alpha Runtz': 'Zkittlez meets Gelato in this alpha phenotype hybrid. Sweet candy and citrus zest hit first, with berry punch on the exhale. Limonene-forward for that uplifting creative edge.',

  'Animal Mintz': 'Cookies family royalty. Animal Cookies crossed with SinMint delivers mint, vanilla, and baked goods over earthy diesel. Deep relaxation with a euphoric lift—evening essential.',

  'Banana Punch': 'Banana OG meets Purple Punch for tropical knockout power. Ripe bananas, pineapple, and berries with earthy undertones. Creeper strain—wait for it, then sink into the couch.',

  'Batman': 'The Dark Knight of indicas. OG Kush heritage brings earthy pine and gas. Relaxed, sleepy, euphoric—Gotham after dark in flower form.',

  'Birthday Cake': 'GSC crossed with Cherry Pie. Vanilla, sweet berries, and creamy undertones. Celebrate any session with this euphoric, creative hybrid.',

  'Black Cherry Funk': 'Black Cherry Soda meets DJ Short Blueberry. Sweet cherry and berry funk with pine and floral notes. Relaxed creativity without the couch lock.',

  'Black Cherry Gelato': 'Black Cherry Funk meets Acai Berry Gelato. Dark fruit, sweet cherry, and subtle skunk. Supreme calm meets blissful uplift—26% THC evening vibes.',

  'Black Ice': 'Black Domina crosses White Widow for frosty indica power. Earthy, spicy, with menthol finish. Deep relaxation for pain, stress, and sleepless nights.',

  'Black Jack': 'Sweet Seeds classic. Black Domina meets Jack Herer for the best of both worlds. Uplifting creativity followed by smooth body relaxation. Berry, pine, citrus.',

  'Black Runtz': 'Dark phenotype of the Runtz family. Tart berry pie with earthy crust. 26% THC indica-leaning hybrid. Dark matter, deep flavor.',

  'Blizzard': 'Ice Blizzard meets Haze Berry for sativa-dominant energy. Sweet, fruity, with peppery spice. Euphoric, happy, focused—winter storm in a jar.',

  'Blow Pop': 'OG Kush meets Sunset Sherb. Sweet candy and fruit with diesel undertones. Relaxing indica hybrid best saved for nighttime. Childhood nostalgia, grown up.',

  'Blue Nerds': 'Blue Sherbet crosses Zkittlez. Sweet candy, grape, and berry with citrus. Euphoric, focused, creative—candy store in flower form.',

  'Blue Zushi': 'Kush Mints meets Zkittlez from Team 10. Creamy gas and exotic candy funk over tropical fruit. 29% THC with 2.6% terpenes. Ocean deep, sky high.',

  'Bolo Candy': 'Candy Rain meets Biscotti. Sweet candy, vanilla, and nutty notes. Balanced hybrid for any occasion. Tie one on, the right way.',

  'Bolo Runtz': 'Runtz meets Zkittlez for candy-coated perfection. Grape, berry, and tropical citrus over creamy gas. Euphoric uplift into gentle relaxation.',

  'Bubba Runtz': 'Classic Bubba Kush meets modern Runtz. Earthy, musky, pine meets sweet candy. Indica hybrid for deep relaxation and happy calm.',

  'Bubble Gum': 'Indiana Bubble Gum legend. Sweet strawberry and floral notes. Relaxing indica-leaning hybrid that tastes exactly like it sounds.',

  'Cali Candy': 'California Orange meets Candy Kush. Sweet citrus and pure candy sweetness. West Coast sunshine in every hit.',

  'Candy Fumez': 'Zkittlez meets Sherbanger. Fruit, gas, and tropical candy. Euphoric relaxation with serious potency. Sweet smoke, serious effects.',

  'Candy Runtz': 'Zkittlez x Gelato candy phenotype. Rainbow candy, sweet berries, tropical vibes. Balanced creativity and body calm.',

  'Cherry Popper': 'Cherry Pie lineage brings sweet cherry, berry pie, and vanilla. First time, every time feels special with this balanced hybrid.',

  "Dante's Inferno": 'OG Kush meets SFV OG for fire indica power. Spicy, earthy, diesel. Deep sedation and euphoria—nine circles deep.',

  'Detroit Candy': 'Motor City Kush meets Candyland. Sweet candy, diesel, and earthy pine. Relaxed euphoria with creative focus.',

  'Dolce': 'Sunset Sherbet meets Gelato 41. Sweet dessert terps, fruity and creamy. Balanced hybrid for relaxed creativity.',

  'Fizz': 'Bubblegum meets Champagne Kush. Sweet, fizzy, with citrus pop. Light and bubbly effects for social sessions.',

  'Garlic Breath': 'GMO crosses Mendo Breath for pungent power. Garlic, spice, diesel—not for the faint of heart. Heavy relaxation and deep sleep.',

  'Garlic Cookies': 'GSC meets Chemdawg. Garlic, diesel, earthy sweetness. Potent hybrid for serious relaxation. Not your grandma\'s cookies.',

  'Garlicane': 'Slurricane meets GMO. Sweet candy crashes into garlic gas. Indica-dominant for deep relaxation and mood lift.',

  'Gas Can Runtz': 'Fuel-forward Runtz phenotype. Sweet candy meets pure gasoline. Potent hybrid with heavy trichome coverage.',

  'Gas House Runtz': 'Gassy phenotype of the Runtz family. Diesel, candy, and tropical fruit. High-test hybrid for fuel enthusiasts.',

  'Gelato Cookies': 'Gelato meets GSC for dessert perfection. Sweet, creamy, with cookie dough finish. Relaxed euphoria with creative spark.',

  'Gelato 33': 'Larry Bird phenotype. Sunset Sherbet x Thin Mint GSC. Sweet citrus, berry, and creamy gas. Balanced, euphoric, legendary.',

  'GMO': 'Garlic, Mushroom, Onion—Chemdawg x GSC. Pungent, savory, diesel. Heavy indica effects for serious relaxation. Divinely funky.',

  'Grape Gas': 'Grape Pie meets Gas genetics. Sweet grape candy over fuel. Relaxed body high with euphoric head.',

  'Green Apple Runtz': 'Sour apple phenotype of Runtz. Tart green apple with candy sweetness. Uplifting hybrid with energetic buzz.',

  'Guava': 'Tropical Gas genetics. Sweet guava and exotic fruit with gas undertones. Balanced hybrid for creative focus.',

  'Ice Cream Cake': 'Wedding Cake meets Gelato 33. Creamy vanilla, sweet dough, sugary frosting. Relaxing indica for dessert lovers.',

  'Jealousy': 'Sherb Bx1 meets Gelato 41. Sweet, gassy, fruity. Balanced hybrid with jealousy-inducing bag appeal.',

  'Kept Secret': 'Mystery genetics, obvious quality. Sweet, earthy, and gassy. Balanced effects worth keeping to yourself.',

  'Kush Mints': 'Bubba Kush meets Animal Mints. Mint, coffee, and earthy gas. Relaxing hybrid with sharp focus.',

  'LA OG': 'Classic Los Angeles OG Kush. Earthy, pine, and diesel. Potent indica for relaxation and sleep.',

  'Lava Cake': 'Grape Pie meets Thin Mint GSC. Sweet grape, chocolate, and creamy mint. Relaxing indica with euphoric touch.',

  'Lemon Bello': 'Limoncello meets Biscotti. Bright lemon, sweet citrus, and vanilla. Uplifting sativa-leaning hybrid.',

  'Lemon Tree': 'Lemon Skunk meets Sour Diesel. Intense lemon citrus with diesel undertones. Energizing sativa for productive days.',

  'London Jelly': 'UK genetics meets fruity terpenes. Grape jelly sweetness with earthy undertones. Relaxed creativity.',

  'London Pound Cake': 'Sunset Sherbet meets unknown heavy. Sweet vanilla cake with berry notes. Relaxing indica hybrid.',

  'Malibu Pure Kush': 'Pure SoCal kush genetics. Earthy, pine, and classic OG fuel. Old school vibes, modern potency.',

  'Mallows': 'Sweet dessert strain. Vanilla, marshmallow, and sugar. Light and fluffy effects for relaxed evenings.',

  'McFlurry': 'Dessert hybrid perfection. Creamy vanilla with sweet berry swirl. Relaxing and euphoric—treat yourself.',

  'Neapolitan': 'Triple flavor hybrid. Strawberry, vanilla, chocolate terps in one. Balanced effects, classic vibes.',

  'Oreo Blizzard': 'Cookies and cream genetics. Sweet vanilla, chocolate cookie crunch. Relaxing hybrid for dessert lovers.',

  'Pancakes': 'London Pound Cake meets Kush Mints. Buttery, sweet, with minty finish. Morning hybrid that hits like breakfast.',

  'Peanut Butter Breath': 'Do-Si-Dos meets Mendo Breath. Nutty, earthy, herbal. Relaxing indica with heavy body effects.',

  'Permanent Marker': 'Biscotti meets Jealousy meets Sherb Bx1. Marker-sweet with fuel undertones. Creative focus and relaxation.',

  'Pink Runtz': 'Pink phenotype of Zkittlez x Gelato. Sweet candy with floral notes. Balanced euphoria and body calm.',

  'Popz Runtz': 'Candy-forward Runtz selection. Sweet, fruity, with grape soda pop. Fun effects for social sessions.',

  'Project Z': 'Zkittlez-dominant hybrid project. Sweet rainbow candy with earthy base. Euphoric, creative, focused.',

  'Pure Michigan': 'Oreoz meets Mendo Breath. Cookies, cream, and earthy depth. Relaxing indica from the Mitten.',

  'Puro Loco': 'Latin fire meets kush. Spicy, earthy, with citrus heat. Energizing hybrid for adventurous sessions.',

  'Runtz': 'The original. Zkittlez meets Gelato for candy perfection. Sweet fruit, creamy gas. Balanced euphoria and relaxation.',

  'SCP': 'Secret Clone Project. Classified genetics, unclassified potency. Sweet, gassy, mysterious. Special containment required.',

  'Sour Diesel': 'East Coast legend. Chemdog 91 meets Super Skunk. Pungent fuel with citrus. Energizing sativa for creative hustle.',

  'Specimen X': 'Experimental genetics. Unknown origins, known potency. Earthy, sweet, gassy. Lab-grade quality.',

  'Strawberry Cheesecake': 'Strawberry meets Cheese genetics. Sweet berry, creamy, tangy. Dessert indica for relaxation.',

  'Strawberry Milkshake': 'Strawberry Cough meets Cookies and Cream. Sweet berries and vanilla cream. Smooth, relaxing, delicious.',

  'Super Lemon Haze': 'Lemon Skunk meets Super Silver Haze. Intense lemon citrus with spicy undertones. Energizing sativa legend.',

  'Super Sonic': 'High-velocity hybrid. Sweet, citrus, and fuel. Fast-acting effects for immediate lift.',

  'Sweetarts': 'Candy-inspired genetics. Tart and sweet citrus with fruity finish. Playful effects for creative sessions.',

  'White Runtz': 'White phenotype of the Runtz cross. Sweet candy with creamy gas. Balanced hybrid with frosted appeal.',

  'Zarati': 'Exotic hybrid selection. Sweet fruit meets earthy gas. Relaxed focus with creative edge.',

  'Zushi': 'Team 10 legend. Kush Mints meets Zkittlez. Creamy gas and exotic candy funk. Premium genetics, premium effects.',

  'Yellow Zushi': 'Golden phenotype of the Zushi line. Bright citrus meets creamy gas. Uplifting and relaxed in perfect balance.',

  'Diamond Runtz': 'Crystal-coated Runtz selection. Sweet candy with extra sparkle. Premium hybrid with frosted appeal.',

  'Dantes Inferno': 'OG Kush meets SFV OG for fire indica power. Spicy, earthy, diesel. Deep sedation and euphoria—nine circles deep.',

  'Kush Mintz': 'Bubba Kush meets Animal Mints. Mint, coffee, and earthy gas. Relaxing hybrid with sharp mental focus.',

  'LA O.G.': 'Classic Los Angeles OG Kush. Earthy, pine, and pure diesel. Potent indica for deep relaxation and restful sleep.',

  'Grape gas': 'Grape Pie meets gas genetics. Sweet grape candy over fuel. Relaxed body high with euphoric headspace.',

  'Gascan Runtz': 'Fuel-forward Runtz phenotype. Sweet candy meets pure gasoline. Potent hybrid with heavy trichome coverage.',

  'G33': 'Gelato 33 shorthand. Larry Bird phenotype. Sweet citrus, berry, and creamy gas. Balanced, euphoric, legendary.',

  'Gelato 15': 'Thin Mint GSC x Sunset Sherbet. Sweet, fruity, with cookie undertones. Relaxing euphoria with creative spark.',

  'Girl Scout Cookie': 'The OG GSC. Durban Poison x OG Kush. Earthy sweetness with mint. Euphoric, relaxed, full-body bliss.',

  'Glitter Bomb': 'Explosive hybrid. Sweet, fruity, with sparkling trichomes. Uplifting effects that hit fast and bright.',

  'Jet Fuel': 'High-octane sativa. Aspen OG x High Country Diesel. Pungent fuel with earthy undertones. Energizing focus for productive sessions.',

  'Jungle Cake': 'White Fire #43 x Wedding Cake. Sweet vanilla cake with earthy undertones. Relaxing indica with euphoric lift.',

  'Lemon Cherry Diesel': 'Lemon meets Cherry meets Diesel. Citrus, sweet, and fuel. Energizing hybrid for creative focus.',

  'Lemon Cherry Gelato': 'Sunset Sherbet x Girl Scout Cookies. Lemon zest and cherry sweetness over creamy gas. Balanced hybrid perfection.',

  'Lemon Cherry Runtz': 'Runtz phenotype with lemon and cherry terps. Citrus candy sweetness. Uplifting and relaxing in waves.',

  'Lemon Runtz': 'Citrus-forward Runtz selection. Bright lemon over candy sweetness. Uplifting hybrid with energetic buzz.',

  'Malibu Kush': 'Pure SoCal kush genetics. Earthy, pine, and classic OG fuel. Beach vibes, potent effects.',

  'Mallow Runtz': 'Marshmallow meets Runtz. Sweet, fluffy, and creamy. Gentle hybrid for relaxed evenings.',

  'Mango Trees': 'Tropical mango genetics. Sweet, fruity, with earthy undertones. Relaxed focus with island vibes.',

  'Mac Cocktail': 'MAC genetics mixed right. Creamy, gassy, with citrus notes. Balanced hybrid for any occasion.',

  'Molotov Cocktails': 'Explosive hybrid blend. Gas-forward with sweet undertones. Potent effects that hit hard.',

  'Orange Candy Crush': 'Sweet orange meets candy genetics. Citrus burst with sugary finish. Uplifting and playful.',

  'Oreos': 'Cookies and cream genetics. Sweet vanilla, chocolate cookie crunch. Relaxing hybrid for dessert lovers.',

  'Papaya Jam': 'Tropical Papaya genetics. Sweet exotic fruit with earthy jam notes. Relaxing and euphoric.',

  'Pez Candy': 'Candy-inspired hybrid. Sweet, fruity, nostalgic. Playful effects for creative sessions.',

  'Pink Lady': 'Elegant pink phenotype. Floral, sweet, and smooth. Balanced effects with graceful onset.',

  'Pink Lemonade': 'Lemon Skunk x Purple Kush. Tart citrus with sweet berry. Uplifting sativa-leaning hybrid.',

  'Pink Soufflé': 'Dessert hybrid perfection. Sweet, creamy, with berry notes. Light and fluffy effects.',

  'Pop 41': 'Gelato 41 phenotype. Creamy, sweet, with gas undertones. Potent hybrid with smooth finish.',

  'Sherb Cream Pie': 'Sherbet meets Pie genetics. Creamy, fruity, sweet. Relaxing indica for dessert lovers.',

  'Sinmint': 'SinMint Cookies genetics. Mint, earth, and cookie sweetness. Relaxing with creative spark.',

  'Sour Guava': 'Sour Diesel meets Guava. Pungent fuel with tropical sweetness. Energizing with exotic twist.',

  'Sour Runtz': 'Sour phenotype of Runtz. Tart candy with gas undertones. Uplifting hybrid with punchy flavor.',

  'Sprite': 'Lemon-lime hybrid. Bright citrus, clean and crisp. Refreshing effects for daytime sessions.',

  'Strawberry Shortcake': 'Sweet strawberry meets vanilla cake. Dessert terps with berry finish. Relaxing and delicious.',

  'Strawnana': 'Strawberry Banana genetics. Sweet berries with creamy banana. Relaxing indica with fruity finish.',

  'Super Boof': 'Black Cherry Punch x Tropicana Cookies. Sweet cherry, citrus, and gas. Potent hybrid with unique profile.',

  'Super Runtz': 'Extra potent Runtz selection. Sweet candy with gas. Maximum effects, premium genetics.',

  'Super Skunk': 'Skunk #1 legend. Pungent, earthy, classic. Old school power, proven effects.',

  'Sweeties': 'Sweet hybrid selection. Candy terps with smooth finish. Gentle effects for easy sessions.',

  'Thin Mint Cookies': 'GSC phenotype. Mint chocolate, earthy sweetness. Relaxing euphoria with sweet finish.',

  'Trainwreck': 'Sativa legend. Mexican x Thai x Afghani. Piney, spicy, with lemon. Fast-hitting cerebral energy.',

  'Wedding Cake': 'Triangle Kush x Animal Mints. Sweet vanilla frosting with earthy cake. Relaxing indica hybrid.',

  // === PREROLLS (size variants) ===
  'Banana Smoothie 1.3g': 'Tropical banana terps in a 1.3g preroll. Smooth, creamy, relaxing. Ready to roll.',

  'Caramel Delight 2.5g': 'Sweet caramel terps in a 2.5g cannon. Buttery smooth effects. Premium preroll.',

  'Fire Breath 2.5g': 'Spicy, gassy, intense. 2.5g of fire-breathing power. Heavy hitter for experienced sessions.',

  'Gas Clay / Gaslicious Clay 1.3g': 'Gassy terps, moldable effects. 1.3g of fuel-forward flavor. Smooth and potent.',

  'Grape Gas 2.5g': 'Grape and gas in a 2.5g cannon. Sweet fruit over fuel. Premium preroll for sharing.',

  'Gummy Bear 1.3g': 'Sweet candy terps in a 1.3g preroll. Fun, fruity, and ready to enjoy.',

  'Kush Mint 1.3g': 'Minty kush in 1.3g format. Cool, earthy, relaxing. Classic preroll experience.',

  'Mellow Flower 2.5g': 'Gentle, relaxing terps. 2.5g for mellow sessions. Smooth and easy-going.',

  'Rocky Road 2.5g': 'Chocolate, nuts, marshmallow terps. 2.5g of dessert power. Indulgent preroll.',

  'Sour Diesel 2.5g': 'East Coast legend in 2.5g format. Pungent fuel, energizing effects. Classic sativa.',

  'Sour Garlic 1.3g': 'GMO terps in 1.3g preroll. Pungent, savory, potent. Not for the faint of heart.',

  // === ADDITIONAL EDIBLES ===
  'Fig Bar': 'Natural fig flavor, precise dosing. Wholesome taste with consistent effects. Sophisticated edible.',

  'Fruit Punch Gummies': 'Party punch flavor. 10mg per piece, 100mg total. Fruity blend for fun sessions.',

  'Grape Gummies': 'Classic grape flavor. 10mg per piece, 100mg total. Sweet and consistent.',

  'Green Tea Gummies': 'Subtle green tea flavor. 10mg per piece, 100mg total. Calm, focused effects.',

  'Honey Gummies': 'Natural honey sweetness. 10mg per piece, 100mg total. Golden flavor, reliable dosing.',

  'Kiwi Lime Gummies': 'Tart kiwi meets zesty lime. 10mg per piece, 100mg total. Tropical twist.',

  'Lemon Drop Gummies': 'Classic lemon candy flavor. 10mg per piece, 100mg total. Tart and sweet.',

  'Milk Chocolate': 'Rich milk chocolate, precise infusion. Creamy, smooth, indulgent. Classic edible done right.',

  'Peanut Butter Cookies': 'Nutty, rich, satisfying. 10mg per piece. Comfort food with consistent effects.',

  'Snickerdoodle Cookies': 'Cinnamon sugar perfection. 10mg per piece. Warm spice with reliable dosing.',

  'Hot Gas Fudge': 'Rich fudge with gas terps. Decadent chocolate meets fuel. Indulgent and potent.',

  'Japanese Peaches': 'Delicate peach flavor. 10mg per piece. Elegant sweetness, precise effects.',

  // === BEVERAGES ===
  'Berry Twist': 'Mixed berry cannabis soda. Refreshing fruit blend with balanced effects. Premium beverage.',

  'Carolina Cola': 'Classic cola with cannabis twist. Southern comfort in every sip. Refreshing and effective.',

  'Clementine Orange': 'Bright citrus cannabis soda. Fresh clementine flavor with uplifting effects.',

  'Cold Clementine': 'Chilled citrus refreshment. Cold-pressed flavor with cannabis infusion. Crisp and clean.',

  'Fizzy Lemonade': 'Sparkling lemon cannabis soda. Tart, refreshing, perfectly dosed. Summer in a bottle.',

  'Fizzy Punch': 'Effervescent fruit punch. Mixed fruit flavor with balanced effects. Party-ready beverage.',

  'Iced Berry': 'Chilled berry blend. Cold infusion with mixed berry flavor. Refreshing and relaxing.',

  'Lemon Ginger': 'Zesty lemon meets spicy ginger. Balanced cannabis beverage with warming finish.',

  'Lighter': 'Light, refreshing, low-dose. Easy-drinking cannabis beverage for casual sessions.',

  'Tropic Fury': 'Tropical storm of flavors. Exotic fruit blend with potent effects. Paradise in a bottle.',

  // === CONCENTRATES ===
  'Gas Butter': 'Gassy, creamy concentrate. Full-spectrum badder with fuel-forward terps. Dab-ready.',

  // === EDIBLES ===
  'Apple Gummies': 'Orchard-picked flavor, lab-perfected dosing. 10mg per piece, 100mg total. Crisp apple taste with consistent effects.',

  'Blackberry Lemonade Gummies': 'Tart meets sweet in every bite. 10mg per piece, 100mg total. Summer refreshment, year-round.',

  'Blueberry Gummies': 'Forest-fresh blueberry flavor. 10mg per piece, 100mg total. Precise dosing, pure berry taste.',

  'Blueberry Lemonade Gummies': 'Zesty lemon meets fresh berries. 10mg per piece, 100mg total. Balanced citrus and fruit.',

  'Brownies': 'Classic comfort, modern dosing. 10mg per piece. Rich chocolate, reliable effects. Timeless for a reason.',

  'Cherry Gummies': 'Red velvet elevation. 10mg per piece, 100mg total. Sweet cherry with consistent potency.',

  'Chocolate Chip Cookies': 'Warm nostalgia, precise infusion. 10mg per piece. Fresh-baked flavor, lab-tested quality.',

  'Cocoa Bites': 'Chocolate temptation, measured elevation. 10mg per piece, 100mg total. Rich cocoa, reliable dosing.',

  'Cola Gummies': 'Pop culture in edible form. 10mg per piece, 100mg total. Classic cola flavor, modern infusion.',

  'Green Apple Gummies': 'Tart and tangy perfection. 10mg per piece, 100mg total. Sour apple punch with balanced effects.',

  'Mango Gummies': 'Tropical escape, precise dose. 10mg per piece, 100mg total. Ripe mango flavor, consistent quality.',

  'Mixed Berry Gummies': 'Berry medley perfection. 10mg per piece, 100mg total. Strawberry, blueberry, raspberry blend.',

  'Mixed Fruit Gummies': 'Fruit stand variety pack. 10mg per piece, 100mg total. Assorted flavors, uniform dosing.',

  'Orange Gummies': 'Citrus sunshine in every piece. 10mg per piece, 100mg total. Fresh orange flavor, reliable effects.',

  'Peach Gummies': 'Georgia peach perfection. 10mg per piece, 100mg total. Sweet peach flavor, precise potency.',

  'Pineapple Gummies': 'Tropical punch packed. 10mg per piece, 100mg total. Sweet pineapple, balanced infusion.',

  'Raspberry Gummies': 'Berry brightness. 10mg per piece, 100mg total. Tart raspberry flavor, consistent effects.',

  'Sour Gummies': 'Pucker-worthy potency. 10mg per piece, 100mg total. Sour coating, sweet center.',

  'Strawberry Gummies': 'Classic berry flavor. 10mg per piece, 100mg total. Sweet strawberry, reliable dosing.',

  'Tropical Gummies': 'Island vibes in every bite. 10mg per piece, 100mg total. Mixed tropical flavors, vacation effects.',

  'Watermelon Gummies': 'Summer slice anytime. 10mg per piece, 100mg total. Fresh watermelon flavor, consistent quality.',

  // === BEVERAGES (by flavor, already have good descriptions) ===

  // === CONCENTRATES ===
  'Badder': 'Creamy, terp-rich concentrate. Full-spectrum extraction preserves the entourage. Dab-ready consistency.',

  'Diamonds': 'Pure THCA crystalline. Maximum potency, minimal plant matter. The pinnacle of extraction.',

  'Hash': 'Traditional solventless concentrate. Pressed trichomes, pure and simple. Old school, new respect.',

  'Live Resin': 'Flash-frozen fresh, extracted live. Maximum terpene preservation. True-to-plant flavor and effects.',

  'Live Rosin': 'Ice water hash pressed fresh. Solventless perfection. Pure trichomes, nothing else.',

  'Rosin': 'Heat and pressure, no solvents. Clean extraction, full flavor. Connoisseur-approved.',

  'Shatter': 'Glass-like concentrate. Stable, potent, pure. Classic extraction done right.',

  'Sugar': 'Crystalline with terp sauce. Sweet appearance, full-spectrum effects. Balanced potency and flavor.',

  'Wax': 'Malleable concentrate. Easy to work with, full effects. Versatile dabbing experience.',
}

async function main() {
  console.log('Fetching products...')

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, description')
    .eq('vendor_id', VENDOR_ID)
    .order('name')

  if (error) {
    console.error('Error fetching products:', error)
    process.exit(1)
  }

  console.log(`Found ${products.length} products\n`)

  let updated = 0
  let skipped = 0

  for (const product of products) {
    const newDescription = NEW_DESCRIPTIONS[product.name]

    if (newDescription) {
      console.log(`Updating: ${product.name}`)

      const { error: updateError } = await supabase
        .from('products')
        .update({
          description: newDescription,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)
        .eq('vendor_id', VENDOR_ID)

      if (updateError) {
        console.error(`  Error: ${updateError.message}`)
      } else {
        console.log(`  ✓ Updated`)
        updated++
      }
    } else {
      skipped++
    }
  }

  console.log(`\n✅ Done! Updated ${updated} products, skipped ${skipped} (no new description defined)`)
}

main()
