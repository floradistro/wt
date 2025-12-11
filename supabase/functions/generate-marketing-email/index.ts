/**
 * Generate Marketing Email Edge Function
 * Uses Claude AI to generate beautiful, unique marketing emails
 * Full creative control - Claude designs the entire email
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import Anthropic from 'npm:@anthropic-ai/sdk@0.37.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateRequest {
  prompt: string
  vendorId: string
}

serve(async (req) => {
  console.log('generate-marketing-email function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { prompt, vendorId }: GenerateRequest = await req.json()

    if (!prompt || !vendorId) {
      return new Response(
        JSON.stringify({ error: 'prompt and vendorId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get vendor info for branding
    const { data: vendor } = await supabase
      .from('vendors')
      .select('store_name, logo_url')
      .eq('id', vendorId)
      .single()

    const vendorName = vendor?.store_name || 'Store'
    const logoUrl = vendor?.logo_url || ''

    // Get vendor email settings
    const { data: emailSettings } = await supabase
      .from('vendor_email_settings')
      .select('reply_to')
      .eq('vendor_id', vendorId)
      .single()

    const supportEmail = emailSettings?.reply_to || 'support@floradistro.com'

    const anthropic = new Anthropic({ apiKey: anthropicApiKey })

    const systemPrompt = `You are an elite email designer creating stunning marketing emails. You have FULL creative control over the design.

CRITICAL: Return ONLY valid JSON, no markdown, no code blocks. Just raw JSON.

Return this exact JSON structure:
{"subject":"subject line here","previewText":"preview text here","html":"full html email here"}

DESIGN REQUIREMENTS:
- Create a COMPLETE, UNIQUE HTML email from scratch
- Make each email visually distinctive - vary layouts, colors, typography
- Use modern email design: gradients, cards, bold typography, whitespace
- Be creative with structure: hero sections, feature grids, testimonials, countdown timers
- Use inline CSS only (email compatible)
- Make it mobile responsive with max-width containers
- Include compelling imagery placeholders or emoji for visual interest

BRAND INFO:
- Store: ${vendorName}
- Logo: ${logoUrl || 'Use store name as text header'}
- Support: ${supportEmail}

STYLE VARIATIONS (rotate between these):
1. Bold & Modern: Large typography, gradient backgrounds, minimal
2. Elegant & Clean: Lots of whitespace, serif fonts, muted colors
3. Vibrant & Fun: Bright colors, playful elements, emoji accents
4. Professional & Corporate: Structured grid, brand colors, formal
5. Artsy & Creative: Asymmetric layouts, artistic elements, unique

Include at the bottom:
- Contact support link (mailto:${supportEmail})
- Unsubscribe placeholder link

The HTML must be a complete valid email document with DOCTYPE, html, head, body tags.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Create a stunning, unique marketing email for: ${prompt}

Remember: Return ONLY the JSON object, no other text.`,
        },
      ],
    })

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response')
    }

    // Parse JSON from response
    let emailData: {
      subject: string
      previewText: string
      html: string
    }

    try {
      let jsonStr = textContent.text.trim()

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (match) {
          jsonStr = match[1]
        }
      }

      // Find JSON object
      const startIdx = jsonStr.indexOf('{')
      const endIdx = jsonStr.lastIndexOf('}')
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1)
      }

      emailData = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response:', textContent.text)
      throw new Error('Failed to parse AI response as JSON')
    }

    return new Response(
      JSON.stringify({
        subject: emailData.subject,
        previewText: emailData.previewText,
        html: emailData.html,
        contentJson: { prompt }, // Store original prompt
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-marketing-email:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
