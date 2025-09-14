import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PostCreationRequest {
  user_id: string
  title: string
  content: string
  initial_belief: number
  meta_prediction?: number
  duration_epochs?: number
  media_urls?: string[]
}

interface PostCreationResponse {
  post_id: string
  belief_id: string
  post: {
    id: string
    user_id: string
    opinion_belief_id: string
    title: string
    content: string
    media_urls: string[]
    created_at: string
  }
  belief: {
    belief_id: string
    initial_aggregate: number
    expiration_epoch: number
  }
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
      title, 
      content, 
      initial_belief,
      meta_prediction,
      duration_epochs = 5, // Default 5 epochs
      media_urls = []
    }: PostCreationRequest = await req.json()

    // Validate required fields (title is required for opinion posts, content is optional)
    if (!user_id || !title?.trim() || initial_belief === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, initial_belief', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate initial_belief range
    if (initial_belief < 0 || initial_belief > 1) {
      return new Response(
        JSON.stringify({ error: 'initial_belief must be between 0 and 1', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const trimmedTitle = title.trim()
    const trimmedContent = content?.trim() || ''

    // Validate title and content length
    if (trimmedTitle.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Title must be 200 characters or less', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (trimmedContent.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Content must be 2000 characters or less', code: 422 }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get user and their agent_id
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('agent_id')
      .eq('id', user_id)
      .single()

    if (userError) {
      console.error('Failed to get user:', userError)
      return new Response(
        JSON.stringify({ error: 'User not found', code: 404 }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create belief via protocol function
    const beliefResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/protocol-belief-creation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: userData.agent_id,
        initial_belief,
        meta_prediction,
        duration_epochs
      })
    })

    const beliefData = await beliefResponse.json()

    if (!beliefResponse.ok) {
      console.error('Failed to create belief:', beliefData)
      return new Response(
        JSON.stringify({ error: `Belief creation failed: ${beliefData.error}`, code: beliefData.code || 503 }),
        { 
          status: beliefData.code || 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create post record linked to belief
    const { data: post, error: postError } = await supabaseClient
      .from('posts')
      .insert({
        user_id,
        opinion_belief_id: beliefData.belief_id,
        title: trimmedTitle,
        content: trimmedContent,
        media_urls
      })
      .select()
      .single()

    if (postError) {
      console.error('Failed to create post:', postError)
      
      // TODO: Ideally we'd rollback the belief creation here
      // For now, just log the error and continue
      
      return new Response(
        JSON.stringify({ error: 'Post creation failed', code: 503 }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // TODO: Update user's beliefs_created count (can be done later)

    const response: PostCreationResponse = {
      post_id: post.id,
      belief_id: beliefData.belief_id,
      post: {
        id: post.id,
        user_id: post.user_id,
        opinion_belief_id: post.opinion_belief_id,
        title: post.title,
        content: post.content,
        media_urls: post.media_urls,
        created_at: post.created_at
      },
      belief: {
        belief_id: beliefData.belief_id,
        initial_aggregate: beliefData.initial_aggregate,
        expiration_epoch: beliefData.expiration_epoch
      }
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