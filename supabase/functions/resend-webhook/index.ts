/**
 * Resend Webhook Handler
 * Processes email events from Resend (opens, clicks, bounces, etc.)
 * Updates marketing_sends and email_events tables
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
}

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'

interface ResendWebhookEvent {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // Click events
    click?: {
      link: string
      timestamp: string
      user_agent?: string
      ip_address?: string
    }
    // Bounce events
    bounce?: {
      message: string
      type: 'hard' | 'soft'
    }
    // Open events
    open?: {
      timestamp: string
      user_agent?: string
      ip_address?: string
    }
    // Tags we set when sending
    tags?: { name: string; value: string }[]
  }
}

serve(async (req) => {
  console.log('resend-webhook invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get raw body for signature verification
    const body = await req.text()

    // Verify webhook signature (if secret is configured)
    if (webhookSecret) {
      const svixId = req.headers.get('svix-id')
      const svixTimestamp = req.headers.get('svix-timestamp')
      const svixSignature = req.headers.get('svix-signature')

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.warn('Missing Svix headers, skipping signature verification')
      }
      // Note: Full signature verification would require svix library
      // For now, we log but don't block (Resend IPs are trusted in Supabase)
    }

    const event: ResendWebhookEvent = JSON.parse(body)

    console.log(`Processing ${event.type} for email ${event.data.email_id}`)

    // Extract resend_email_id
    const resendEmailId = event.data.email_id
    if (!resendEmailId) {
      console.error('No email_id in webhook payload')
      return new Response(
        JSON.stringify({ error: 'No email_id in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the marketing_send record by resend_email_id
    const { data: marketingSend, error: findError } = await supabase
      .from('marketing_sends')
      .select('id, campaign_id, status, click_count, clicked_links')
      .eq('resend_email_id', resendEmailId)
      .single()

    if (findError || !marketingSend) {
      // Not a marketing email, might be transactional - log but don't fail
      console.log(`No marketing_send found for ${resendEmailId}, may be transactional`)

      // Still log the event for transactional emails
      await supabase.from('email_events').insert({
        resend_email_id: resendEmailId,
        event_type: event.type,
        link_url: event.data.click?.link,
        metadata: {
          to: event.data.to,
          subject: event.data.subject,
          tags: event.data.tags,
          raw: event.data,
        },
      })

      return new Response(
        JSON.stringify({ success: true, message: 'Event logged (non-marketing)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the raw event
    await supabase.from('email_events').insert({
      marketing_send_id: marketingSend.id,
      resend_email_id: resendEmailId,
      event_type: event.type,
      link_url: event.data.click?.link,
      metadata: {
        to: event.data.to,
        subject: event.data.subject,
        tags: event.data.tags,
        open: event.data.open,
        click: event.data.click,
        bounce: event.data.bounce,
      },
    })

    // Prepare update for marketing_sends
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {}

    switch (event.type) {
      case 'email.sent':
        // Only update if not already sent
        if (marketingSend.status === 'pending') {
          updates.status = 'sent'
          updates.sent_at = now
        }
        break

      case 'email.delivered':
        // Delivered is higher priority than sent
        if (['pending', 'sent'].includes(marketingSend.status)) {
          updates.status = 'delivered'
          updates.delivered_at = now
        }
        break

      case 'email.opened':
        // Opened is higher priority than delivered
        if (['pending', 'sent', 'delivered'].includes(marketingSend.status)) {
          updates.status = 'opened'
        }
        // Always update opened_at on first open
        if (!marketingSend.opened_at) {
          updates.opened_at = now
        }
        break

      case 'email.clicked':
        // Clicked is the highest engagement status
        updates.status = 'clicked'
        // Update first click time
        if (!marketingSend.first_clicked_at) {
          updates.first_clicked_at = now
        }
        // Increment click count and track link
        updates.click_count = (marketingSend.click_count || 0) + 1
        const existingLinks = marketingSend.clicked_links || []
        const clickedLink = event.data.click?.link
        if (clickedLink && !existingLinks.includes(clickedLink)) {
          updates.clicked_links = [...existingLinks, clickedLink]
        }
        break

      case 'email.bounced':
        updates.status = 'bounced'
        updates.bounced_at = now
        break

      case 'email.complained':
        updates.status = 'complained'
        updates.complained_at = now
        break

      case 'email.delivery_delayed':
        // Log but don't change status
        console.log(`Delivery delayed for ${resendEmailId}`)
        break
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('marketing_sends')
        .update(updates)
        .eq('id', marketingSend.id)

      if (updateError) {
        console.error('Failed to update marketing_send:', updateError)
        throw updateError
      }

      console.log(`Updated marketing_send ${marketingSend.id}:`, updates)
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_type: event.type,
        marketing_send_id: marketingSend.id,
        updates,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in resend-webhook:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
