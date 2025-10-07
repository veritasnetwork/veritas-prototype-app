import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Connection } from 'https://esm.sh/@solana/web3.js@1.87.6'
import { syncPoolData } from '../_shared/pool-sync.ts'

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
    belief_id: string
    created_at: string
    pool_address?: string
    user: {
      username: string
      display_name: string
    }
    belief: {
      belief_id: string
      previous_aggregate: number
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
        belief_id,
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

    // Get all unique belief IDs and post IDs for efficient batch querying
    const beliefIds = (postsData || [])
      .filter(post => post.belief_id)
      .map(post => post.belief_id)

    const postIds = (postsData || []).map(post => post.id)

    // Fetch all belief data in one query for better performance
    let beliefsMap: Record<string, any> = {}
    if (beliefIds.length > 0) {
      const { data: beliefsData, error: beliefsError } = await supabaseClient
        .from('beliefs')
        .select(`
          id,
          previous_aggregate,
          previous_disagreement_entropy,
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

    // Fetch pool deployments for posts and sync with on-chain data
    let poolsMap: Record<string, any> = {}
    if (postIds.length > 0) {
      const { data: poolsData, error: poolsError } = await supabaseClient
        .from('pool_deployments')
        .select('post_id, pool_address, k_quadratic, token_supply, reserve, last_synced_at')
        .in('post_id', postIds)

      if (poolsError) {
        console.warn('Failed to fetch pool deployments:', poolsError)
      } else if (poolsData && poolsData.length > 0) {
        // Initialize Solana connection for syncing
        // For local development, edge functions run in Docker and need host.docker.internal
        // In production, use the configured RPC endpoint
        let rpcEndpoint = Deno.env.get('SOLANA_RPC_ENDPOINT') || 'http://127.0.0.1:8899'

        // If endpoint is localhost/127.0.0.1, convert to host.docker.internal for Docker
        if (rpcEndpoint.includes('127.0.0.1') || rpcEndpoint.includes('localhost')) {
          rpcEndpoint = rpcEndpoint.replace('127.0.0.1', 'host.docker.internal')
          rpcEndpoint = rpcEndpoint.replace('localhost', 'host.docker.internal')
        }

        const connection = new Connection(rpcEndpoint, 'confirmed')

        // Sync each pool with on-chain data
        const syncPromises = poolsData.map(async (pool) => {
          if (!pool.pool_address) {
            return pool // Skip pools without addresses
          }

          try {
            // Sync pool data from chain to database
            const syncedData = await syncPoolData(
              supabaseClient,
              connection,
              pool.post_id,
              pool.pool_address
            )

            // Return updated pool data
            return {
              post_id: pool.post_id,
              pool_address: pool.pool_address,
              token_supply: syncedData.token_supply,
              reserve: syncedData.reserve,
              last_synced_at: syncedData.synced_at
            }
          } catch (syncError) {
            console.warn(`Failed to sync pool ${pool.post_id}:`, syncError)
            // Return stale data on sync failure
            return pool
          }
        })

        // Wait for all syncs to complete
        const syncedPools = await Promise.all(syncPromises)

        // Create map for easy lookup
        poolsMap = syncedPools.reduce((acc, pool) => {
          acc[pool.post_id] = pool
          return acc
        }, {} as Record<string, any>)
      }
    }

    // Enrich posts with user and belief data
    const enrichedPosts = (postsData || []).map(post => {
      const beliefData = beliefsMap[post.belief_id] || {}
      const poolData = poolsMap[post.id] || {}

      return {
        id: post.id,
        user_id: post.user_id,
        title: post.title || '',
        content: post.content || '',
        belief_id: post.belief_id,
        created_at: post.created_at,
        pool_address: poolData.pool_address,
        pool_token_supply: poolData.token_supply || 0,
        pool_reserve_balance: poolData.reserve || 0,
        pool_k_quadratic: poolData.k_quadratic || 0,
        user: {
          username: post.users?.username || 'Unknown',
          display_name: post.users?.display_name || 'Unknown User'
        },
        belief: {
          belief_id: post.belief_id,
          previous_aggregate: beliefData.previous_aggregate || 0,
          expiration_epoch: beliefData.expiration_epoch || 0,
          status: 'active' // TODO: Calculate actual status based on current epoch
        }
      }
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