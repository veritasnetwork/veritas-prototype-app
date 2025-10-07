import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PublicKey } from "https://esm.sh/@solana/web3.js@1.87.6"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Solana configuration
const PROGRAM_ID = Deno.env.get("SOLANA_PROGRAM_ID") || ""

// Helper to derive pool PDAs
function getPoolPDA(programId: PublicKey, postId: Buffer): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), postId],
    programId
  )
  return pda
}

function getTokenMintPDA(programId: PublicKey, postId: Buffer): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint"), postId],
    programId
  )
  return pda
}

function getPoolVaultPDA(programId: PublicKey, postId: Buffer): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), postId],
    programId
  )
  return pda
}

interface PostCreationRequest {
  user_id: string
  title: string
  content: string
  initial_belief: number
  meta_prediction?: number
  duration_epochs?: number
  post_id?: string
  pool_deployment?: {
    pool_address: string
    token_mint_address: string
    usdc_vault_address: string
    deployment_tx_signature: string
    k_quadratic: number
  }
}

interface PostCreationResponse {
  post_id: string
  belief_id: string
  post: {
    id: string
    user_id: string
    belief_id: string
    title: string
    content: string
    created_at: string
  }
  belief: {
    belief_id: string
    initial_aggregate: number
    expiration_epoch: number
  }
  pool?: {
    pool_address: string
    token_mint_address: string
    usdc_vault_address: string
    deployment_recorded: boolean
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
      duration_epochs = 10, // Default 10 epochs (48h)
      post_id,
      pool_deployment
    }: PostCreationRequest = await req.json()

    // Validate required fields (title is required, content is optional)
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
    const postData: any = {
      user_id,
      belief_id: beliefData.belief_id,
      title: trimmedTitle,
      content: trimmedContent
    }

    // Use provided post_id if available (for Solana PDA derivation)
    if (post_id) {
      postData.id = post_id
    }

    const { data: post, error: postError } = await supabaseClient
      .from('posts')
      .insert(postData)
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

    // Record pool deployment if provided
    let poolInfo = null
    if (pool_deployment) {
      try {
        console.log('Recording pool deployment:', pool_deployment)

        // Record pool deployment in database
        const { error: deploymentError } = await supabaseClient.rpc(
          'record_pool_deployment',
          {
            p_post_id: post.id,
            p_belief_id: beliefData.belief_id,
            p_pool_address: pool_deployment.pool_address,
            p_vault_address: pool_deployment.usdc_vault_address,
            p_mint_address: pool_deployment.token_mint_address,
            p_deployed_by_agent_id: userData.agent_id,
            p_tx_signature: pool_deployment.deployment_tx_signature,
            p_k_quadratic: pool_deployment.k_quadratic,
          }
        )

        if (deploymentError) {
          console.error('Failed to record pool deployment:', deploymentError)
          // Don't fail the whole request - post and belief are already created
        } else {
          poolInfo = {
            pool_address: pool_deployment.pool_address,
            token_mint_address: pool_deployment.token_mint_address,
            usdc_vault_address: pool_deployment.usdc_vault_address,
            deployment_recorded: true
          }
          console.log('Pool deployment recorded successfully')
        }
      } catch (poolError) {
        console.error('Error recording pool:', poolError)
        // Don't fail the whole request - pool deployment is optional for now
      }
    }

    const response: PostCreationResponse = {
      post_id: post.id,
      belief_id: beliefData.belief_id,
      post: {
        id: post.id,
        user_id: post.user_id,
        belief_id: post.belief_id,
        title: post.title,
        content: post.content,
        created_at: post.created_at
      },
      belief: {
        belief_id: beliefData.belief_id,
        initial_aggregate: beliefData.initial_aggregate,
        expiration_epoch: beliefData.expiration_epoch
      },
      ...(poolInfo && { pool: poolInfo })
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