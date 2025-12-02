import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const VENDOR_ID = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

async function main() {
  const desc = 'Dessert strain with chocolate, caramel, and fuel notes. Hot gas meets fudgy sweetness in a unique combination. Effects are relaxing and euphoric—indulgent without being overwhelming. Caryophyllene and myrcene create that sweet-gas balance. Decadent dessert vibes.'

  await supabase
    .from('products')
    .update({ description: desc })
    .eq('vendor_id', VENDOR_ID)
    .eq('name', 'Hot Gas Fudge')

  console.log('✅ Updated Hot Gas Fudge')
}
main()
