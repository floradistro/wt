import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

async function main() {
  const moonwaterFlavors = ['Berry Twist', 'Clementine Orange', 'Lemon Ginger', 'Fizzy Lemonade', 'Fizzy Punch', 'Carolina Cola']

  const { data } = await supabase
    .from('products')
    .select('id, name, custom_fields, description')
    .eq('vendor_id', VENDOR_ID)
    .in('name', moonwaterFlavors)
    .order('name')

  console.log('Current beverage descriptions:\n')
  data?.forEach(p => {
    const cf = p.custom_fields as any
    console.log(`${p.name} (${cf?.dosage} ${cf?.line}):`)
    console.log(`"${p.description}"`)
    console.log()
  })
}
main()
