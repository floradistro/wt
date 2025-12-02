import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

// Informative, sleek descriptions - real genetics, terpenes, effects, flavors
const DESCRIPTIONS: Record<string, string> = {
  // === FLOWER STRAINS ===
  'Alpha Runtz': 'A rare phenotype from the Zkittlez x Gelato cross that earned the Runtz name. This alpha cut delivers an intense candy sweetness upfront with layers of tropical citrus and grape. The high starts cerebral and creative before settling into full-body relaxation. Dominant terpenes include caryophyllene and limonene, giving it that signature sweet-gas profile. Perfect for afternoon sessions when you want flavor and function.',

  'Animal Mintz': 'Cookies Fam royalty bred from Animal Cookies and SinMint Cookies. The aroma hits with fresh mint and vanilla cookie dough, underlined by earthy kush notes. Effects are balanced but lean indica—expect deep relaxation with a clear, happy headspace. High in caryophyllene and limonene with hints of linalool. Ideal for unwinding without getting locked to the couch.',

  'Banana Punch': 'Banana OG crossed with Purple Punch creates this tropical knockout. Ripe banana and sweet berry dominate the nose, with subtle grape and citrus undertones. The high is euphoric and giggly at first, transitioning into heavy relaxation. Myrcene-forward with supporting limonene makes this perfect for evening use or managing stress.',

  'Batman': 'A dark, mysterious indica from OG Kush lineage. Earthy pine and diesel dominate the profile with subtle sweetness lurking underneath. Effects are deeply sedating—relaxed muscles, calm mind, ready for sleep. High myrcene and caryophyllene content. Best saved for nighttime when you need to disappear into rest.',

  'Berry Twist': 'A fruity hybrid combining multiple berry genetics into one flavorful package. Sweet strawberry, blueberry, and raspberry notes twist together with subtle earthiness. The high is uplifting and social, great for daytime activities. Limonene and myrcene work together for mood elevation without sedation.',

  'Birthday Cake': 'Girl Scout Cookies crossed with Cherry Pie creates this celebration-worthy hybrid. Vanilla frosting and sweet dough flavors with hints of fruit and earth. The high is euphoric and relaxing, perfect for social gatherings or creative projects. Caryophyllene and limonene dominant with a balanced indica-sativa effect.',

  'Black Cherry Funk': 'Black Cherry Soda meets DJ Short Blueberry in this flavorful indica-leaning hybrid. Sweet cherry and berry funk dominate with pine and floral undertones. The high brings relaxed creativity without heavy sedation—functional enough to stay engaged while taking the edge off. Myrcene and pinene shine through.',

  'Black Cherry Gelato': 'A cross of Black Cherry Funk and Gelato 41 that delivers dessert-level sweetness. Dark cherry, cream, and subtle gas notes create a complex profile. Effects are balanced—mental clarity with physical relaxation. High in caryophyllene and humulene. Great for afternoon sessions or creative work.',

  'Black Ice': 'A potent indica cross known for its dark, frosty appearance and heavy effects. Earthy, piney, and slightly minty with diesel undertones. The high hits fast and hard—expect couch-lock and deep relaxation. Myrcene dominant with caryophyllene support. Reserved for experienced users seeking serious sedation.',

  'Black Jack': 'Black Domina crossed with Jack Herer creates this balanced hybrid legend. Piney, earthy, and slightly sweet with citrus notes. The high is cerebral and creative while keeping the body relaxed. Pinene and terpinolene dominant. Perfect for daytime productivity or creative projects.',

  'Black Runtz': 'A darker phenotype of the Runtz family with Zkittlez and Gelato genetics. Sweet candy flavor meets earthy, gassy undertones. The high is euphoric and relaxing without being overly sedating. Caryophyllene and limonene create that sweet-gas signature. Great for any time of day.',

  'Blizzard': 'A frosty indica known for heavy trichome coverage and potent effects. Earthy, piney, and slightly sweet with cooling menthol notes. Effects are deeply relaxing and sedating—a snowstorm for the senses. High myrcene content. Best for evening use when you want to chill completely.',

  'Blow Pop': 'Named for the classic candy, this hybrid delivers sweet, fruity flavors with a bubble gum finish. Grape, cherry, and tropical notes dominate. The high is uplifting and happy, great for social situations or creative activities. Limonene and caryophyllene work together for mood enhancement.',

  'Blue Nerds': 'A candy-inspired strain with sweet, tart berry flavors reminiscent of the classic candy. Blue Dream genetics shine through with berry and citrus notes. The high is balanced—creative and uplifting with gentle relaxation. Myrcene and pinene dominant. Great for daytime enjoyment.',

  'Blue Zushi': 'An exotic cross featuring Zkittlez and Kush Mints genetics with added blueberry influence. Sweet berry meets creamy, gassy notes in a complex profile. Effects are potent and balanced—euphoric head high with relaxing body effects. High caryophyllene and limonene. Premium exotic for connoisseurs.',

  'Bolo Candy': 'A sweet, candy-forward strain with tropical and citrus notes. The profile is bright and fruity with subtle gas undertones. Effects are uplifting and social, perfect for daytime activities. Limonene dominant with supporting terpinolene. Fun and functional.',

  'Bolo Runtz': 'Runtz genetics with added sweetness from the Bolo line. Candy, tropical fruit, and cream flavors blend seamlessly. The high is balanced—happy and euphoric with gentle body relaxation. Caryophyllene and limonene shine. Great for any occasion.',

  'Bubba Runtz': 'Bubba Kush meets Runtz in this indica-leaning hybrid. Sweet candy notes meet earthy, coffee-like Bubba funk. Effects are relaxing and sedating while maintaining mental clarity. Myrcene and caryophyllene dominant. Perfect for evening relaxation.',

  'Bubble Gum': 'A classic strain known for its distinct bubble gum aroma and flavor. Sweet, fruity, and nostalgic with floral undertones. The high is uplifting and euphoric, great for stress relief and mood enhancement. Caryophyllene and myrcene dominant. Old school flavor, timeless effects.',

  'Cali Candy': 'California genetics with sweet, candy-like terpenes. Fruity and sugary with citrus notes and subtle gas. The high is uplifting and creative, perfect for daytime activities. Limonene and caryophyllene work together for mood elevation. West Coast sweetness.',

  'Candy Fumez': 'A gas-forward candy strain with sweet and fuel notes competing for attention. Fruity candy meets diesel in a unique profile. Effects are potent and balanced—cerebral stimulation with body relaxation. Caryophyllene dominant with limonene support. For those who like their candy gassy.',

  'Candy Runtz': 'Pure candy expression from Runtz genetics. Sweet, fruity, and sugary with tropical notes. The high is euphoric and relaxing without heavy sedation. Caryophyllene and limonene create the classic candy-gas profile. Crowd favorite for flavor chasers.',

  'Carolina Cola': 'A Southern-inspired strain with sweet cola and vanilla notes. Unique profile reminiscent of classic soda with earthy undertones. Effects are relaxing and nostalgic—comfort in flower form. Caryophyllene and myrcene dominant. Something different for adventurous palates.',

  'Cherry Popper': 'A cherry-dominant hybrid with sweet, fruity flavors and subtle earthiness. Ripe cherry and berry notes with floral accents. The high is uplifting and giggly, perfect for social situations. Limonene and myrcene work together. Fun and flavorful.',

  'Clementine Orange': 'Tangie lineage delivers bright, citrus-forward terpenes. Sweet orange zest with tangerine and subtle floral notes. The high is energizing and uplifting—perfect morning strain. Limonene dominant with terpinolene support. Sunshine in flower form.',

  'Cold Clementine': 'Clementine genetics with a cooling, refreshing twist. Bright citrus meets subtle menthol notes for a unique experience. Effects are uplifting and clear-headed. Limonene and pinene dominant. Refreshing daytime option.',

  'Dantes Inferno': 'A fiery indica cross with intense potency and complex flavors. Spicy, earthy, and pungent with OG undertones. Effects are heavy and sedating—true hell-fire relaxation. Myrcene and caryophyllene dominant. For experienced users seeking intensity.',

  'Detroit Candy': 'Motor City genetics with sweet, candy-forward terpenes. Fruity and gassy with urban edge. The high is potent and balanced—euphoric head, relaxed body. Caryophyllene and limonene shine. Detroit pride in flower form.',

  'Diamond Runtz': 'Premium Runtz phenotype with exceptional trichome coverage. Sweet candy and cream with extra sparkle. Effects are potent—euphoric and relaxing. Caryophyllene, limonene, and linalool create a complex profile. Top-shelf exotic.',

  'Dolce': 'Italian for "sweet," this strain delivers on its name. Dessert-like flavors with vanilla, cream, and subtle fruit. The high is relaxing and happy, perfect for unwinding. Caryophyllene and limonene dominant. Elegant and smooth.',

  'Fig Bar': 'A unique dessert strain with fig, cookie, and earthy notes. Sweet and nutty with subtle spice. Effects are relaxing and calming without heavy sedation. Caryophyllene and myrcene dominant. Something special for adventurous tastes.',

  'Fizz': 'An effervescent strain with bright, bubbly terpenes. Citrus, tropical, and sweet with a sparkling quality. The high is uplifting and energetic—like carbonation for the mind. Limonene and terpinolene dominant. Fun and refreshing.',

  'Fizzy Lemonade': 'Lemon genetics with effervescent, bright terpenes. Sweet-tart lemonade flavor with bubbly citrus notes. Effects are uplifting and mood-enhancing. Limonene dominant with terpinolene support. Summer refreshment year-round.',

  'Fizzy Punch': 'Fruit punch flavors with a fizzy, effervescent quality. Multiple fruit notes blend into a sparkling experience. The high is social and uplifting. Limonene and myrcene work together. Party-ready terpenes.',

  'G33': 'Gelato 33 phenotype from Sunset Sherbet x Thin Mint Cookies. Creamy, sweet, and potent with dessert-like flavors. Effects are balanced—euphoric and relaxing. Caryophyllene, limonene, and humulene create complexity. Cookie Fam excellence.',

  'Garlic Breath': 'GMO lineage delivers intense garlic and fuel aromas. Savory, pungent, and unmistakable. Effects are heavy and relaxing—sedating for experienced users. Myrcene and caryophyllene dominant. For those who appreciate funky terpenes.',

  'Garlic Cookies': 'GMO x Girl Scout Cookies creates this savory-sweet hybrid. Garlic and diesel meet cookie dough and earth. Effects are potent and sedating. Caryophyllene and myrcene dominant. Unique profile for adventurous palates.',

  'Garlicane': 'Garlic genetics meet Slurricane in this pungent cross. Savory garlic and fuel with sweet grape undertones. Effects are heavy and relaxing. High caryophyllene and myrcene. Bold flavors for funk enthusiasts.',

  'Gas Butter': 'Fuel-forward genetics with creamy, smooth undertones. Gassy and buttery with earthy depth. Effects are potent and relaxing. Caryophyllene dominant with myrcene support. Rich and indulgent.',

  'Gas House Runtz': 'Runtz with extra gas from fuel-forward genetics. Sweet candy meets diesel fuel in a potent combination. Effects are strong—euphoric and sedating. Caryophyllene and limonene shine. For those who like it gassy.',

  'Gascan Runtz': 'High-octane Runtz cross with intense fuel notes. Sweet and gassy with extra punch. Effects are potent and balanced. Caryophyllene and limonene dominant. Premium gas station.',

  'Gelato 15': 'Cookie Fam phenotype from Thin Mint x Sunset Sherbet. Creamy, sweet, and dessert-like with heavy effects. Relaxing and euphoric—strong indica lean. Caryophyllene and limonene dominant. Dessert-level quality.',

  'Gelato 33': 'The Larry Bird cut—most famous Gelato phenotype. Sunset Sherbet x Thin Mint Cookies delivers creamy, sweet, and citrusy flavors. Effects are balanced but potent—happy, relaxed, creative. Caryophyllene, limonene, and humulene. Industry standard for quality.',

  'Gelato Cookies': 'Gelato crossed with GSC genetics for double dessert power. Creamy, sweet, and cookie-forward with subtle mint. Effects are relaxing and euphoric. Caryophyllene and limonene dominant. Cookie lovers rejoice.',

  'Girl Scout Cookie': 'The original GSC—OG Kush x Durban Poison. Earthy, sweet, and minty with subtle spice. Effects are euphoric and relaxing, perfect for stress relief. Caryophyllene, limonene, and humulene. A legend for good reason.',

  'Glitter Bomb': 'An explosion of trichomes and flavor. Sweet and sparkly with fruity, gassy notes. Effects are potent and balanced. High caryophyllene and limonene. Eye candy that delivers serious effects.',

  'GMO': 'Garlic, Mushroom, Onion—the funk is real. Chemdog x Girl Scout Cookies creates intense savory flavors with diesel undertones. Effects are heavy and sedating—potent for experienced users. Myrcene and caryophyllene dominant. Connoisseur-grade funk.',

  'Grape gas': 'Grape Pie meets fuel genetics for purple, gassy goodness. Sweet grape and candy with diesel finish. Effects are relaxing and euphoric. Caryophyllene and linalool shine. Beautiful color, bold flavor.',

  'Green Apple Runtz': 'Runtz with sour green apple expression. Tart, fruity, and candy-sweet with gas undertones. Effects are uplifting and balanced. Limonene and caryophyllene dominant. Sour candy vibes.',

  'Guava': 'Tropical genetics with authentic guava flavor. Sweet, fruity, and exotic with floral notes. Effects are uplifting and relaxing. Myrcene and limonene create tropical vibes. Island vacation in a jar.',

  'Ice Cream Cake': 'Wedding Cake x Gelato 33 creates this dessert masterpiece. Creamy vanilla, sugary dough, and subtle cheese. Effects are deeply relaxing and sedating. High myrcene and caryophyllene. Nighttime indulgence.',

  'Iced Berry': 'Frozen berry genetics with cooling terpenes. Sweet berry with menthol freshness. Effects are balanced and refreshing. Myrcene and pinene work together. Cool and fruity.',

  'Japanese Peaches': 'Exotic genetics with delicate peach flavors. Sweet, floral, and refined with subtle earthiness. Effects are calming and euphoric. Myrcene and limonene dominant. Premium fruit expression.',

  'Jealousy': 'Seed Junky creation from Gelato 41 x Sherbert Bx1. Complex flavors—fuel, fruit, cream, and funk. Effects are potent and balanced—cerebral stimulation with body relaxation. Caryophyllene and limonene dominant. Modern exotic excellence.',

  'Jet Fuel': 'High-octane sativa from Aspen OG x High Country Diesel. Pure diesel and skunk with citrus notes. Effects are energizing and focused—rocket fuel for productivity. Pinene and caryophyllene dominant. Launch sequence initiated.',

  'Jungle Cake': 'Wedding Cake x White Fire #43 creates this potent hybrid. Vanilla, earth, and fuel with cookie undertones. Effects are strong—relaxing and euphoric. Caryophyllene and limonene shine. Jungle strength.',

  'Kept Secret': 'A mysterious hybrid with complex, hard-to-pin flavors. Sweet, earthy, and gassy with subtle fruit. Effects are balanced and long-lasting. Caryophyllene dominant. The secret is out.',

  'Kush Mintz': 'Bubba Kush x Animal Mints brings mint and earth together. Cool menthol meets earthy OG funk. Effects are relaxing and calming with mental clarity. Caryophyllene and myrcene dominant. Minty freshness with kush depth.',

  'LA O.G.': 'Los Angeles OG Kush—the West Coast original. Earthy, piney, and diesel with lemon notes. Effects are classic OG—relaxing, euphoric, and appetite-inducing. Myrcene and caryophyllene. LA legend.',

  'Lava Cake': 'Thin Mint GSC x Grape Pie creates molten dessert vibes. Chocolate, berry, and mint with subtle grape. Effects are deeply relaxing and sedating. Myrcene and caryophyllene dominant. Erupts with flavor.',

  'Lemon Cherry Diesel': 'Triple threat genetics combining lemon, cherry, and diesel. Citrus, fruit, and fuel in complex harmony. Effects are balanced—uplifting with relaxation. Limonene and caryophyllene shine. Three-dimensional flavor.',

  'Lemon Cherry Gelato': 'Sunset Sherbet x GSC with lemon cherry expression. Sweet, sour, and creamy with complex fruit layers. Effects are potent and balanced. Limonene, caryophyllene, and humulene. Modern classic.',

  'Lemon Cherry Runtz': 'Runtz with lemon cherry influence. Candy, citrus, and cherry in sweet harmony. Effects are euphoric and relaxing. Limonene and caryophyllene dominant. Fruit salad excellence.',

  'Lemon Ginger': 'Unique cross with citrus and spice notes. Bright lemon meets warming ginger for an invigorating experience. Effects are uplifting and clear-headed. Limonene and caryophyllene work together. Different and delicious.',

  'Lemon Runtz': 'Runtz with dominant lemon terpenes. Sweet candy meets bright citrus. Effects are balanced and uplifting. Limonene and caryophyllene create zesty sweetness. Sour patch perfection.',

  'Lemon Tree': 'Lemon Skunk x Sour Diesel delivers pure citrus power. Bright lemon with diesel undertones and sweet notes. Effects are uplifting and energetic. High limonene content. Citrus lovers dream.',

  'Lighter': 'Fire OG genetics with intense potency. Gassy, earthy, and piney with classic OG profile. Effects are strong and relaxing. Myrcene and caryophyllene dominant. Spark it up.',

  'London Jelly': 'UK genetics with sweet, fruity jelly flavors. Grape, berry, and candy with subtle earthiness. Effects are relaxing and euphoric. Caryophyllene and myrcene shine. British sweetness.',

  'London Pound Cake': 'Sunset Sherbet genetics with cake-like sweetness. Vanilla, berry, and lemon with creamy undertones. Effects are relaxing and happy. Limonene and caryophyllene dominant. Dessert from across the pond.',

  'Mac Cocktail': 'MAC crossed with fruity genetics for complex flavors. Creamy, citrus, and exotic with gas undertones. Effects are balanced and long-lasting. Caryophyllene and limonene dominant. Premium blend.',

  'Malibu Kush': 'California coastal OG with ocean-inspired vibes. Earthy, piney, and citrusy with relaxing effects. Perfect for unwinding like a beach sunset. Myrcene and caryophyllene dominant. West Coast relaxation.',

  'Mallow Runtz': 'Runtz meets marshmallow sweetness. Fluffy, sweet, and pillowy with candy undertones. Effects are relaxing and euphoric. Caryophyllene and limonene create dessert vibes. Soft and sweet.',

  'Mango Trees': 'Tropical genetics with authentic mango flavor. Sweet, fruity, and exotic with earthy depth. Effects are relaxing and mood-enhancing. Myrcene dominant with limonene support. Tropical getaway.',

  'McFlurry': 'Dessert strain with creamy, sweet ice cream vibes. Vanilla, cookie, and subtle fruit blend together. Effects are relaxing and happy. Caryophyllene and limonene dominant. Drive-thru quality.',

  'Molotov Cocktails': 'Explosive hybrid with fruity, gassy intensity. Multiple fruit notes meet fuel for a potent combination. Effects are strong and energizing. Caryophyllene and limonene shine. Handle with care.',

  'Orange Candy Crush': 'Orange soda meets candy sweetness. Bright citrus and sugar with playful energy. Effects are uplifting and social. Limonene dominant with terpinolene support. Crushing it.',

  'Oreo Blizzard': 'Cookies and cream genetics with frosty coverage. Sweet, creamy, and dessert-like with chocolate notes. Effects are relaxing and happy. Caryophyllene and limonene dominant. Blizzard of flavor.',

  'Oreos': 'Cookies Fam genetics with classic cookie flavor. Sweet, creamy, and dank with chocolate undertones. Effects are balanced and euphoric. Caryophyllene and limonene shine. Twist, lick, dunk.',

  'Pancakes': 'London Pound Cake x Kush Mints creates breakfast vibes. Maple, butter, and sweet dough with minty finish. Effects are relaxing and happy. Caryophyllene and myrcene dominant. Breakfast of champions.',

  'Papaya Jam': 'Tropical papaya genetics with jammy sweetness. Sweet, fruity, and smooth with exotic notes. Effects are relaxing and uplifting. Myrcene and limonene work together. Spread the love.',

  'Peanut Butter Breath': 'Do-Si-Dos x Mendo Breath creates nutty, earthy excellence. Peanut butter and chocolate with herbal notes. Effects are deeply relaxing and sedating. Caryophyllene and myrcene dominant. Smooth and nutty.',

  'Permanent Marker': 'Seed Junky creation with intense gas and sweetness. Markers, fuel, and fruit in a unique combination. Effects are potent and long-lasting. Caryophyllene and limonene dominant. Leaves its mark.',

  'Pez Candy': 'Classic candy vibes in flower form. Sweet, fruity, and nostalgic with multi-flavor complexity. Effects are uplifting and happy. Limonene and myrcene work together. Dispenser not included.',

  'Pink Lady': 'Elegant pink phenotype with floral sweetness. Sweet, smooth, and refined with subtle berry. Effects are balanced and calming. Caryophyllene and linalool shine. Ladylike but potent.',

  'Pink Lemonade': 'Lemonade genetics with pink berry influence. Sweet, tart, and refreshing with fruity complexity. Effects are uplifting and social. Limonene dominant with myrcene support. Summer in a jar.',

  'Pink Runtz': 'Pink phenotype of the Runtz family. Sweet, fruity, and candy-like with extra color. Effects are euphoric and relaxing. Caryophyllene and limonene create the signature profile. Pretty and potent.',

  'Pink Soufflé': 'Fluffy dessert strain with delicate sweetness. Airy, sweet, and refined with vanilla notes. Effects are relaxing and calming. Caryophyllene and linalool dominant. French pastry elegance.',

  'Pop 41': 'Gelato 41 genetics with popping terpenes. Loud, sweet, and modern with complex flavors. Effects are potent and balanced. Caryophyllene and limonene shine. Trending for good reason.',

  'Popz Runtz': 'Runtz with extra pop and color. Sweet, candy, and fruity with enhanced visual appeal. Effects are euphoric and uplifting. Caryophyllene and limonene dominant. Popping off.',

  'Project Z': 'Experimental genetics with complex, unique flavors. Mysterious and multidimensional with unexpected notes. Effects are potent and intriguing. Caryophyllene dominant with varied support. The unknown awaits.',

  'Pure Michigan': 'Midwest pride in flower form. Oreoz x Mendo Breath creates sweet, creamy, earthy excellence. Effects are relaxing and euphoric. Caryophyllene and myrcene dominant. Great Lakes quality.',

  'Puro Loco': 'Crazy pure genetics with intense potency. Bold, loud, and unapologetic with complex flavors. Effects are strong and lasting. Caryophyllene dominant. Pure madness.',

  'Runtz': 'The original—Zkittlez x Gelato that started a movement. Sweet candy, tropical fruit, and creamy gas. Effects are balanced—euphoric, relaxing, and long-lasting. Caryophyllene and limonene create the signature. Industry-defining genetics.',

  'SCP': 'Secure, Contain, Protect—potent and mysterious. Complex flavors with gas and fruit notes. Effects are strong and balanced. Caryophyllene dominant with varied terpenes. Classified potency.',

  'Sherb Cream Pie': 'Sunset Sherbet meets Pie genetics for creamy, fruity excellence. Sweet, tropical, and smooth with dessert depth. Effects are relaxing and euphoric without heavy sedation. Caryophyllene and limonene dominant. Creamy dream.',

  'Sinmint': 'Sin City meets mint in this Cookies family member. Minty, earthy, and potent with OG undertones. Effects are relaxing with mental clarity. Caryophyllene and myrcene dominant. Sinfully good.',

  'Sour Diesel': 'East Coast legend from the 90s. Diesel, citrus, and skunk in the classic combination. Effects are energizing and cerebral—legendary sativa power. Caryophyllene and limonene dominant. The original fuel.',

  'Sour Guava': 'Tropical guava with sour genetics. Tangy, sweet, and exotic with funky undertones. Effects are uplifting and balanced. Limonene and myrcene work together. Sour tropical punch.',

  'Sour Runtz': 'Runtz with sour expression. Tangy candy meets sweet gas for perfect balance. Effects are euphoric and uplifting. Caryophyllene and limonene dominant. Sweet and sour perfection.',

  'Specimen X': 'Experimental genetics with unknown origins. Complex, mysterious, and potent with varied flavors. Effects are strong and unpredictable. Caryophyllene dominant. The experiment continues.',

  'Sprite': 'Lemon-lime freshness in flower form. Bright, clean, and refreshing with citrus clarity. Effects are uplifting and clear-headed. Limonene dominant with terpinolene. Obey your thirst.',

  'Strawberry Cheesecake': 'Sweet strawberry meets creamy cheesecake. Fruity, tangy, and dessert-like with complex sweetness. Effects are relaxing and happy. Caryophyllene and myrcene dominant. Dessert cart worthy.',

  'Strawberry Milkshake': 'Creamy strawberry blended to perfection. Sweet, fruity, and smooth with vanilla notes. Effects are relaxing and euphoric. Myrcene and caryophyllene work together. Shake it up.',

  'Strawberry Shortcake': 'Classic dessert genetics with strawberry and cake. Sweet berry and vanilla with subtle cream. Effects are relaxing and mood-enhancing. Caryophyllene and myrcene dominant. Summer classic.',

  'Strawnana': 'Strawberry Banana—Banana Kush x Bubblegum Strawberry. Sweet fruit fusion with tropical depth. Effects are relaxing and happy. Myrcene and caryophyllene dominant. Smoothie bowl genetics.',

  'Super Boof': 'Amplified boof genetics with extra funk. Gassy, earthy, and loud with unique character. Effects are potent and balanced. Caryophyllene dominant. Super-charged weirdness.',

  'Super Lemon Haze': 'Two-time Cannabis Cup winner. Lemon Skunk x Super Silver Haze delivers bright citrus and energizing effects. Sharp lemon with sweet, earthy undertones. Limonene and terpinolene dominant. Legendary sativa.',

  'Super Runtz': 'Runtz on overdrive. Extra sweet, extra gassy, extra everything. Effects are potent and long-lasting. Caryophyllene and limonene amplified. Super-sized excellence.',

  'Super Skunk': 'Classic Skunk #1 enhanced. Earthy, pungent, and unmistakably skunky with sweet notes. Effects are relaxing and euphoric. Myrcene and caryophyllene dominant. Old school, super strength.',

  'Super Sonic': 'Fast-hitting sativa with energizing effects. Bright, citrusy, and speedy with clear-headed power. Effects are immediate and uplifting. Limonene and pinene dominant. Gotta go fast.',

  'Sweetarts': 'Classic candy flavor translated to flower. Sweet, tart, and fruity with multi-flavor complexity. Effects are uplifting and happy. Limonene and caryophyllene work together. Candy aisle nostalgia.',

  'Sweeties': 'Pure sweetness in flower form. Sugary, candy-like, and smooth with maximum sweetness. Effects are relaxing and mood-enhancing. Caryophyllene and limonene dominant. Sweet tooth satisfaction.',

  'Thin Mint Cookies': 'GSC phenotype with dominant mint expression. Minty chocolate cookie dough with earthy undertones. Effects are relaxing and euphoric. Caryophyllene and limonene dominant. Girl Scout favorite.',

  'Trainwreck': 'Legendary sativa-dominant hybrid from California. Mexican and Thai sativas with Afghani indica. Lemon, pine, and spice with powerful cerebral effects. Terpinolene and myrcene dominant. Full speed ahead.',

  'Tropic Fury': 'Tropical storm of terpenes. Mango, pineapple, and passion fruit in fury mode. Effects are uplifting and energizing. Myrcene and limonene create island intensity. Tropical explosion.',

  'Wedding Cake': 'Triangle Kush x Animal Mints creates celebration-worthy excellence. Vanilla frosting, tangy earth, and subtle pepper. Effects are relaxing and euphoric. Caryophyllene and limonene dominant. Worth celebrating.',

  'White Runtz': 'White phenotype of Runtz with enhanced trichome coverage. Sweet, creamy, and potent with classic candy-gas profile. Effects are balanced and long-lasting. Caryophyllene and limonene shine. White-out quality.',

  'Yellow Zushi': 'Zushi with yellow terpene expression. Sweet, exotic, and rare with unique color. Effects are potent and balanced. Caryophyllene and limonene dominant. Golden ticket genetics.',

  'Zarati': 'Exotic genetics with mysterious origins. Complex flavors with sweet and earthy notes. Effects are potent and intriguing. Caryophyllene dominant. Ancient wisdom, modern fire.',

  'Zushi': 'Zkittlez x Kush Mints creates exotic excellence. Sweet candy meets gassy mint in perfect harmony. Effects are potent—euphoric and relaxing. Caryophyllene and limonene dominant. Hype that delivers.',

  // === CONCENTRATES ===
  'Badder': 'Creamy, terp-rich concentrate with butter-like consistency. Full-spectrum extraction preserves the entourage effect. Smooth dabs with maximum flavor. Best at low temps for terp preservation. Dab-ready potency in every scoop.',

  'Diamonds': 'Pure THCa crystals—the pinnacle of concentration. Isolated cannabinoid structures with maximum potency. Add to bowls, dab alone, or pair with terp sauce. Crystal clarity and power. For experienced users seeking intensity.',

  'Hash': 'Traditional pressed trichome heads. Old-world craftsmanship meets modern quality standards. Earthy, authentic, and potent. Smoke in bowls, roll with joints, or press into rosin. Timeless cannabis craft.',

  'Live Resin': 'Flash-frozen, fresh-plant extraction. Maximum terpene preservation captures the living plant profile. Full-spectrum cannabinoids with authentic flavor. Dab at low temps for the real experience. Fresh-frozen excellence.',

  'Live Rosin': 'Solventless, heat-pressed from fresh-frozen bubble hash. The cleanest concentrate method—no solvents, pure plant. Premium terpenes, maximum flavor, connoisseur-grade quality. Low-temp dabs for the full experience. Hash rosin purity.',

  'Rosin': 'Solventless, heat-pressed concentrate from cured flower or hash. No solvents—just heat and pressure. Clean, potent, and flavorful. Perfect for health-conscious consumers. Pure plant expression.',

  'Shatter': 'Glass-like concentrate with high stability. Clean extraction creates translucent, stable consistency. Potent and long-lasting with preserved cannabinoids. Easy to handle and portion. Classic concentrate done right.',

  'Sugar': 'Crystalline concentrate with terp-rich sauce. Sugar-like crystals suspended in flavorful liquid. Full-spectrum effects with excellent flavor. Dab-ready consistency for easy use. Sweet and potent.',

  'Wax': 'Versatile concentrate with soft, workable consistency. Easy to handle and portion for any method. Full-spectrum effects with good flavor retention. Great for beginners and experienced users alike. Classic and reliable.',

  // === GUMMIES (scratch-made, no artificial sweeteners/dyes) ===
  'Apple Gummies': 'Scratch-made with real fruit and zero artificial sweeteners or dyes. Crisp green apple flavor crafted from natural ingredients. Clean dosing with authentic taste. No lab flavors—just real apple. Handcrafted edible excellence.',

  'Blackberry Lemonade Gummies': 'Scratch-made with no artificial sweeteners or dyes. Tart lemonade meets sweet blackberry in natural harmony. Real fruit flavors, clean ingredients, consistent dosing. Summer refreshment crafted right. Handmade quality.',

  'Blueberry Gummies': 'Scratch-made from real ingredients—no artificial sweeteners or dyes ever. Deep, authentic blueberry flavor in every piece. Clean edibles for conscious consumers. Natural fruit, natural color, natural taste. Craft quality.',

  'Blueberry Lemonade Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Bright lemon zest balanced by ripe blueberry sweetness. Real fruit flavors in clean, consistent doses. Refreshing and authentic. Handcrafted excellence.',

  'Cherry Gummies': 'Scratch-made with no artificial sweeteners or dyes. Bold cherry flavor crafted from real ingredients. Sweet, tart, and naturally colored. Clean dosing you can trust. Cherry done right.',

  'Cola Gummies': 'Scratch-made cola flavor without a single artificial sweetener or dye. Classic soda vibes from natural ingredients. Nostalgic taste with clean craft. Consistent dosing, authentic flavor. Something different.',

  'Fruit Punch Gummies': 'Scratch-made with no artificial sweeteners or dyes. Classic fruit punch flavor from real ingredients. Multiple fruit notes blend naturally. Clean dosing, authentic taste. Party-ready without the chemicals.',

  'Grape Gummies': 'Scratch-made grape perfection—no artificial sweeteners or dyes. Bold Concord grape flavor from real ingredients. Natural purple color, authentic taste. Clean dosing for conscious consumers. Grape done right.',

  'Green Apple Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Sour green apple punch from natural ingredients. Tart, tangy, and authentically flavored. Clean craft in every bite. Sour apple excellence.',

  'Green Tea Gummies': 'Scratch-made with no artificial sweeteners or dyes. Earthy green tea flavor with subtle natural sweetness. Unique and refined for adventurous palates. Clean dosing, authentic taste. Something different.',

  'Honey Gummies': 'Scratch-made with real honey—no artificial sweeteners or dyes. Golden sweetness from natural ingredients. Clean, consistent dosing. Pure honey flavor, pure craft quality. Bee-inspired excellence.',

  'Kiwi Lime Gummies': 'Scratch-made with no artificial sweeteners or dyes. Tangy kiwi meets zesty lime from real ingredients. Tropical tartness in clean doses. Natural flavors, natural colors. Fresh and authentic.',

  'Lemon Drop Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Classic lemon drop flavor from natural ingredients. Bright citrus in clean, consistent doses. Pucker-worthy and pure. Sour excellence.',

  'Mango Gummies': 'Scratch-made tropical perfection—no artificial sweeteners or dyes. Ripe mango flavor from real fruit. Island vibes with clean ingredients. Consistent dosing, authentic taste. Tropical craft quality.',

  'Mixed Berry Gummies': 'Scratch-made berry medley with no artificial sweeteners or dyes. Strawberry, blueberry, and raspberry from real ingredients. Natural fruit harmony in clean doses. Craft quality, authentic flavor. Berry perfection.',

  'Mixed Fruit Gummies': 'Scratch-made fruit explosion without artificial sweeteners or dyes. Rainbow of real flavors from natural ingredients. Clean dosing, maximum variety. Taste the difference of craft quality. Naturally colorful.',

  'Orange Gummies': 'Scratch-made with no artificial sweeteners or dyes. Bright citrus from real orange. Sunshine flavor in clean, consistent doses. Natural ingredients, authentic taste. Citrus craft excellence.',

  'Peach Gummies': 'Scratch-made from real ingredients—zero artificial sweeteners or dyes. Sweet Georgia peach flavor done authentically. Summer harvest in every bite. Clean dosing, natural sweetness. Peachy perfection.',

  'Pineapple Gummies': 'Scratch-made tropical treat with no artificial sweeteners or dyes. Tangy pineapple from real fruit. Clean, bright, and perfectly balanced. Vacation vibes, natural ingredients. Island craft quality.',

  'Raspberry Gummies': 'Scratch-made with zero artificial sweeteners or dyes. Sweet-tart raspberry from real ingredients. Bold berry flavor in clean doses. Craft quality, natural color. Raspberry done right.',

  'Sour Gummies': 'Scratch-made pucker power without artificial sweeteners or dyes. Tangy coating over fruity centers from real ingredients. Natural sour, clean craft. Consistent dosing, authentic tartness. Sour excellence.',

  'Strawberry Gummies': 'Scratch-made strawberry perfection—no artificial sweeteners or dyes. Sweet berry flavor from real fruit. Simple, clean, and delicious. Natural color, natural taste. Classic done right.',

  'Tropical Gummies': 'Scratch-made island escape with zero artificial sweeteners or dyes. Mango, pineapple, and passion fruit from real ingredients. Tropical paradise in clean doses. Craft quality, authentic flavors. Vacation in a gummy.',

  'Watermelon Gummies': 'Scratch-made summer sweetness—no artificial sweeteners or dyes. Juicy watermelon from real fruit. Refreshing flavor in clean, consistent doses. Natural ingredients, authentic taste. Summer craft perfection.',

  // === COOKIES (contain infused chocolate) ===
  'Brownies': 'Rich, fudgy brownies made with infused chocolate. Dense, decadent, and precisely dosed. Classic comfort elevated with premium craft. Real chocolate, real butter, real quality. Homestyle meets high.',

  'Chocolate Chip Cookies': 'Classic cookies loaded with infused chocolate chips. Crispy edges, chewy centers, perfect dosing. Real butter, real chocolate, real craft. Homestyle taste with consistent effects. Cookie perfection.',

  'Peanut Butter Cookies': 'Classic PB cookies made with infused chocolate. Nutty, sweet, and precisely dosed. Real peanut butter, real craft quality. Comfort food elevated to new heights. Perfectly balanced.',

  'Snickerdoodle Cookies': 'Cinnamon sugar cookies with infused chocolate. Warm, spiced, and consistently dosed. Real ingredients, holiday vibes year-round. Handcrafted with premium chocolate. Cozy craft quality.',

  // === CHOCOLATE (pure infused chocolate) ===
  'Cocoa Bites': 'Pure infused chocolate in bite-sized perfection. Rich cocoa flavor with precise, consistent dosing. Premium chocolate craft with clean ingredients. Smooth melt, potent effects. Chocolate done right.',

  'Mallows': 'Fluffy marshmallows dipped in pure infused chocolate. Sweet, pillowy clouds meet premium chocolate. Perfectly balanced sweetness with consistent dosing. Craft confection excellence. Something special.',

  'Milk Chocolate': 'Pure infused milk chocolate bar. Creamy, smooth, and classically delicious. Premium chocolate with precise dosing. Simple perfection, consistent effects. Chocolate purist approved.',

  'Neapolitan': 'Three layers of pure infused chocolate: vanilla, strawberry, and cocoa. Classic ice cream vibes in premium chocolate form. Consistent dosing across all layers. Nostalgic taste, modern craft. Triple threat.',

  // === PRE-ROLLS ===
  'Banana Smoothie 1.3g': 'Banana OG genetics rolled to perfection. Tropical banana and creamy smoothie flavors with relaxing effects. Pre-rolled for convenience, crafted for quality. Myrcene-forward with sweet terps. Ready to enjoy.',

  'Caramel Delight 2.5g': 'Sweet caramel and vanilla notes in a hefty pre-roll. Dessert-forward terpenes with earthy undertones. Smooth, indulgent smoke with relaxing effects. Big roll for sharing or solo sessions. Treat yourself.',

  'Fire Breath 2.5g': 'Hot gas meets fruity fire in this potent pre-roll. Pungent, powerful, and packed for strong sessions. Intense effects for experienced consumers. Hefty 2.5g roll. Handle with respect.',

  'Gas Clay / Gaslicious Clay 1.3g': 'Fuel-forward funk with earthy clay notes. Dense, gassy genetics rolled for convenience. Potent effects, premium quality. Pre-roll ready for instant sessions. Gas lovers rejoice.',

  'Grape Gas 2.5g': 'Grape Pie genetics with pure fuel in a big roll. Sweet purple terps meet gassy power. Relaxing effects with flavor depth. 2.5g of premium flower. Share or savor.',

  'Gummy Bear 1.3g': 'Sweet candy terps in convenient pre-roll form. Fruity, fun, and smooth smoking. Uplifting effects, playful vibes. Like smoking your favorite gummy. Easy enjoyment.',

  'Kush Mint 1.3g': 'Bubba Kush meets Animal Mints—rolled to go. Minty, gassy, and relaxing with kush depth. Pre-rolled convenience, premium quality. Classic genetics, modern format. Mint condition.',

  'Mellow Flower 2.5g': 'Gentle, balanced hybrid for easy sessions. Floral and smooth with mild effects. Hefty pre-roll for mellow vibes. Perfect for relaxed occasions. Easy going.',

  'Rocky Road 2.5g': 'Chocolate, nut, and marshmallow terps in a big roll. Dessert genetics packed for pleasure. Sweet smoke with relaxing effects. 2.5g of indulgence. Treat yourself.',

  'Sour Diesel 2.5g': 'East Coast legend in pre-roll form. Diesel fuel and citrus from classic genetics. Energizing sativa effects, hefty 2.5g roll. Pre-rolled convenience, legendary quality. Fuel up.',

  'Sour Garlic 1.3g': 'GMO funk meets sour power in convenient form. Pungent, savory, and potent effects. Pre-rolled for garlic strain enthusiasts. Bold flavors, easy enjoyment. Funky fresh.',
}

async function main() {
  console.log('Updating all product descriptions with informative content...\n')

  let updated = 0
  let failed = 0
  let notFound = 0

  for (const [name, description] of Object.entries(DESCRIPTIONS)) {
    const { data, error } = await supabase
      .from('products')
      .update({ description })
      .eq('vendor_id', VENDOR_ID)
      .eq('name', name)
      .select('id')

    if (error) {
      console.error(`❌ ${name}: ${error.message}`)
      failed++
    } else if (!data || data.length === 0) {
      console.log(`⚠️ ${name}: NOT FOUND`)
      notFound++
    } else {
      console.log(`✅ ${name}`)
      updated++
    }
  }

  console.log(`\n✅ Updated: ${updated}`)
  console.log(`⚠️ Not found: ${notFound}`)
  console.log(`❌ Failed: ${failed}`)
}

main()
