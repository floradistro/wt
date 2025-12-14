/**
 * Setup variant inventory for e-commerce checkout testing
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uaednwpxursknmwdeejn.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Use WhaleTools vendor (has variant templates configured)
const vendorId = 'cd2e1122-d511-4edb-be5d-98ef274b4baf'

async function setup() {
  console.log('Setting up variant inventory for testing...\n')

  // Get variant template
  const { data: templates } = await supabase
    .from('category_variant_templates')
    .select('*')
    .eq('vendor_id', vendorId)
    .limit(1)

  console.log('Templates found:', templates?.length || 0)

  if (!templates || templates.length === 0) {
    console.log('No templates found')
    return
  }

  const template = templates[0]
  console.log('Using template:', template.variant_name, '(', template.id, ')')
  console.log('Category ID:', template.category_id)

  // Get a product in that category (or any product from vendor)
  let { data: products } = await supabase
    .from('products')
    .select('id, name, primary_category_id')
    .eq('vendor_id', vendorId)
    .eq('primary_category_id', template.category_id)
    .limit(1)

  console.log('Products in Flower category:', products?.length || 0)

  // If no products in Flower category, get any product
  if (!products || products.length === 0) {
    const { data: anyProducts } = await supabase
      .from('products')
      .select('id, name, primary_category_id')
      .eq('vendor_id', vendorId)
      .limit(1)
    products = anyProducts
    console.log('Using any product from vendor:', products?.length || 0)
  }

  if (!products || products.length === 0) {
    console.log('No products found for vendor')
    return
  }

  const product = products[0]
  console.log('Using product:', product.name, '(', product.id, ')')

  // Get a location
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .limit(1)

  console.log('Locations found:', locations?.length || 0)

  if (!locations || locations.length === 0) {
    console.log('No locations found')
    return
  }

  const location = locations[0]
  console.log('Using location:', location.name, '(', location.id, ')')

  // Create or update variant inventory
  console.log('\nCreating variant_inventory...')

  const { data: existing } = await supabase
    .from('variant_inventory')
    .select('id')
    .eq('product_id', product.id)
    .eq('variant_template_id', template.id)
    .eq('location_id', location.id)
    .single()

  if (existing) {
    console.log('Existing record found, updating...')
    const { error } = await supabase
      .from('variant_inventory')
      .update({ quantity: 15 })
      .eq('id', existing.id)

    if (error) {
      console.error('Update error:', error)
    } else {
      console.log('Updated to quantity: 15')
    }
  } else {
    console.log('Creating new record...')
    const { data: vi, error: viError } = await supabase
      .from('variant_inventory')
      .insert({
        vendor_id: vendorId,
        product_id: product.id,
        variant_template_id: template.id,
        location_id: location.id,
        quantity: 15,
      })
      .select()

    if (viError) {
      console.error('Insert error:', viError)
    } else {
      console.log('Created:', vi)
    }
  }

  // Verify
  const { data: verify } = await supabase
    .from('variant_inventory')
    .select('*')
    .eq('vendor_id', vendorId)
    .gt('quantity', 0)

  console.log('\nVariant inventory with qty > 0:', verify?.length || 0)
  if (verify && verify.length > 0) {
    console.log(JSON.stringify(verify, null, 2))
  }
}

setup().catch(console.error)
