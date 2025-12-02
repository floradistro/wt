/**
 * COA Parser Edge Function
 *
 * Uses Claude Vision to extract data from Certificate of Analysis (COA) PDFs
 * and maps extracted values to product custom fields.
 *
 * Flow:
 * 1. Receive COA ID and product's category field definitions
 * 2. Fetch PDF from storage
 * 3. Send to Claude Vision for extraction
 * 4. Return structured field values
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface FieldDefinition {
  field_id: string
  label: string
  type: string
  description?: string
}

interface ParseCOARequest {
  coa_id: string
  product_id: string
  category_fields: FieldDefinition[]
  vendor_id: string
}

interface ParsedField {
  field_id: string
  value: string
  confidence: 'high' | 'medium' | 'low'
}

interface ParseCOAResponse {
  success: boolean
  parsed_fields: ParsedField[]
  lab_name?: string
  test_date?: string
  batch_number?: string
  error?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: ParseCOARequest = await req.json()
    const { coa_id, product_id, category_fields, vendor_id } = body

    if (!coa_id || !vendor_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: coa_id, vendor_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[parse-coa] Starting COA parse', { coa_id, product_id, fieldCount: category_fields?.length })

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch COA record
    const { data: coa, error: coaError } = await supabase
      .from('vendor_coas')
      .select('*')
      .eq('id', coa_id)
      .eq('vendor_id', vendor_id)
      .single()

    if (coaError || !coa) {
      console.error('[parse-coa] COA not found', coaError)
      return new Response(
        JSON.stringify({ error: 'COA not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!coa.file_url) {
      return new Response(
        JSON.stringify({ error: 'COA has no file URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[parse-coa] Fetching PDF from:', coa.file_url)

    // Download the PDF file
    const pdfResponse = await fetch(coa.file_url)
    if (!pdfResponse.ok) {
      console.error('[parse-coa] Failed to fetch PDF', pdfResponse.status)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch PDF file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()

    // Convert to base64 without stack overflow (chunked encoding)
    const bytes = new Uint8Array(pdfBuffer)
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, [...chunk])
    }
    const pdfBase64 = btoa(binary)

    console.log('[parse-coa] PDF fetched, size:', pdfBuffer.byteLength, 'base64 length:', pdfBase64.length)

    // Get Anthropic API key
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      console.error('[parse-coa] ANTHROPIC_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the field extraction prompt
    const fieldPrompt = category_fields?.length > 0
      ? `Extract values for these specific fields:\n${category_fields.map(f =>
          `- "${f.label}" (field_id: ${f.field_id}, type: ${f.type})${f.description ? `: ${f.description}` : ''}`
        ).join('\n')}`
      : 'Extract all cannabinoid percentages, terpene information, and test results you can find.'

    const systemPrompt = `You are a Certificate of Analysis (COA) data extraction specialist.
Your job is to accurately extract lab test results from COA documents.

Common fields to look for:
- THCa % / THCa percentage
- Delta-9 THC % / Δ9-THC %
- CBD %
- Total cannabinoids
- Terpene profiles (list of terpenes with percentages)
- Strain name / Genetics / Lineage
- Batch number
- Test date
- Lab name
- Pass/Fail status for contaminants (pesticides, heavy metals, microbials)

Return your response as valid JSON only, no markdown or explanation.`

    const userPrompt = `Analyze this Certificate of Analysis (COA) document and extract the test results.

${fieldPrompt}

Also extract these metadata fields if present:
- lab_name: The laboratory that performed the testing
- test_date: The date of testing (format: YYYY-MM-DD)
- batch_number: The batch/lot number

Return a JSON object with this exact structure:
{
  "parsed_fields": [
    { "field_id": "the_field_id", "value": "extracted value", "confidence": "high|medium|low" }
  ],
  "lab_name": "Lab Name or null",
  "test_date": "YYYY-MM-DD or null",
  "batch_number": "batch number or null"
}

For terpenes, combine them into a comma-separated string like "Myrcene, Limonene, Caryophyllene".
For percentages, include the number only (e.g., "28.5" not "28.5%").
Use "high" confidence for clearly visible values, "medium" for partially visible or inferred, "low" for uncertain.

Return ONLY the JSON object, no other text.`

    console.log('[parse-coa] Calling Claude API')

    // Call Claude API directly with fetch
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      console.error('[parse-coa] Claude API error:', claudeResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `AI service error: ${claudeResponse.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const claudeData = await claudeResponse.json()
    console.log('[parse-coa] Claude response received')

    // Extract text content from response
    const textContent = claudeData.content?.find((c: any) => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      console.error('[parse-coa] No text in Claude response')
      return new Response(
        JSON.stringify({ error: 'AI returned no text response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse JSON response
    let parsedResult: ParseCOAResponse
    try {
      // Clean up response - remove markdown code blocks if present
      let jsonText = textContent.text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7)
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3)
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3)
      }
      jsonText = jsonText.trim()

      const parsed = JSON.parse(jsonText)
      parsedResult = {
        success: true,
        parsed_fields: parsed.parsed_fields || [],
        lab_name: parsed.lab_name || null,
        test_date: parsed.test_date || null,
        batch_number: parsed.batch_number || null,
      }
    } catch (parseError) {
      console.error('[parse-coa] Failed to parse Claude response as JSON', parseError, textContent.text)
      return new Response(
        JSON.stringify({
          error: 'Failed to parse AI response',
          raw_response: textContent.text.substring(0, 500)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[parse-coa] Parsed fields:', parsedResult.parsed_fields.length)

    // Update COA record with parsed test_results
    const testResults: Record<string, any> = {}
    for (const field of parsedResult.parsed_fields) {
      testResults[field.field_id] = field.value
    }

    // Merge with existing test_results
    const mergedTestResults = {
      ...(coa.test_results || {}),
      ...testResults,
      _parsed_at: new Date().toISOString(),
      _parsed_by: 'claude-vision',
    }

    const { error: updateError } = await supabase
      .from('vendor_coas')
      .update({
        test_results: mergedTestResults,
        lab_name: parsedResult.lab_name || coa.lab_name,
        test_date: parsedResult.test_date || coa.test_date,
        batch_number: parsedResult.batch_number || coa.batch_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coa_id)

    if (updateError) {
      console.error('[parse-coa] Failed to update COA record', updateError)
      // Continue anyway, return parsed data
    }

    console.log('[parse-coa] COA parse complete', {
      fieldsExtracted: parsedResult.parsed_fields.length,
      labName: parsedResult.lab_name,
      testDate: parsedResult.test_date,
    })

    return new Response(
      JSON.stringify(parsedResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[parse-coa] Unexpected error:', error)
    console.error('[parse-coa] Stack:', error instanceof Error ? error.stack : 'No stack')
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
