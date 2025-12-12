/**
 * Meta Get Insights Edge Function
 * Fetches ad account and campaign insights from Meta Marketing API
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface InsightsRequest {
  vendorId: string
  dateStart?: string // YYYY-MM-DD
  dateEnd?: string   // YYYY-MM-DD
  breakdown?: 'day' | 'week' | 'month'
}

interface MetaInsight {
  impressions?: string
  reach?: string
  clicks?: string
  spend?: string
  cpc?: string
  cpm?: string
  ctr?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
  date_start?: string
  date_stop?: string
}

serve(async (req) => {
  console.log('meta-get-insights function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const {
      vendorId,
      dateStart,
      dateEnd,
      breakdown = 'day'
    }: InsightsRequest = await req.json()

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: 'vendorId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Default to last 30 days if no dates provided
    const endDate = dateEnd || new Date().toISOString().split('T')[0]
    const startDate = dateStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

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
    const adAccountId = integration.ad_account_id

    console.log(`Fetching insights from ${startDate} to ${endDate}`, {
      hasAdAccount: !!adAccountId,
      hasPage: !!integration.page_id,
      hasInstagram: !!integration.instagram_business_id,
    })

    // ========================================================================
    // FETCH ACCOUNT-LEVEL INSIGHTS (SUMMARY) - Only if ad account connected
    // ========================================================================
    let summary: any = null
    let dailyData: any[] = []
    let campaignData: any[] = []

    if (adAccountId) {
      const summaryResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/insights?` + new URLSearchParams({
        fields: [
          'impressions',
          'reach',
          'clicks',
          'spend',
          'cpc',
          'cpm',
          'ctr',
          'actions',
          'action_values',
          'purchase_roas',
          'cost_per_action_type',
        ].join(','),
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        access_token: accessToken,
      })
    )

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json()
      if (summaryData.data?.[0]) {
        const s = summaryData.data[0]

        // Extract purchase conversions
        let purchases = 0
        let purchaseValue = 0

        if (s.actions) {
          const purchaseAction = s.actions.find(
            (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
          )
          if (purchaseAction) {
            purchases = parseInt(purchaseAction.value) || 0
          }
        }

        if (s.action_values) {
          const purchaseValueAction = s.action_values.find(
            (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
          )
          if (purchaseValueAction) {
            purchaseValue = parseFloat(purchaseValueAction.value) || 0
          }
        }

        const spend = parseFloat(s.spend || '0')

        summary = {
          impressions: parseInt(s.impressions || '0'),
          reach: parseInt(s.reach || '0'),
          clicks: parseInt(s.clicks || '0'),
          spend: spend,
          cpc: parseFloat(s.cpc || '0'),
          cpm: parseFloat(s.cpm || '0'),
          ctr: parseFloat(s.ctr || '0'),
          purchases: purchases,
          purchaseValue: purchaseValue,
          roas: spend > 0 ? purchaseValue / spend : 0,
          dateStart: startDate,
          dateEnd: endDate,
        }
      }
    } else {
      const error = await summaryResponse.json()
      console.error('Summary insights error:', error)
    }

    // ========================================================================
    // FETCH DAILY BREAKDOWN
    // ========================================================================
    const dailyResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/insights?` + new URLSearchParams({
        fields: [
          'impressions',
          'reach',
          'clicks',
          'spend',
          'actions',
          'action_values',
        ].join(','),
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        time_increment: breakdown === 'day' ? '1' : breakdown === 'week' ? '7' : 'monthly',
        access_token: accessToken,
      })
    )

    if (dailyResponse.ok) {
      const dailyResult = await dailyResponse.json()
      dailyData = (dailyResult.data || []).map((d: any) => {
        // Extract purchases for each day
        let purchases = 0
        let purchaseValue = 0

        if (d.actions) {
          const purchaseAction = d.actions.find(
            (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
          )
          if (purchaseAction) {
            purchases = parseInt(purchaseAction.value) || 0
          }
        }

        if (d.action_values) {
          const purchaseValueAction = d.action_values.find(
            (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
          )
          if (purchaseValueAction) {
            purchaseValue = parseFloat(purchaseValueAction.value) || 0
          }
        }

        return {
          date: d.date_start,
          impressions: parseInt(d.impressions || '0'),
          reach: parseInt(d.reach || '0'),
          clicks: parseInt(d.clicks || '0'),
          spend: parseFloat(d.spend || '0'),
          purchases: purchases,
          purchaseValue: purchaseValue,
        }
      })
    }

    // ========================================================================
    // FETCH CAMPAIGN BREAKDOWN
    // ========================================================================
    const campaignsResponse = await fetch(
      `${META_GRAPH_API}/${adAccountId}/insights?` + new URLSearchParams({
        fields: [
          'campaign_id',
          'campaign_name',
          'impressions',
          'reach',
          'clicks',
          'spend',
          'cpc',
          'ctr',
          'actions',
          'action_values',
        ].join(','),
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        level: 'campaign',
        limit: '50',
        access_token: accessToken,
      })
    )

    if (campaignsResponse.ok) {
      const campaignsResult = await campaignsResponse.json()
      campaignData = (campaignsResult.data || []).map((c: any) => {
        let purchases = 0
        let purchaseValue = 0

        if (c.actions) {
          const purchaseAction = c.actions.find(
            (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
          )
          if (purchaseAction) {
            purchases = parseInt(purchaseAction.value) || 0
          }
        }

        if (c.action_values) {
          const purchaseValueAction = c.action_values.find(
            (a: any) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
          )
          if (purchaseValueAction) {
            purchaseValue = parseFloat(purchaseValueAction.value) || 0
          }
        }

        const spend = parseFloat(c.spend || '0')

        return {
          campaignId: c.campaign_id,
          campaignName: c.campaign_name,
          impressions: parseInt(c.impressions || '0'),
          reach: parseInt(c.reach || '0'),
          clicks: parseInt(c.clicks || '0'),
          spend: spend,
          cpc: parseFloat(c.cpc || '0'),
          ctr: parseFloat(c.ctr || '0'),
          purchases: purchases,
          purchaseValue: purchaseValue,
          roas: spend > 0 ? purchaseValue / spend : 0,
        }
      }).sort((a: any, b: any) => b.spend - a.spend) // Sort by spend descending
    }
    } // End of if (adAccountId)

    // ========================================================================
    // FETCH PAGE INSIGHTS (if page is connected)
    // ========================================================================
    let pageInsights: any = null
    let pageError: string | null = null
    if (integration.page_id) {
      try {
        // Get page info (followers count)
        const pageInfoResponse = await fetch(
          `${META_GRAPH_API}/${integration.page_id}?` + new URLSearchParams({
            fields: 'followers_count,fan_count,name',
            access_token: accessToken,
          })
        )

        let followers = 0
        if (pageInfoResponse.ok) {
          const pageInfo = await pageInfoResponse.json()
          followers = pageInfo.followers_count || pageInfo.fan_count || 0
        }

        // Get page posts with engagement - fetch all posts (no date filter)
        // Engagement metrics are cumulative totals on each post
        const postsResponse = await fetch(
          `${META_GRAPH_API}/${integration.page_id}/posts?` + new URLSearchParams({
            fields: 'likes.summary(true),comments.summary(true),shares,reactions.summary(true),created_time',
            limit: '100',
            access_token: accessToken,
          })
        )

        let totalLikes = 0
        let totalComments = 0
        let totalShares = 0
        let totalReactions = 0
        let postCount = 0

        if (postsResponse.ok) {
          const postsData = await postsResponse.json()
          console.log(`Fetched ${postsData.data?.length || 0} Facebook posts total`)

          // Count ALL posts and their engagement (not filtered by date)
          for (const post of postsData.data || []) {
            postCount++
            totalLikes += post.likes?.summary?.total_count || 0
            totalComments += post.comments?.summary?.total_count || 0
            totalShares += post.shares?.count || 0
            totalReactions += post.reactions?.summary?.total_count || 0
          }
          console.log(`Facebook: ${postCount} posts total, ${totalLikes} likes, ${totalComments} comments, ${totalShares} shares`)
        } else {
          const postsError = await postsResponse.json()
          console.error('Posts fetch error:', postsError)
          pageError = postsError.error?.message || 'Failed to fetch posts'
        }

        // If no posts from API, try to get from synced posts in database
        if (postCount === 0) {
          console.log('No posts from API, checking database for synced posts...')
          const { data: syncedPosts } = await supabase
            .from('meta_posts')
            .select('likes_count, comments_count, shares_count, reactions_count')
            .eq('vendor_id', vendorId)
            .eq('platform', 'facebook')

          if (syncedPosts && syncedPosts.length > 0) {
            postCount = syncedPosts.length
            for (const post of syncedPosts) {
              totalLikes += post.likes_count || 0
              totalComments += post.comments_count || 0
              totalShares += post.shares_count || 0
              totalReactions += post.reactions_count || 0
            }
            console.log(`Facebook from DB: ${postCount} posts, ${totalLikes} likes`)
          }
        }

        pageInsights = {
          impressions: 0, // Not available without page insights permission
          reach: 0,
          engagedUsers: 0,
          postEngagements: totalReactions + totalComments + totalShares,
          totalFollowers: followers,
          newFollowers: 0,
          pageViews: 0,
          websiteClicks: 0,
          totalLikes,
          totalComments,
          totalShares,
          postCount,
        }
      } catch (err: any) {
        pageError = err.message || 'Unknown error fetching page insights'
        console.error('Could not fetch page insights:', err)
      }
    }

    // ========================================================================
    // FETCH INSTAGRAM INSIGHTS (if connected)
    // ========================================================================
    let instagramInsights: any = null
    let instagramError: string | null = null
    if (integration.instagram_business_id) {
      try {
        // Get Instagram account info first
        const igInfoResponse = await fetch(
          `${META_GRAPH_API}/${integration.instagram_business_id}?` + new URLSearchParams({
            fields: 'followers_count,media_count,username,profile_picture_url',
            access_token: accessToken,
          })
        )

        let followers = 0
        let mediaCount = 0
        if (igInfoResponse.ok) {
          const igInfo = await igInfoResponse.json()
          followers = igInfo.followers_count || 0
          mediaCount = igInfo.media_count || 0
        }

        // Fetch insights with valid metrics for Instagram Business
        const igResponse = await fetch(
          `${META_GRAPH_API}/${integration.instagram_business_id}/insights?` + new URLSearchParams({
            metric: 'reach,follower_count,profile_views,website_clicks',
            period: 'day',
            since: startDate,
            until: endDate,
            access_token: accessToken,
          })
        )

        let reach = 0
        let profileViews = 0
        let websiteClicks = 0
        let followerGrowth = 0

        if (igResponse.ok) {
          const igData = await igResponse.json()

          for (const metric of igData.data || []) {
            const total = (metric.values || []).reduce(
              (sum: number, v: any) => sum + (v.value || 0),
              0
            )

            if (metric.name === 'reach') reach = total
            if (metric.name === 'profile_views') profileViews = total
            if (metric.name === 'website_clicks') websiteClicks = total

            // Calculate follower growth from first to last value
            if (metric.name === 'follower_count' && metric.values?.length > 1) {
              const firstVal = metric.values[0]?.value || 0
              const lastVal = metric.values[metric.values.length - 1]?.value || 0
              followerGrowth = lastVal - firstVal
            }
          }
        } else {
          // If insights fail, still return the basic info
          const errorData = await igResponse.json()
          console.warn('IG insights error (non-fatal):', errorData.error?.message)
        }

        // Get recent media engagement
        const mediaResponse = await fetch(
          `${META_GRAPH_API}/${integration.instagram_business_id}/media?` + new URLSearchParams({
            fields: 'like_count,comments_count,timestamp',
            limit: '50',
            access_token: accessToken,
          })
        )

        let totalLikes = 0
        let totalComments = 0
        let recentPostCount = 0

        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json()
          console.log(`Found ${mediaData.data?.length || 0} Instagram media items`)

          // Count ALL posts and their engagement (not filtered by date)
          for (const media of mediaData.data || []) {
            recentPostCount++
            totalLikes += media.like_count || 0
            totalComments += media.comments_count || 0
          }
          console.log(`Instagram: ${recentPostCount} posts total, ${totalLikes} likes, ${totalComments} comments`)
        } else {
          const mediaError = await mediaResponse.json()
          console.error('Instagram media fetch error:', mediaError)
          instagramError = mediaError.error?.message || 'Failed to fetch media'
        }

        // If no posts from API, try to get from synced posts in database
        if (recentPostCount === 0) {
          console.log('No IG posts from API, checking database for synced posts...')
          const { data: syncedPosts } = await supabase
            .from('meta_posts')
            .select('ig_likes_count, ig_comments_count, ig_reach, ig_impressions')
            .eq('vendor_id', vendorId)
            .eq('platform', 'instagram')

          if (syncedPosts && syncedPosts.length > 0) {
            recentPostCount = syncedPosts.length
            for (const post of syncedPosts) {
              totalLikes += post.ig_likes_count || 0
              totalComments += post.ig_comments_count || 0
              reach += post.ig_reach || 0
            }
            console.log(`Instagram from DB: ${recentPostCount} posts, ${totalLikes} likes, ${reach} reach`)
          }
        }

        instagramInsights = {
          impressions: 0, // Not available with basic permissions
          reach,
          profileViews,
          followers,
          newFollowers: followerGrowth > 0 ? followerGrowth : 0,
          websiteClicks,
          emailContacts: 0,
          phoneClicks: 0,
          totalLikes,
          totalComments,
          mediaCount,
          recentPostCount,
        }
      } catch (err: any) {
        instagramError = err.message || 'Unknown error fetching Instagram insights'
        console.error('Could not fetch Instagram insights:', err)
      }
    }

    // Include debug info about what was attempted
    const debug = {
      hasPageId: !!integration.page_id,
      hasInstagramId: !!integration.instagram_business_id,
      hasAdAccountId: !!integration.ad_account_id,
      pageError,
      instagramError,
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        daily: dailyData,
        campaigns: campaignData,
        page: pageInsights,
        instagram: instagramInsights,
        dateRange: { start: startDate, end: endDate },
        debug,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-get-insights error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch insights' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
