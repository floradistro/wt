/**
 * Send Email Edge Function
 * Production-ready email sending via Resend API
 *
 * Handles:
 * - Transactional emails (receipts, order confirmations, password resets)
 * - Marketing emails (campaigns, promotions)
 * - Email tracking (sends, opens, clicks)
 * - Vendor settings (from name/email, enable/disable)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { Resend } from 'https://esm.sh/resend@3.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendEmailRequest {
  // Email content
  to: string
  toName?: string
  subject: string
  html: string
  text?: string

  // Email type and tracking
  emailType: 'transactional' | 'marketing'
  category?: string // 'receipt', 'order_confirmation', 'password_reset', etc.

  // Vendor context
  vendorId: string
  customerId?: string
  orderId?: string
  campaignId?: string
  templateId?: string

  // Optional overrides
  fromName?: string
  fromEmail?: string
  replyTo?: string

  // Metadata
  metadata?: Record<string, any>
}

interface EmailSendRecord {
  vendor_id: string
  customer_id?: string
  order_id?: string
  campaign_id?: string
  template_id?: string
  email_type: string
  to_email: string
  to_name?: string
  from_email: string
  from_name: string
  reply_to?: string
  subject: string
  resend_email_id?: string
  status: string
  error_message?: string
  sent_at?: string
  metadata?: Record<string, any>
}

serve(async (req) => {
  console.log('📧 send-email function invoked')
  console.log('📧 Request method:', req.method)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📧 Processing email request...')
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Resend client
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    const resend = new Resend(resendApiKey)

    // Parse request body
    const body: SendEmailRequest = await req.json()
    const {
      to,
      toName,
      subject,
      html,
      text,
      emailType,
      category,
      vendorId,
      customerId,
      orderId,
      campaignId,
      templateId,
      fromName: overrideFromName,
      fromEmail: overrideFromEmail,
      replyTo: overrideReplyTo,
      metadata = {},
    } = body

    console.log(`📧 Sending ${emailType} email to ${to}`, {
      category,
      vendorId,
      subject,
    })

    // 1. Load vendor email settings
    const { data: vendorSettings, error: settingsError } = await supabase
      .from('vendor_email_settings')
      .select('*')
      .eq('vendor_id', vendorId)
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('❌ Error loading vendor email settings:', settingsError)
      throw new Error(`Failed to load vendor email settings: ${settingsError.message}`)
    }

    // 2. Check if email type is enabled
    if (vendorSettings) {
      const enabledChecks: Record<string, boolean | undefined> = {
        receipt: vendorSettings.enable_receipts,
        order_confirmation: vendorSettings.enable_order_confirmations,
        order_update: vendorSettings.enable_order_updates,
        loyalty_update: vendorSettings.enable_loyalty_updates,
        password_reset: vendorSettings.enable_password_resets,
        welcome: vendorSettings.enable_welcome_emails,
      }

      if (category && enabledChecks[category] === false) {
        console.warn(`⚠️ Email type '${category}' is disabled for vendor ${vendorId}`)
        return new Response(
          JSON.stringify({
            success: false,
            error: `Email type '${category}' is disabled`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Marketing emails check
      if (emailType === 'marketing' && !vendorSettings.enable_marketing) {
        console.warn(`⚠️ Marketing emails are disabled for vendor ${vendorId}`)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Marketing emails are disabled',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // 3. Check customer unsubscribe preferences (for marketing emails)
    if (emailType === 'marketing' && customerId) {
      const { data: preferences } = await supabase
        .from('customer_email_preferences')
        .select('unsubscribed_marketing')
        .eq('vendor_id', vendorId)
        .eq('customer_id', customerId)
        .single()

      if (preferences?.unsubscribed_marketing) {
        console.warn(`⚠️ Customer ${customerId} has unsubscribed from marketing emails`)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Customer has unsubscribed from marketing emails',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // 4. Determine from name/email
    const fromName = overrideFromName || vendorSettings?.from_name || 'Whaletools'
    const fromEmail = overrideFromEmail || vendorSettings?.from_email || 'noreply@whaletools.io'
    const replyTo = overrideReplyTo || vendorSettings?.reply_to

    // 5. Send email via Resend
    console.log(`📤 Sending via Resend from ${fromName} <${fromEmail}>`)

    const resendResponse = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: toName ? `${toName} <${to}>` : to,
      subject,
      html,
      text,
      reply_to: replyTo,
      tags: [
        { name: 'vendor_id', value: vendorId },
        { name: 'email_type', value: emailType },
        ...(category ? [{ name: 'category', value: category }] : []),
      ],
    })

    if (!resendResponse.data) {
      console.error('❌ Resend API error:', resendResponse.error)
      throw new Error(`Resend API error: ${JSON.stringify(resendResponse.error)}`)
    }

    console.log(`✅ Email sent successfully. Resend ID: ${resendResponse.data.id}`)

    // 6. Log email send to database
    const emailSendRecord: EmailSendRecord = {
      vendor_id: vendorId,
      customer_id: customerId,
      order_id: orderId,
      campaign_id: campaignId,
      template_id: templateId,
      email_type: emailType,
      to_email: to,
      to_name: toName,
      from_email: fromEmail,
      from_name: fromName,
      reply_to: replyTo,
      subject,
      resend_email_id: resendResponse.data.id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata,
    }

    const { error: insertError } = await supabase
      .from('email_sends')
      .insert(emailSendRecord)

    if (insertError) {
      console.error('❌ Error logging email send:', insertError)
      // Don't throw - email was sent successfully, logging is secondary
    } else {
      console.log('✅ Email send logged to database')
    }

    // 7. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        resendId: resendResponse.data.id,
        emailType,
        category,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('❌ Error in send-email function:', error)

    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
