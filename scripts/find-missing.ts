import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

async function main() {
  const { data } = await supabase
    .from('products')
    .select('name, description')
    .eq('vendor_id', VENDOR_ID)
    .order('name')

  console.log('Total products:', data?.length)

  // Find products with short descriptions (under 150 chars = old short ones)
  const shortDesc = data?.filter(p => p.description && p.description.length < 150) || []

  if (shortDesc.length > 0) {
    console.log(`\n⚠️ Products with short descriptions (${shortDesc.length}):\n`)
    shortDesc.forEach(p => {
      console.log(`- ${p.name} (${p.description?.length} chars)`)
    })
  }

  // Sample new descriptions
  console.log('\n--- Sample updated descriptions ---\n')
  const samples = ['Black Cherry Funk', 'Sherb Cream Pie', 'Apple Gummies', 'Milk Chocolate']
  for (const name of samples) {
    const product = data?.find(p => p.name === name)
    if (product) {
      console.log(`${name} (${product.description?.length} chars):`)
      console.log(`"${product.description}"`)
      console.log()
    }
  }
}
main()
