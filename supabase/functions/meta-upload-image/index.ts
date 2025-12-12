/**
 * Meta Upload Image Edge Function
 * Uploads an image to Meta for use in ad creatives
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

serve(async (req) => {
  console.log('meta-upload-image function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse multipart form data or JSON with base64
    const contentType = req.headers.get('content-type') || ''

    let vendorId: string
    let imageData: string // base64 encoded image
    let filename: string = 'image.jpg'

    if (contentType.includes('application/json')) {
      const body = await req.json()
      vendorId = body.vendorId
      imageData = body.imageData // base64 string
      filename = body.filename || filename
    } else {
      // Handle multipart form data
      const formData = await req.formData()
      vendorId = formData.get('vendorId') as string
      const file = formData.get('image') as File
      if (file) {
        const buffer = await file.arrayBuffer()
        imageData = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        filename = file.name
      } else {
        imageData = formData.get('imageData') as string
      }
    }

    if (!vendorId || !imageData) {
      return new Response(
        JSON.stringify({ error: 'vendorId and imageData are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the Meta integration for this vendor
    const { data: integration, error: intError } = await supabase
      .from('meta_integrations')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active')
      .single()

    if (intError || !integration) {
      throw new Error('Meta integration not found or not active')
    }

    const accessToken = integration.access_token_encrypted
    let adAccountId = integration.ad_account_id
    if (!adAccountId.startsWith('act_')) {
      adAccountId = `act_${adAccountId}`
    }

    console.log(`Uploading image for ad account: ${adAccountId}`)

    // Upload image to Meta
    // Meta accepts images as base64 encoded bytes
    const uploadResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/adimages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          access_token: accessToken,
          bytes: imageData,
          name: filename,
        }),
      }
    )

    const responseData = await uploadResponse.json()

    if (!uploadResponse.ok) {
      console.error('Image upload error:', responseData)
      const metaError = responseData.error
      throw new Error(metaError?.error_user_msg || metaError?.message || 'Failed to upload image')
    }

    // Response contains image hashes keyed by filename
    const images = responseData.images
    const imageInfo = images ? Object.values(images)[0] as any : null

    if (!imageInfo) {
      throw new Error('No image info returned from Meta')
    }

    console.log(`Image uploaded successfully. Hash: ${imageInfo.hash}`)

    // Save to database for reference
    const imageRecord = {
      vendor_id: vendorId,
      meta_image_hash: imageInfo.hash,
      filename,
      url: imageInfo.url || null,
      width: imageInfo.width || null,
      height: imageInfo.height || null,
      created_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabase
      .from('meta_images')
      .insert(imageRecord)

    if (saveError) {
      console.error('Failed to save image record to DB:', saveError)
      // Don't fail - image was uploaded successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageHash: imageInfo.hash,
        url: imageInfo.url,
        width: imageInfo.width,
        height: imageInfo.height,
        message: 'Image uploaded successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-upload-image error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to upload image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
