import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

async function main() {
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('vendor_id', VENDOR_ID)
    .order('name')

  console.log('Categories for vendor:\n')
  categories?.forEach(cat => {
    console.log(`ID: ${cat.id}`)
    console.log(`Name: ${cat.name}`)
    console.log(`Slug: ${cat.slug}`)
    console.log(`Description: ${cat.description || 'NULL'}`)
    console.log(`Parent ID: ${cat.parent_id || 'NULL'}`)
    console.log(`Image: ${cat.image_url || 'NULL'}`)
    console.log(`Meta: ${JSON.stringify(cat.meta_data)}`)
    console.log('---')
  })
}
main()
