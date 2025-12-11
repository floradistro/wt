/**
 * Send Marketing Campaign Edge Function
 * Sends marketing emails to all recipients in a campaign's audience
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendCampaignRequest {
  campaignId: string
}

serve(async (req) => {
  console.log('send-marketing-campaign function invoked', req.method)

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

    const { campaignId }: SendCampaignRequest = await req.json()

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'campaignId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    if (campaign.status !== 'draft') {
      return new Response(
        JSON.stringify({ error: `Campaign cannot be sent - current status: ${campaign.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update campaign status to sending
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId)

    // Get vendor info
    const { data: vendor } = await supabase
      .from('vendors')
      .select('store_name, logo_url')
      .eq('id', campaign.vendor_id)
      .single()

    // Get email settings
    const { data: emailSettings } = await supabase
      .from('vendor_email_settings')
      .select('from_name, from_email, reply_to')
      .eq('vendor_id', campaign.vendor_id)
      .single()

    const fromName = emailSettings?.from_name || vendor?.store_name || 'Store'
    const fromEmail = emailSettings?.from_email || 'noreply@floradistro.com'
    const replyTo = emailSettings?.reply_to

    // Get recipients based on audience type
    let recipients: { id: string; email: string; first_name?: string }[] = []

    console.log(`Campaign audience_type: ${campaign.audience_type}`)

    if (campaign.audience_type === 'all' || !campaign.audience_filter?.segment_id) {
      // All active customers with email
      console.log('Fetching all customers with email...')
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, email, first_name')
        .eq('vendor_id', campaign.vendor_id)
        .eq('is_active', true)
        .not('email', 'is', null)

      if (custError) {
        console.error('Error fetching customers:', custError)
      }
      recipients = customers || []
      console.log(`Found ${recipients.length} customers with email`)
    } else if (campaign.audience_type === 'segment') {
      // Get segment filter criteria
      const segmentId = campaign.audience_filter?.segment_id
      if (segmentId) {
        const { data: segment } = await supabase
          .from('customer_segments')
          .select('filter_criteria')
          .eq('id', segmentId)
          .single()

        if (segment) {
          // Apply filter based on criteria type
          const criteria = segment.filter_criteria as { type: string; min_points?: number; days?: number }

          let query = supabase
            .from('customers')
            .select('id, email, first_name')
            .eq('vendor_id', campaign.vendor_id)
            .eq('is_active', true)
            .not('email', 'is', null)

          switch (criteria.type) {
            case 'all':
              // No additional filter
              break
            case 'loyalty':
              if (criteria.min_points) {
                query = query.gte('loyalty_points', criteria.min_points)
              }
              break
            case 'recent_order':
              // TODO: Join with orders table for recent purchasers
              break
            case 'inactive':
              // TODO: Join with orders table for inactive customers
              break
          }

          const { data: customers } = await query
          recipients = customers || []
        }
      }
    }

    // Check customer unsubscribe preferences (if table exists)
    try {
      const { data: unsubscribed } = await supabase
        .from('customer_email_preferences')
        .select('customer_id')
        .eq('vendor_id', campaign.vendor_id)
        .eq('unsubscribed_marketing', true)

      if (unsubscribed) {
        const unsubscribedIds = new Set(unsubscribed.map(u => u.customer_id))
        recipients = recipients.filter(r => !unsubscribedIds.has(r.id))
      }
    } catch (prefError) {
      // customer_email_preferences table may not exist yet, continue without filtering
      console.log('Note: customer_email_preferences table not available, skipping unsubscribe filter')
    }

    console.log(`Sending campaign ${campaignId} to ${recipients.length} recipients`)

    // Update recipient count
    await supabase
      .from('marketing_campaigns')
      .update({ recipient_count: recipients.length })
      .eq('id', campaignId)

    // Send emails (batch processing)
    let successCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      try {
        // Create send record first
        const { data: sendRecord } = await supabase
          .from('marketing_sends')
          .insert({
            campaign_id: campaignId,
            customer_id: recipient.id,
            status: 'pending',
          })
          .select()
          .single()

        // Send via Resend
        const resendResponse = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipient.email,
          subject: campaign.subject,
          html: campaign.html_content,
          reply_to: replyTo,
          tags: [
            { name: 'vendor_id', value: campaign.vendor_id },
            { name: 'campaign_id', value: campaignId },
            { name: 'email_type', value: 'marketing' },
          ],
        })

        if (resendResponse.data) {
          // Update send record with Resend ID
          await supabase
            .from('marketing_sends')
            .update({
              resend_email_id: resendResponse.data.id,
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', sendRecord?.id)

          successCount++
        } else {
          await supabase
            .from('marketing_sends')
            .update({ status: 'bounced' })
            .eq('id', sendRecord?.id)

          failedCount++
        }
      } catch (sendError) {
        console.error(`Failed to send to ${recipient.email}:`, sendError)
        failedCount++
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Update campaign status
    const finalStatus = failedCount === recipients.length ? 'failed' : 'sent'
    await supabase
      .from('marketing_campaigns')
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        sent_count: successCount,
      })
      .eq('id', campaignId)

    console.log(`Campaign ${campaignId} complete: ${successCount} sent, ${failedCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        totalRecipients: recipients.length,
        successCount,
        failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-marketing-campaign:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
