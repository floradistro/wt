/**
 * Send Test Email Edge Function
 * Sends a single test email to verify campaign before mass send
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendTestRequest {
  vendorId: string
  toEmail: string
  subject: string
  htmlContent: string
}

serve(async (req) => {
  console.log('send-test-email function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    const { vendorId, toEmail, subject, htmlContent }: SendTestRequest = await req.json()

    if (!vendorId || !toEmail || !subject || !htmlContent) {
      return new Response(
        JSON.stringify({ error: 'vendorId, toEmail, subject, and htmlContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get vendor info
    const { data: vendor } = await supabase
      .from('vendors')
      .select('store_name')
      .eq('id', vendorId)
      .single()

    // Get email settings
    const { data: emailSettings } = await supabase
      .from('vendor_email_settings')
      .select('from_name, from_email, reply_to')
      .eq('vendor_id', vendorId)
      .single()

    const fromName = emailSettings?.from_name || vendor?.store_name || 'Store'
    const fromEmail = emailSettings?.from_email || 'noreply@floradistro.com'
    const replyTo = emailSettings?.reply_to

    console.log(`Sending test email to ${toEmail}`)

    // Send via Resend
    const resendResponse = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: toEmail,
      subject: `[TEST] ${subject}`,
      html: htmlContent,
      reply_to: replyTo,
      tags: [
        { name: 'vendor_id', value: vendorId },
        { name: 'email_type', value: 'test' },
      ],
    })

    if (resendResponse.error) {
      console.error('Resend error:', resendResponse.error)
      throw new Error(resendResponse.error.message)
    }

    console.log('Test email sent successfully:', resendResponse.data?.id)

    return new Response(
      JSON.stringify({
        success: true,
        emailId: resendResponse.data?.id,
        sentTo: toEmail,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-test-email:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
