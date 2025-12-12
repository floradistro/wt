/**
 * Meta Fetch Posts Edge Function
 * Fetches posts from Facebook Page and Instagram Business Account
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const META_GRAPH_API = 'https://graph.facebook.com/v21.0'

interface FetchPostsRequest {
  vendorId: string
  platform?: 'facebook' | 'instagram' | 'all'
  limit?: number
}

interface FacebookPost {
  id: string
  message?: string
  story?: string
  created_time: string
  updated_time?: string
  full_picture?: string
  picture?: string
  permalink_url?: string
  type?: string
  object_id?: string
  shares?: { count: number }
  likes?: { summary: { total_count: number } }
  comments?: { summary: { total_count: number } }
  reactions?: { summary: { total_count: number } }
  attachments?: {
    data: Array<{
      type: string
      media_type?: string
      url?: string
      media?: { image?: { src: string; height?: number; width?: number } }
      subattachments?: {
        data: Array<{
          media?: { image?: { src: string } }
        }>
      }
    }>
  }
}

interface InstagramPost {
  id: string
  caption?: string
  media_type: string // IMAGE, VIDEO, CAROUSEL_ALBUM
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp: string
  like_count?: number
  comments_count?: number
  insights?: {
    data: Array<{
      name: string
      values: Array<{ value: number }>
    }>
  }
}

serve(async (req) => {
  console.log('meta-fetch-posts function invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { vendorId, platform = 'all', limit = 50 }: FetchPostsRequest = await req.json()

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: 'vendorId is required' }),
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
    const pageId = integration.page_id
    const instagramId = integration.instagram_business_id

    const allPosts: any[] = []

    // ========================================================================
    // FETCH FACEBOOK POSTS
    // ========================================================================
    if ((platform === 'all' || platform === 'facebook') && pageId) {
      console.log(`Fetching Facebook posts for page: ${pageId}`)

      try {
        const fbResponse = await fetch(
          `${META_GRAPH_API}/${pageId}/posts?` + new URLSearchParams({
            fields: [
              'id',
              'message',
              'story',
              'created_time',
              'updated_time',
              'full_picture',
              'picture',
              'permalink_url',
              'type',
              'object_id',
              'shares',
              'likes.summary(true)',
              'comments.summary(true)',
              'reactions.summary(true)',
              'attachments{type,media_type,url,media,subattachments}',
            ].join(','),
            limit: limit.toString(),
            access_token: accessToken,
          })
        )

        if (fbResponse.ok) {
          const fbData = await fbResponse.json()
          const fbPosts: FacebookPost[] = fbData.data || []

          console.log(`Fetched ${fbPosts.length} Facebook posts`)

          for (const post of fbPosts) {
            // Try to get the best image URL
            let imageUrl = post.full_picture || post.picture || null
            let mediaType = null

            // Check attachments for better image
            if (post.attachments?.data?.[0]) {
              const attachment = post.attachments.data[0]
              mediaType = attachment.media_type || attachment.type

              // Get image from attachment media
              if (attachment.media?.image?.src) {
                imageUrl = attachment.media.image.src
              }

              // For albums/carousels, try to get first subattachment
              if (!imageUrl && attachment.subattachments?.data?.[0]?.media?.image?.src) {
                imageUrl = attachment.subattachments.data[0].media.image.src
              }
            }

            let thumbnailUrl = null

            // For photo posts, try fetching the photo directly for full size
            if (post.object_id && post.type === 'photo') {
              try {
                const photoResponse = await fetch(
                  `${META_GRAPH_API}/${post.object_id}?fields=images,source&access_token=${accessToken}`
                )
                if (photoResponse.ok) {
                  const photoData = await photoResponse.json()
                  // Get largest image
                  if (photoData.images?.[0]?.source) {
                    imageUrl = photoData.images[0].source
                  } else if (photoData.source) {
                    imageUrl = photoData.source
                  }
                }
              } catch (e) {
                console.warn('Could not fetch full photo:', post.object_id)
              }
            }

            // For video posts, fetch the video thumbnail
            if (post.object_id && post.type === 'video') {
              try {
                const videoResponse = await fetch(
                  `${META_GRAPH_API}/${post.object_id}?fields=picture,thumbnails,source,length&access_token=${accessToken}`
                )
                if (videoResponse.ok) {
                  const videoData = await videoResponse.json()
                  // Get best thumbnail
                  if (videoData.thumbnails?.data?.[0]?.uri) {
                    // Get largest thumbnail
                    const thumbs = videoData.thumbnails.data
                    const bestThumb = thumbs.reduce((best: any, curr: any) =>
                      (curr.height || 0) > (best.height || 0) ? curr : best
                    , thumbs[0])
                    thumbnailUrl = bestThumb.uri
                    imageUrl = bestThumb.uri
                  } else if (videoData.picture) {
                    thumbnailUrl = videoData.picture
                    imageUrl = videoData.picture
                  }
                }
              } catch (e) {
                console.warn('Could not fetch video thumbnail:', post.object_id)
              }
            }

            const postRecord = {
              vendor_id: vendorId,
              meta_post_id: post.id,
              meta_page_id: pageId,
              platform: 'facebook',
              post_type: post.type || 'status',
              message: post.message || null,
              story: post.story || null,
              full_picture: imageUrl,
              thumbnail_url: thumbnailUrl,
              media_type: mediaType,
              permalink_url: post.permalink_url || null,
              created_time: post.created_time,
              updated_time: post.updated_time || null,
              likes_count: post.likes?.summary?.total_count || 0,
              comments_count: post.comments?.summary?.total_count || 0,
              shares_count: post.shares?.count || 0,
              reactions_count: post.reactions?.summary?.total_count || 0,
              raw_data: post,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            allPosts.push(postRecord)
          }
        } else {
          const error = await fbResponse.json()
          console.error('Facebook posts fetch error:', error)
        }
      } catch (fbError) {
        console.error('Facebook fetch error:', fbError)
      }
    }

    // ========================================================================
    // FETCH INSTAGRAM POSTS
    // ========================================================================
    if ((platform === 'all' || platform === 'instagram') && instagramId) {
      console.log(`Fetching Instagram posts for account: ${instagramId}`)

      try {
        const igResponse = await fetch(
          `${META_GRAPH_API}/${instagramId}/media?` + new URLSearchParams({
            fields: [
              'id',
              'caption',
              'media_type',
              'media_url',
              'thumbnail_url',
              'permalink',
              'timestamp',
              'like_count',
              'comments_count',
            ].join(','),
            limit: limit.toString(),
            access_token: accessToken,
          })
        )

        if (igResponse.ok) {
          const igData = await igResponse.json()
          const igPosts: InstagramPost[] = igData.data || []

          console.log(`Fetched ${igPosts.length} Instagram posts`)

          for (const post of igPosts) {
            // Fetch insights for each post (reach, impressions, saved)
            let insights: Record<string, number> = {}
            try {
              const insightsResponse = await fetch(
                `${META_GRAPH_API}/${post.id}/insights?` + new URLSearchParams({
                  metric: 'impressions,reach,saved',
                  access_token: accessToken,
                })
              )

              if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json()
                for (const metric of insightsData.data || []) {
                  insights[metric.name] = metric.values?.[0]?.value || 0
                }
              }
            } catch (insightErr) {
              console.warn('Could not fetch insights for post:', post.id)
            }

            // For videos, use thumbnail_url as primary image; for images/carousels, use media_url
            const isVideo = post.media_type === 'VIDEO'
            const primaryImage = isVideo
              ? (post.thumbnail_url || post.media_url)
              : (post.media_url || post.thumbnail_url)

            const postRecord = {
              vendor_id: vendorId,
              meta_post_id: post.id,
              meta_instagram_id: instagramId,
              platform: 'instagram',
              post_type: post.media_type?.toLowerCase() || 'image',
              message: post.caption || null,
              full_picture: primaryImage || null,
              media_url: post.media_url || null,
              thumbnail_url: post.thumbnail_url || null,
              permalink_url: post.permalink || null,
              media_type: post.media_type || null,
              created_time: post.timestamp,
              ig_likes_count: post.like_count || 0,
              ig_comments_count: post.comments_count || 0,
              ig_saved_count: insights.saved || 0,
              ig_reach: insights.reach || 0,
              ig_impressions: insights.impressions || 0,
              raw_data: { ...post, insights },
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            allPosts.push(postRecord)
          }
        } else {
          const error = await igResponse.json()
          console.error('Instagram posts fetch error:', error)
        }
      } catch (igError) {
        console.error('Instagram fetch error:', igError)
      }
    }

    // ========================================================================
    // UPSERT POSTS TO DATABASE
    // ========================================================================
    if (allPosts.length > 0) {
      const { error: upsertError } = await supabase
        .from('meta_posts')
        .upsert(allPosts, {
          onConflict: 'vendor_id,meta_post_id',
        })

      if (upsertError) {
        console.error('Posts upsert error:', upsertError)
        throw new Error('Failed to save posts')
      }
    }

    // Update integration last sync time
    await supabase
      .from('meta_integrations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', integration.id)

    return new Response(
      JSON.stringify({
        success: true,
        facebook_posts: allPosts.filter(p => p.platform === 'facebook').length,
        instagram_posts: allPosts.filter(p => p.platform === 'instagram').length,
        total: allPosts.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('meta-fetch-posts error:', error)

    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch posts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
