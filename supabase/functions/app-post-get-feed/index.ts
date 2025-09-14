import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FeedRequest {
  user_id: string
  limit?: number
  offset?: number
}

interface FeedResponse {
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
      initial_aggregate: number
      expiration_epoch: number
      status: string
    }
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
    }: FeedRequest = await req.json()

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

    // MODULAR USER SELECTION: Currently fetching all posts for all users
    // TODO: When auth is implemented, swap this logic to use the authenticated user
    // TODO: In future, implement algorithm-based feeds based on user preferences and post tags
    
    // For now, all users see all posts (ignoring user_id for post filtering)
    // This is a placeholder until we implement personalized feed algorithms
    
    // Get posts with user data, ordered by creation time
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

    // Fetch all belief data in one query for better performance
    let beliefsMap: Record<string, any> = {}
    if (beliefIds.length > 0) {
      const { data: beliefsData, error: beliefsError } = await supabaseClient
        .from('beliefs')
        .select(`
          id,
          previous_aggregate,
          previous_disagreement_entropy,
          participant_count,
          expiration_epoch,
          creator_agent_id
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

    // Enrich posts with user and belief data
    const enrichedPosts = (postsData || []).map(post => {
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
        return {
          ...basePost,
          belief: {
            belief_id: beliefData.id,
            initial_aggregate: beliefData.previous_aggregate || 0,
            expiration_epoch: beliefData.expiration_epoch,
            status: 'active', // TODO: Calculate actual status based on current epoch
            participant_count: beliefData.participant_count || 0
          }
        }
      }

      return basePost
    })

    const response: FeedResponse = {
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