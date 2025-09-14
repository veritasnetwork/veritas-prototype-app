import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DashboardFeedRequest {
  user_id: string
  limit?: number
  offset?: number
}

interface DashboardFeedResponse {
  posts: Array<{
    id: string
    user_id: string
    title: string
    content: string
    media_urls: string[]
    opinion_belief_id: string | null
    created_at: string
    user: {
      username: string
      display_name: string
    }
    belief?: {
      belief_id: string
      previous_aggregate: number
      expiration_epoch: number
      status: string
      creator_agent_id: string
    }
    submissions?: Array<{
      submission_id: string
      user: {
        id: string
        username: string
        display_name: string
      }
      agent_id: string
      belief: number
      meta_prediction: number
      epoch: number
      is_active: boolean
      stake_allocated: number
      created_at: string
      updated_at: string
    }>
  }>
  total_count: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Parse request body
    const {
      user_id,
      limit = 20,
      offset = 0
    }: DashboardFeedRequest = await req.json()

    // Validate required fields
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate pagination parameters
    if (limit > 100 || limit < 1) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 100', code: 422 }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get posts with user data, ordered by creation time (same as app-post-get-feed)
    const { data: postsData, error: postsError, count } = await supabaseClient
      .from('posts')
      .select(`
        id,
        user_id,
        title,
        content,
        media_urls,
        opinion_belief_id,
        created_at,
        users:user_id (
          username,
          display_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (postsError) {
      console.error('Failed to fetch posts:', postsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch posts', code: 503 }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get all unique belief IDs for efficient batch querying
    const beliefIds = (postsData || [])
      .filter(post => post.opinion_belief_id)
      .map(post => post.opinion_belief_id)

    // Fetch all belief data in one query
    let beliefsMap: Record<string, any> = {}
    if (beliefIds.length > 0) {
      const { data: beliefsData, error: beliefsError } = await supabaseClient
        .from('beliefs')
        .select(`
          id,
          previous_aggregate,
          previous_disagreement_entropy,
          expiration_epoch,
          creator_agent_id,
          status
        `)
        .in('id', beliefIds)

      if (beliefsError) {
        console.warn('Failed to fetch belief data:', beliefsError)
      } else {
        // Create map for easy lookup
        beliefsMap = (beliefsData || []).reduce((acc, belief) => {
          acc[belief.id] = belief
          return acc
        }, {} as Record<string, any>)
      }
    }

    // Enrich posts with user, belief, and submission data
    const enrichedPosts = []

    for (const post of postsData || []) {
      const basePost = {
        id: post.id,
        user_id: post.user_id,
        title: post.title || '',
        content: post.content || '',
        media_urls: post.media_urls || [],
        opinion_belief_id: post.opinion_belief_id,
        created_at: post.created_at,
        user: {
          username: post.users?.username || 'Unknown',
          display_name: post.users?.display_name || 'Unknown User'
        }
      }

      // Add belief data if available
      if (post.opinion_belief_id && beliefsMap[post.opinion_belief_id]) {
        const beliefData = beliefsMap[post.opinion_belief_id]
        basePost.belief = {
          belief_id: beliefData.id,
          previous_aggregate: beliefData.previous_aggregate || 0,
          expiration_epoch: beliefData.expiration_epoch,
          status: beliefData.status || 'unknown',
          creator_agent_id: beliefData.creator_agent_id
        }

        // Get detailed submission data for this belief
        try {
          const submissionsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-indexer-beliefs-get-submissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              belief_id: post.opinion_belief_id
            })
          })

          if (submissionsResponse.ok) {
            const submissionsData = await submissionsResponse.json()
            basePost.submissions = submissionsData.submissions || []
          } else {
            console.warn(`Failed to fetch submissions for belief ${post.opinion_belief_id}`)
            basePost.submissions = []
          }
        } catch (error) {
          console.warn(`Error fetching submissions for belief ${post.opinion_belief_id}:`, error)
          basePost.submissions = []
        }
      }

      enrichedPosts.push(basePost)
    }

    const response: DashboardFeedResponse = {
      posts: enrichedPosts,
      total_count: count || 0
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 500 }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})